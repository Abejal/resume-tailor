import { pdf } from "@react-pdf/renderer";
import type { TailoredResume, CoverLetter, Template } from "@/lib/resumeSchema";
import { ResumeDoc, CoverDoc } from "./pdfTemplates";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadResumePdf(r: TailoredResume, template: Template, filename: string) {
  const blob = await pdf(ResumeDoc({ r, template })).toBlob();
  download(blob, filename);
}

export async function downloadCoverPdf(c: CoverLetter, template: Template, filename: string) {
  const blob = await pdf(CoverDoc({ c, template })).toBlob();
  download(blob, filename);
}
