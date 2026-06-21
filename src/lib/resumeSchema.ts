// Shared types for the structured resume / cover letter payloads the AI returns.
// Matches the JSON shape declared in supabase/functions/tailor/prompts.ts.

export type Link = { label: string; url: string };

export type Header = {
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: Link[];
};

export type SkillGroup = { group: string; items: string[] };

export type Bullet = { text: string; keywords: string[] };

export type Role = {
  title: string;
  company: string;
  location: string | null;
  start: string;
  end: string;
  bullets: Bullet[];
};

export type Project = {
  name: string;
  description: string;
  bullets: Bullet[];
};

export type Education = {
  degree: string;
  school: string;
  location: string | null;
  start: string | null;
  end: string | null;
  details: string | null;
};

export type Certification = {
  name: string;
  issuer: string | null;
  year: string | null;
};

export type Ats = {
  score: number;
  matched: string[];
  missing: string[];
};

export type TailoredResume = {
  header: Header;
  summary: string;
  skills: SkillGroup[];
  experience: Role[];
  projects: Project[];
  education: Education[];
  certifications: Certification[];
  ats: Ats;
};

export type CoverLetter = {
  recipient: string;
  paragraphs: string[];
  signoff: string;
  name: string;
  ats: { matched: string[]; missing: string[] };
};

export type Template = "classic" | "modern";

// Render a resume into a single plain-text string (for copy-to-clipboard).
export function resumeToPlainText(r: TailoredResume): string {
  const lines: string[] = [];
  const h = r.header;
  lines.push(h.name);
  if (h.title) lines.push(h.title);
  const contact = [h.email, h.phone, h.location, ...(h.links?.map(l => `${l.label}: ${l.url}`) ?? [])].filter(Boolean);
  if (contact.length) lines.push(contact.join(" | "));
  lines.push("");

  if (r.summary) {
    lines.push("SUMMARY");
    lines.push(r.summary);
    lines.push("");
  }

  if (r.skills?.length) {
    lines.push("SKILLS");
    for (const g of r.skills) lines.push(`${g.group}: ${g.items.join(", ")}`);
    lines.push("");
  }

  if (r.experience?.length) {
    lines.push("EXPERIENCE");
    for (const e of r.experience) {
      lines.push(`${e.title} | ${e.company}${e.location ? ` | ${e.location}` : ""} | ${e.start} – ${e.end}`);
      for (const b of e.bullets) lines.push(`• ${b.text}`);
      lines.push("");
    }
  }

  if (r.projects?.length) {
    lines.push("PROJECTS");
    for (const p of r.projects) {
      lines.push(p.name + (p.description ? ` — ${p.description}` : ""));
      for (const b of p.bullets) lines.push(`• ${b.text}`);
      lines.push("");
    }
  }

  if (r.education?.length) {
    lines.push("EDUCATION");
    for (const ed of r.education) {
      lines.push(`${ed.degree} | ${ed.school}${ed.location ? ` | ${ed.location}` : ""}${ed.start || ed.end ? ` | ${ed.start ?? ""} – ${ed.end ?? ""}` : ""}`);
      if (ed.details) lines.push(ed.details);
    }
    lines.push("");
  }

  if (r.certifications?.length) {
    lines.push("CERTIFICATIONS");
    for (const c of r.certifications) {
      lines.push(`${c.name}${c.issuer ? ` — ${c.issuer}` : ""}${c.year ? ` (${c.year})` : ""}`);
    }
  }

  return lines.join("\n").trim();
}

export function coverToPlainText(c: CoverLetter): string {
  const lines = [c.recipient, "", ...c.paragraphs.flatMap(p => [p, ""]), c.signoff, c.name].filter(s => s != null);
  return lines.join("\n").trim();
}
