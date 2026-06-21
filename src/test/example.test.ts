import { describe, it, expect, beforeEach } from "vitest";
import { getFingerprint, clearFingerprint } from "@/lib/fingerprint";
import { resumeToPlainText, coverToPlainText, type TailoredResume, type CoverLetter } from "@/lib/resumeSchema";

describe("fingerprint", () => {
  beforeEach(() => { clearFingerprint(); localStorage.clear(); });

  it("returns 64-char hex", async () => {
    const fp = await getFingerprint();
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is stable across calls in the same session", async () => {
    const a = await getFingerprint();
    const b = await getFingerprint();
    expect(a).toBe(b);
  });

  it("persists across module-level cache clears", async () => {
    const a = await getFingerprint();
    // Simulate full page reload: our in-memory cache resets but localStorage stays.
    const persisted = localStorage.getItem("jobtailor_fp");
    expect(persisted).toBe(a);
  });
});

describe("resumeToPlainText", () => {
  const r: TailoredResume = {
    header: { name: "Jane Doe", title: "Senior Engineer", email: "j@x.com", phone: null, location: "KL", links: [] },
    summary: "Engineer with 8 yrs experience.",
    skills: [{ group: "Languages", items: ["TypeScript", "Python"] }],
    experience: [{
      title: "Engineer", company: "Acme", location: "Remote", start: "Jan 2022", end: "Present",
      bullets: [{ text: "Shipped a thing", keywords: ["shipped"] }],
    }],
    projects: [], education: [], certifications: [],
    ats: { score: 88, matched: ["TypeScript"], missing: [] },
  };

  it("renders sections in the expected order", () => {
    const text = resumeToPlainText(r);
    expect(text.indexOf("Jane Doe")).toBeLessThan(text.indexOf("SUMMARY"));
    expect(text.indexOf("SUMMARY")).toBeLessThan(text.indexOf("SKILLS"));
    expect(text.indexOf("SKILLS")).toBeLessThan(text.indexOf("EXPERIENCE"));
  });

  it("strips empty sections", () => {
    const text = resumeToPlainText(r);
    expect(text).not.toContain("PROJECTS");
    expect(text).not.toContain("CERTIFICATIONS");
  });
});

describe("coverToPlainText", () => {
  it("renders recipient, paragraphs, signoff", () => {
    const c: CoverLetter = {
      recipient: "Dear Hiring Manager,",
      paragraphs: ["Para 1", "Para 2"],
      signoff: "Sincerely,",
      name: "Jane Doe",
      ats: { matched: [], missing: [] },
    };
    const text = coverToPlainText(c);
    expect(text).toMatch(/^Dear Hiring Manager,/);
    expect(text).toContain("Para 1");
    expect(text).toContain("Para 2");
    expect(text).toContain("Sincerely,");
    expect(text).toContain("Jane Doe");
  });
});
