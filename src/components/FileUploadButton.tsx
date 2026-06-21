import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { extractTextFromFile } from "@/lib/extractText";

interface FileUploadButtonProps {
  onText: (text: string) => void;
  label?: string;
}

export const FileUploadButton = ({ onText, label = "Upload file" }: FileUploadButtonProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setLoading(true);
    try {
      const text = await extractTextFromFile(file);
      if (!text) {
        toast.error("Couldn't extract any text from this file");
        return;
      }
      onText(text);
      toast.success(`Loaded ${file.name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to read file");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {label}
      </Button>
    </>
  );
};
