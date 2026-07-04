import { useState, useMemo } from "react";
import { parseCopybook, decomposeStream, getRecordLength } from "@/lib/cobol";
import { FileTextarea } from "./file-textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function DecomposeTab() {
  const [copybookSource, setCopybookSource] = useState("");
  const [streamSource, setStreamSource] = useState("");
  const { toast } = useToast();

  const fields = useMemo(() => {
    try {
      return parseCopybook(copybookSource);
    } catch (e) {
      return [];
    }
  }, [copybookSource]);

  const results = useMemo(() => {
    if (!fields.length || !streamSource) return [];
    try {
      return decomposeStream(fields, streamSource);
    } catch (e) {
      return [];
    }
  }, [fields, streamSource]);

  const recordLength = useMemo(() => getRecordLength(fields), [fields]);
  const lengthMismatch = fields.length > 0 && streamSource.length > 0 && streamSource.length !== recordLength;

  const handleCopyResult = async () => {
    if (!results.length) return;
    
    const textLines = ["Field\tType\tLength\tValue"];
    results.forEach(r => {
      if (r.length === 0) return; // skip purely structural groups if any
      const indentStr = "  ".repeat(r.indent);
      textLines.push(`${indentStr}${r.name}\t${r.picRaw}\t${r.length}\t${r.value}`);
    });

    await navigator.clipboard.writeText(textLines.join("\n"));
    toast({ title: "Copied to clipboard", description: "The decomposition results have been copied." });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-6">
            <FileTextarea
              label="Copybook Definition"
              placeholder="01 CUSTOMER-RECORD.&#10;   05 CUSTOMER-ID   PIC X(10)."
              value={copybookSource}
              onChange={setCopybookSource}
              showTypeLegend
              lengthBadge={fields.length > 0 ? `Total: ${recordLength} bytes` : undefined}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <FileTextarea
              label="Stream Data"
              placeholder="Paste fixed-width stream data here..."
              value={streamSource}
              onChange={setStreamSource}
              lengthBadge={streamSource.length > 0 ? `Length: ${streamSource.length} bytes` : undefined}
              lengthBadgeVariant={lengthMismatch ? "warning" : "default"}
            />
            {lengthMismatch && (
              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-500">
                Stream length ({streamSource.length}) doesn't match the copybook's expected length ({recordLength}).
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {(copybookSource.trim() || streamSource.trim()) && results.length === 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md border text-center">
          Provide both a valid copybook and stream data to see decomposition results.
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <CardContent className="pt-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Decomposed Fields</h3>
              <Button variant="outline" size="sm" onClick={handleCopyResult} className="h-7 text-xs">
                <Copy className="w-3 h-3 mr-1.5" />
                Copy Result
              </Button>
            </div>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[35%] text-xs">Field</TableHead>
                    <TableHead className="w-[20%] text-xs">Type</TableHead>
                    <TableHead className="w-[10%] text-xs">Len</TableHead>
                    <TableHead className="w-[35%] text-xs">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.id} className={r.indent > 0 ? "bg-muted/20" : ""}>
                      <TableCell className="py-2 text-xs font-mono">
                        <div style={{ paddingLeft: `${r.indent * 16}px` }} className="flex flex-col">
                          <span>{r.name}</span>
                          {r.redefines && !r.isGroup && <span className="text-[10px] text-muted-foreground">Redefines {r.redefines}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-mono text-muted-foreground">{r.picRaw || "GROUP"}</TableCell>
                      <TableCell className="py-2 text-xs font-mono text-muted-foreground">{r.length > 0 ? r.length : ""}</TableCell>
                      <TableCell className="py-2 text-xs font-mono">
                        {r.isGroup && r.groupNote ? (
                          <span className="italic text-muted-foreground">{r.groupNote}</span>
                        ) : r.isFiller ? (
                          <span className="italic text-muted-foreground">Filler</span>
                        ) : r.length > 0 ? (
                          <div className="bg-muted/40 px-2 py-1 rounded inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap" title={r.value}>
                            {r.value || <span className="opacity-0">.</span>}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
