// COBOL Copybook parsing / stream generation / stream decomposition engine.
// Pure functions only — no React, no side effects. Safe to import from any component.

export type PicType = "X" | "9";

export interface ParsedField {
  id: string; // stable unique id for React keys / value maps (not necessarily the COBOL name, since names can repeat)
  level: number;
  name: string; // COBOL field name, e.g. "FIELD-A" or "FILLER"
  isFiller: boolean;
  picRaw: string; // human readable pic clause, e.g. "PIC X(04)."
  type: PicType;
  length: number; // total byte length in the stream (includes decimal digits for V99 fields, excludes the decimal point itself)
  decimals: number; // number of implied decimal digits (0 if none)
  isComp3: boolean; // COMP-3 fields are displayed as plain numbers (no packed-decimal conversion), per spec
  redefines: string | null; // name of the field/group this field redefines, if any
  indent: number; // 0 = top-level field, 1 = inside a REDEFINES sub-group (single level supported)
  start: number; // byte offset (0-indexed) within the generated/decomposed stream
  isGroup: boolean; // true for a REDEFINES group header row (no PIC clause, not fillable) shown for display purposes only
}

interface RawLine {
  level: number;
  name: string;
  isFiller: boolean;
  redefines: string | null;
  picRaw: string | null;
  type: PicType;
  length: number;
  decimals: number;
  isComp3: boolean;
  isGroup: boolean; // true when the line has no PIC clause (group header)
}

function stripPrefixAndComments(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("*")) return null; // whole line is a comment

  const tokens = trimmed.split(/\s+/);
  const first = tokens[0];
  const isLevelToken = /^\d{1,2}$/.test(first);

  if (isLevelToken) {
    return trimmed;
  }

  // First token isn't a level number -- likely a sequence/line prefix (e.g. A23101, 24174).
  if (/\*$/.test(first)) return null; // prefix directly followed by '*' marks a comment line

  const rest = trimmed.slice(first.length).trim();
  if (!rest) return null;
  if (rest.startsWith("*")) return null;
  return rest;
}

function parsePicture(pic: string): { type: PicType; length: number; decimals: number } {
  let length = 0;
  let decimals = 0;
  let type: PicType = "X";
  let afterV = false;
  let sawFirstChar = false;

  const re = /([9XV])(\((\d+)\))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pic)) !== null) {
    const ch = m[1].toUpperCase();
    const count = m[3] ? parseInt(m[3], 10) : 1;

    if (ch === "V") {
      afterV = true;
      continue;
    }

    if (!sawFirstChar) {
      type = ch === "9" ? "9" : "X";
      sawFirstChar = true;
    }

    length += count;
    if (afterV) decimals += count;
  }

  return { type, length, decimals };
}

function parseLine(line: string): RawLine | null {
  const levelMatch = line.match(/^(\d{1,2})\s+(.*)$/);
  if (!levelMatch) return null;

  const level = parseInt(levelMatch[1], 10);
  if (level === 88) return null; // condition names -- skip, never affect the stream

  const afterLevel = levelMatch[2].trim();
  if (!afterLevel) return null;

  const nameTokenMatch = afterLevel.match(/^([A-Za-z0-9\-]+)/);
  if (!nameTokenMatch) return null;
  const name = nameTokenMatch[1].replace(/\.$/, "");
  const isFiller = name.toUpperCase() === "FILLER";

  const redefinesMatch = afterLevel.match(/REDEFINES\s+([A-Za-z0-9\-]+)/i);
  const redefines = redefinesMatch ? redefinesMatch[1] : null;

  const picMatch = afterLevel.match(/PIC(?:TURE)?\s+([X9V()0-9]+)/i);
  const isComp3 = /COMP-3|COMPUTATIONAL-3/i.test(afterLevel);

  if (!picMatch) {
    return {
      level,
      name,
      isFiller,
      redefines,
      picRaw: null,
      type: "X",
      length: 0,
      decimals: 0,
      isComp3,
      isGroup: true,
    };
  }

  const picStr = picMatch[1];
  const { type, length, decimals } = parsePicture(picStr);

  return {
    level,
    name,
    isFiller,
    redefines,
    picRaw: `PIC ${picStr}.`,
    type,
    length,
    decimals,
    isComp3,
    isGroup: false,
  };
}

/**
 * Parses a COBOL copybook (.txt) into a flat, ordered list of elementary fields
 * ready for stream generation and decomposition. Group headers (lines with no
 * PIC clause) are used only to resolve REDEFINES targets and offsets — they do
 * not appear in the returned list.
 */
export function parseCopybook(source: string): ParsedField[] {
  const lines = source.split(/\r?\n/);
  const fields: ParsedField[] = [];
  const offsetsByName = new Map<string, number>();

  let cursor = 0;
  let shadowLevel: number | null = null;
  let shadowCursor = 0;
  let fieldCounter = 0;

  for (const rawLine of lines) {
    const cleaned = stripPrefixAndComments(rawLine);
    if (cleaned === null) continue;

    const parsed = parseLine(cleaned);
    if (!parsed) continue;

    // Exit the shadow (REDEFINES) group once we hit a line at or above its level.
    if (shadowLevel !== null && parsed.level <= shadowLevel) {
      shadowLevel = null;
    }

    if (parsed.isGroup) {
      if (parsed.redefines) {
        const targetOffset = offsetsByName.get(parsed.redefines.toUpperCase());
        const groupStart = targetOffset ?? cursor;

        // Emit a non-fillable display-only row for the REDEFINES group header itself,
        // so users can see it in the field table (with a "Redefines X" description)
        // even though it carries no value/length of its own -- its children (indented
        // beneath it) hold the actual overlapping fields.
        fieldCounter += 1;
        fields.push({
          id: `f${fieldCounter}`,
          level: parsed.level,
          name: parsed.name,
          isFiller: parsed.isFiller,
          picRaw: "",
          type: "X",
          length: 0,
          decimals: 0,
          isComp3: false,
          redefines: parsed.redefines,
          indent: shadowLevel !== null ? 1 : 0,
          start: groupStart,
          isGroup: true,
        });

        offsetsByName.set(parsed.name.toUpperCase(), groupStart);

        shadowLevel = parsed.level;
        shadowCursor = groupStart;
      }
      continue;
    }

    fieldCounter += 1;
    const id = `f${fieldCounter}`;

    let start: number;
    let indent = 0;

    if (shadowLevel !== null) {
      // Field nested inside an active REDEFINES group -- shares the group's offset space.
      start = shadowCursor;
      shadowCursor += parsed.length;
      indent = 1;
    } else if (parsed.redefines) {
      // A single elementary field redefining another field/group directly.
      const targetOffset = offsetsByName.get(parsed.redefines.toUpperCase());
      start = targetOffset ?? cursor;
      indent = 1;
    } else {
      start = cursor;
      cursor += parsed.length;
      indent = 0;
    }

    offsetsByName.set(parsed.name.toUpperCase(), start);

    fields.push({
      id,
      level: parsed.level,
      name: parsed.name,
      isFiller: parsed.isFiller,
      picRaw: parsed.picRaw ?? "",
      type: parsed.type,
      length: parsed.length,
      decimals: parsed.decimals,
      isComp3: parsed.isComp3,
      redefines: parsed.redefines,
      indent,
      start,
      isGroup: false,
    });
  }

  return fields;
}

/** Formats a single field's user-entered value into its fixed-width stream representation. */
export function formatFieldValue(field: ParsedField, rawValue: string): string {
  const value = rawValue ?? "";

  if (field.type === "9") {
    if (field.decimals > 0) {
      const intLen = field.length - field.decimals;
      const cleaned = value.replace(/[^0-9.\-]/g, "");
      const [intPartRaw, decPartRaw = ""] = cleaned.split(".");
      const intDigits = (intPartRaw || "0").replace(/[^0-9]/g, "") || "0";
      const decDigits = decPartRaw.replace(/[^0-9]/g, "");
      const intPadded = intDigits.slice(-intLen).padStart(intLen, "0");
      const decPadded = decDigits.slice(0, field.decimals).padEnd(field.decimals, "0");
      return `${intPadded}${decPadded}`;
    }
    const digits = value.replace(/[^0-9]/g, "") || "0";
    return digits.slice(-field.length).padStart(field.length, "0");
  }

  // Alphanumeric (X) fields: pad with trailing spaces, truncate if too long.
  return value.slice(0, field.length).padEnd(field.length, " ");
}

/** Builds the full fixed-width stream from a set of user-entered field values. */
export function generateStream(fields: ParsedField[], values: Record<string, string>): string {
  // Fields with indent > 0 (REDEFINES) occupy the same bytes as their target,
  // so only one "view" of each overlapping byte range should be written. We
  // write top-level (indent 0) fields first, then let REDEFINES fields overwrite
  // the same range only if the user actually typed a value for them.
  const length = fields.reduce((max, f) => Math.max(max, f.start + f.length), 0);
  const chars: string[] = new Array(length).fill(" ");

  const writeField = (field: ParsedField) => {
    const formatted = formatFieldValue(field, values[field.id] ?? "");
    for (let i = 0; i < formatted.length; i++) {
      chars[field.start + i] = formatted[i];
    }
  };

  fields.filter((f) => f.indent === 0).forEach(writeField);
  fields
    .filter((f) => f.indent > 0 && (values[f.id] ?? "").length > 0)
    .forEach(writeField);

  return chars.join("");
}

/** Extracts a field's raw fixed-width substring from a stream. */
export function extractFieldRaw(field: ParsedField, stream: string): string {
  return stream.slice(field.start, field.start + field.length).padEnd(field.length, " ");
}

/** Converts a field's raw fixed-width substring into its display value (trimmed / decimal-formatted). */
export function displayFieldValue(field: ParsedField, raw: string): string {
  if (field.type === "9") {
    if (field.decimals > 0) {
      const intLen = field.length - field.decimals;
      const intPart = raw.slice(0, intLen).replace(/[^0-9]/g, "") || "0";
      const decPart = raw.slice(intLen).replace(/[^0-9]/g, "").padEnd(field.decimals, "0");
      const trimmedInt = intPart.replace(/^0+(?=\d)/, "");
      return `${trimmedInt}.${decPart}`;
    }
    const digits = raw.replace(/[^0-9]/g, "") || "0";
    const trimmed = digits.replace(/^0+(?=\d)/, "");
    return trimmed;
  }
  return raw.replace(/\s+$/, "");
}

export interface DecomposedField extends ParsedField {
  raw: string;
  value: string;
}

/** Decomposes a stream into field values, given a parsed copybook. */
export function decomposeStream(fields: ParsedField[], stream: string): DecomposedField[] {
  return fields.map((field) => {
    const raw = extractFieldRaw(field, stream);
    return {
      ...field,
      raw,
      value: displayFieldValue(field, raw),
    };
  });
}
