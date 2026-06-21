// Two-pass prompts for resume / cover letter tailoring.
// Pass 1 analyzes the JD + resume; Pass 2 writes the final document.
// Both passes return JSON.

export type TailorInput = {
  mode: "resume" | "cover_letter";
  resume: string;
  jobDescription: string;
  jobTitle?: string;
  company?: string;
  preferences?: string;
  language?: "en" | "ms";
};

const langName = (l?: string) => (l === "ms" ? "Bahasa Malaysia" : "English");

// ----- Pass 1: ANALYZE ---------------------------------------------------
const ANALYZE_SYSTEM = `You are a senior ATS-optimization analyst. Read the candidate's resume and the job description, then output a STRICT JSON object that maps the JD's requirements to evidence in the resume. Be ruthless about truthfulness — never invent skills, metrics, titles, or dates.

Return JSON in EXACTLY this shape:

{
  "tier1_keywords": [string],     // appears 2+ times in JD or in title/requirements; must-have
  "tier2_keywords": [string],     // appears once in requirements; should-have
  "tier3_keywords": [string],     // nice-to-haves, soft skills
  "implicit_requirements": [string],  // unstated but obvious from seniority/scope
  "candidate_evidence": [
    {
      "keyword": string,           // a JD keyword
      "tier": 1 | 2 | 3,
      "evidence_kind": "direct" | "transferable" | "missing",
      "source_bullets": [string]   // verbatim or near-verbatim bullets from the original resume
    }
  ],
  "highlight_priorities": [string], // 3-5 things a recruiter scans for in 6 seconds
  "ats_score_initial": int,        // 0-100, where 100 = every tier1+tier2 has direct evidence
  "missing_critical": [string],    // tier1 keywords with no evidence at all
  "rewrite_strategy": string       // 2-3 sentences on what to reframe, reorder, surface, compress
}

Use EXACT JD terminology. Spell out acronyms (e.g. "AWS / Amazon Web Services") when both forms appear in the JD. No prose, no markdown, no preamble — JSON only.`;

export function analyzePrompt(input: TailorInput) {
  return [
    { role: "system" as const, content: ANALYZE_SYSTEM },
    {
      role: "user" as const,
      content: `JOB TITLE: ${input.jobTitle || "N/A"}
COMPANY: ${input.company || "N/A"}

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE RESUME:
${input.resume}`,
    },
  ];
}

// ----- Pass 2a: RESUME ---------------------------------------------------
const RESUME_SYSTEM = `You are a world-class resume strategist. Using the candidate's resume, the JD, and a PRE-COMPUTED ANALYSIS, produce a tailored resume as STRICT JSON.

ABSOLUTE RULES
- TRUTHFULNESS: never fabricate roles, titles, dates, employers, metrics, or skills. Reframe and surface — never invent.
- ATS keyword coverage is the #1 success metric. TIER 1 keywords MUST appear in the summary, in skills, and in at least one experience bullet. TIER 2 must appear in skills and one bullet where evidence supports it.
- Mirror the JD's EXACT terminology. If JD says "TypeScript", don't write "TS". If JD says "stakeholder management", don't say "managing stakeholders".
- Spell out and include the acronym on first use where natural ("Search Engine Optimization (SEO)").
- Strong action verbs, past tense (present for current role). No first-person pronouns. No filler: "responsible for", "helped with", "team player".
- Reorder bullets within each role so the most JD-relevant is bullet #1. Compress weakly-relevant roles to 1-2 lines but never delete them.
- Quantify where the resume supports it. Never invent numbers.
- Preserve real metrics from the original.

OUTPUT JSON SHAPE (return EXACTLY this — no extra keys, no comments):
{
  "header": {
    "name": string,
    "title": string,                  // tailored title aligned to the target role
    "email": string | null,
    "phone": string | null,
    "location": string | null,
    "links": [{ "label": string, "url": string }]
  },
  "summary": string,                  // 2-3 sentences, must read like it was written for THIS job
  "skills": [
    { "group": string, "items": [string] }   // e.g. {"group":"Languages","items":["TypeScript","Python"]}
  ],
  "experience": [
    {
      "title": string,
      "company": string,
      "location": string | null,
      "start": string,                // "Jan 2022"
      "end": string,                  // "Present" or "Mar 2024"
      "bullets": [
        { "text": string, "keywords": [string] }   // keywords = JD terms used in this bullet
      ]
    }
  ],
  "projects": [
    { "name": string, "description": string, "bullets": [{ "text": string, "keywords": [string] }] }
  ],
  "education": [
    { "degree": string, "school": string, "location": string | null, "start": string | null, "end": string | null, "details": string | null }
  ],
  "certifications": [{ "name": string, "issuer": string | null, "year": string | null }],
  "ats": {
    "score": int,                      // 0-100, predicted ATS keyword match
    "matched": [string],               // JD keywords present in the output
    "missing": [string]                // critical JD keywords with no truthful evidence
  }
}

Empty arrays for sections the candidate doesn't have. NEVER include null for required strings — use "" instead.
No markdown. No prose outside the JSON. No code fences.`;

export function resumePrompt(input: TailorInput, analysisJson: string) {
  const prefBlock = input.preferences?.trim()
    ? `\n\nCANDIDATE PREFERENCES & PRIORITIES (follow closely while staying truthful):\n${input.preferences}`
    : "";

  const langInstr =
    input.language === "ms"
      ? `\n\nOUTPUT LANGUAGE: ${langName(input.language)}. Translate prose (summary, bullets, descriptions) to Bahasa Malaysia. Keep proper nouns, technology names, and JD keywords in their original form (do NOT translate "React", "TypeScript", "AWS", "Stakeholder Management", etc.).`
      : `\n\nOUTPUT LANGUAGE: English.`;

  return [
    { role: "system" as const, content: RESUME_SYSTEM },
    {
      role: "user" as const,
      content: `PRE-COMPUTED ANALYSIS (use this to drive keyword selection, bullet reorder, and rewrite strategy):
${analysisJson}

JOB TITLE: ${input.jobTitle || "N/A"}
COMPANY: ${input.company || "N/A"}

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE RESUME (rewrite, do not copy verbatim):
${input.resume}${prefBlock}${langInstr}`,
    },
  ];
}

// ----- Pass 2b: COVER LETTER --------------------------------------------
const COVER_SYSTEM = `You are a senior career coach writing a tailored cover letter. Output STRICT JSON.

RULES
- 3-4 tight paragraphs, 250-350 words total.
- Open with a specific reason for excitement about THIS role at THIS company + a 1-line value prop.
- Body: 2-3 strongest achievements (quantified where the resume supports it) that map to top JD requirements. Mirror JD language.
- Close with a confident forward-looking call to action.
- No clichés: "team player", "passionate about", "hard worker", "think outside the box".
- No placeholders like [Your Name], [Date], [Address]. Omit gracefully if data is missing.
- Truthful: never fabricate.
- Start with "Dear Hiring Manager," or the company name if provided.

OUTPUT JSON SHAPE:
{
  "recipient": string,                  // e.g. "Dear Hiring Manager,"
  "paragraphs": [string],               // 3-4 paragraphs, each one a single string
  "signoff": string,                    // e.g. "Sincerely,"
  "name": string,                       // candidate name if available, else ""
  "ats": {
    "matched": [string],
    "missing": [string]
  }
}

No markdown, no preamble, no code fences. JSON only.`;

export function coverPrompt(input: TailorInput, analysisJson: string) {
  const langInstr =
    input.language === "ms"
      ? `\n\nOUTPUT LANGUAGE: Bahasa Malaysia. Keep technology names and JD keywords in original form.`
      : `\n\nOUTPUT LANGUAGE: English.`;

  return [
    { role: "system" as const, content: COVER_SYSTEM },
    {
      role: "user" as const,
      content: `PRE-COMPUTED ANALYSIS:
${analysisJson}

JOB TITLE: ${input.jobTitle || "N/A"}
COMPANY: ${input.company || "N/A"}

JOB DESCRIPTION:
${input.jobDescription}

CANDIDATE RESUME:
${input.resume}${langInstr}`,
    },
  ];
}
