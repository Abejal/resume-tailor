import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, ExternalHyperlink,
} from "docx";
import type { TailoredResume, CoverLetter, Template } from "@/lib/resumeSchema";

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const SECTION_RUN = { bold: true, size: 22, color: "1a1a1a" } as const;

function sectionHeader(text: string) {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    border: { bottom: { color: "999999", space: 2, value: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ ...SECTION_RUN, text: text.toUpperCase(), characterSpacing: 30 })],
  });
}

function bulletFromText(text: string, keywords: string[] = []) {
  if (!keywords?.length) {
    return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] });
  }
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(re);
  const runs = parts.map(p =>
    keywords.some(k => k.toLowerCase() === p.toLowerCase())
      ? new TextRun({ text: p, bold: true })
      : new TextRun(p),
  );
  return new Paragraph({ bullet: { level: 0 }, children: runs });
}

function buildResumeDoc(r: TailoredResume): Document {
  const children: Paragraph[] = [];
  const h = r.header;

  children.push(new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: h.name, bold: true, size: 40 })],
  }));
  if (h.title) {
    children.push(new Paragraph({ children: [new TextRun({ text: h.title, size: 22, color: "444444" })] }));
  }
  const contact = [h.email, h.phone, h.location].filter(Boolean).join("  •  ");
  if (contact || (h.links && h.links.length)) {
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: contact, size: 18, color: "555555" }),
        ...(h.links ?? []).flatMap((l, i): any[] => [
          new TextRun({ text: (i === 0 && contact) ? "  •  " : (i > 0 ? "  •  " : ""), size: 18, color: "555555" }),
          new ExternalHyperlink({
            link: l.url,
            children: [new TextRun({ text: l.label, size: 18, color: "1d4ed8", underline: {} })],
          }),
        ]),
      ],
    }));
  }

  if (r.summary) {
    children.push(sectionHeader("Summary"));
    children.push(new Paragraph({ children: [new TextRun(r.summary)] }));
  }

  if (r.skills?.length) {
    children.push(sectionHeader("Skills"));
    for (const g of r.skills) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${g.group}:  `, bold: true }),
          new TextRun(g.items.join(", ")),
        ],
      }));
    }
  }

  if (r.experience?.length) {
    children.push(sectionHeader("Experience"));
    for (const e of r.experience) {
      children.push(new Paragraph({
        spacing: { before: 160 },
        children: [
          new TextRun({ text: `${e.title} · ${e.company}`, bold: true }),
          new TextRun({ text: `    ${e.start} – ${e.end}`, color: "555555" }),
        ],
      }));
      if (e.location) {
        children.push(new Paragraph({ children: [new TextRun({ text: e.location, italics: true, color: "555555" })] }));
      }
      for (const b of e.bullets) children.push(bulletFromText(b.text, b.keywords));
    }
  }

  if (r.projects?.length) {
    children.push(sectionHeader("Projects"));
    for (const p of r.projects) {
      children.push(new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: p.name, bold: true }),
          p.description ? new TextRun({ text: ` — ${p.description}` }) : new TextRun(""),
        ],
      }));
      for (const b of p.bullets) children.push(bulletFromText(b.text, b.keywords));
    }
  }

  if (r.education?.length) {
    children.push(sectionHeader("Education"));
    for (const ed of r.education) {
      children.push(new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: `${ed.degree} · ${ed.school}`, bold: true }),
          new TextRun({ text: `    ${[ed.start, ed.end].filter(Boolean).join(" – ")}`, color: "555555" }),
        ],
      }));
      if (ed.location) children.push(new Paragraph({ children: [new TextRun({ text: ed.location, italics: true, color: "555555" })] }));
      if (ed.details) children.push(new Paragraph({ children: [new TextRun(ed.details)] }));
    }
  }

  if (r.certifications?.length) {
    children.push(sectionHeader("Certifications"));
    for (const c of r.certifications) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: c.name, bold: true }),
          new TextRun(`${c.issuer ? ` — ${c.issuer}` : ""}${c.year ? ` (${c.year})` : ""}`),
        ],
      }));
    }
  }

  return new Document({
    creator: "Resume Tailor",
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children }],
  });
}

function buildCoverDoc(c: CoverLetter): Document {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun(c.recipient)] }));
  for (const p of c.paragraphs) {
    children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun(p)] }));
  }
  children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun(c.signoff)] }));
  if (c.name) children.push(new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: c.name, bold: true })] }));

  return new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } }, children }],
  });
}

export async function downloadResumeDocx(r: TailoredResume, _t: Template, filename: string) {
  const doc = buildResumeDoc(r);
  const blob = await Packer.toBlob(doc);
  trigger(blob, filename);
}

export async function downloadCoverDocx(c: CoverLetter, _t: Template, filename: string) {
  const doc = buildCoverDoc(c);
  const blob = await Packer.toBlob(doc);
  trigger(blob, filename);
}
