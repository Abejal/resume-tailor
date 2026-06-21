import mammoth from "mammoth";

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
    return await file.text();
  }

  if (name.endsWith(".docx")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs: any = await import("pdfjs-dist");
    // Use the bundled worker via Vite's ?url import
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      text += pageText + "\n\n";
    }
    return text.trim();
  }

  throw new Error("Unsupported file type. Please upload a .pdf, .docx, or .txt file.");
}
