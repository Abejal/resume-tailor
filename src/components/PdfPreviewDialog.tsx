import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, ExternalLink, FileWarning } from "lucide-react";
import { toast } from "sonner";
import type { TailoredResume, CoverLetter, Template } from "@/lib/resumeSchema";
import { renderResumePdfBlob, renderCoverPdfBlob } from "@/lib/exports/pdfRenderer";

type Props =
  | { kind: "resume"; data: TailoredResume; template: Template; filename: string; open: boolean; onOpenChange: (v: boolean) => void }
  | { kind: "cover"; data: CoverLetter; template: Template; filename: string; open: boolean; onOpenChange: (v: boolean) => void };

export function PdfPreviewDialog(props: Props) {
  const { open, onOpenChange, template, filename } = props;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setUrl(null);

    (async () => {
      try {
        const blob = props.kind === "resume"
          ? await renderResumePdfBlob(props.data, template)
          : await renderCoverPdfBlob(props.data, template);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        urlRef.current = objectUrl;
        setUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Couldn't render the PDF preview");
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("PDF downloaded");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-display text-base">PDF Preview</DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              {url && (
                <>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open in tab
                  </Button>
                  <Button size="sm" className="h-8 bg-gradient-primary text-primary-foreground" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-muted/40">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <FileWarning className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : url ? (
            <iframe src={url} title="PDF preview" className="w-full h-full border-0" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Rendering PDF…</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
