import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, Clipboard } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function FileTextarea({
  value,
  onChange,
  placeholder,
  label
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        onChange(ev.target.result);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast({ title: "Clipboard is empty", variant: "destructive" });
        return;
      }
      onChange(text);
      toast({ title: "Pasted from clipboard" });
    } catch (e) {
      toast({
        title: "Couldn't read clipboard",
        description: "Your browser may be blocking clipboard access. Try pasting directly into the field instead.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handlePaste}
          >
            <Clipboard className="w-3 h-3 mr-1.5" />
            Paste
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-3 h-3 mr-1.5" />
            Upload .txt
          </Button>
          <input
            type="file"
            ref={fileRef}
            className="hidden"
            accept=".txt"
            onChange={handleFileChange}
          />
        </div>
      </div>
      <Textarea
        className="font-mono text-xs resize-y min-h-[120px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  );
}
