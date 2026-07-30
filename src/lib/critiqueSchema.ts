// Multi-category resume critique — rates the ORIGINAL submitted resume against
// the job description across 6 fixed dimensions. Mirrors the JSON shape the
// `tailor` edge function's critique pass returns (see supabase/functions/tailor/prompts.ts).

export type CritiqueCategoryKey =
  | "keyword_match"
  | "role_fit"
  | "impact_quantification"
  | "seniority_alignment"
  | "clarity_language"
  | "structure_completeness";

export type CritiqueCategory = {
  key: CritiqueCategoryKey;
  label: string;
  score: number;
  verdict: string;
  why: string[];
  fixes: string[];
};

export type CritiqueResult = {
  categories: CritiqueCategory[];
  overall_score: number;
  overall_verdict: string;
  top_strengths: string[];
  top_risks: string[];
};

// Display order — categories[] from the LLM isn't guaranteed to match this order,
// always index by `key`, never by array position.
export const CRITIQUE_CATEGORY_ORDER: CritiqueCategoryKey[] = [
  "keyword_match",
  "role_fit",
  "impact_quantification",
  "seniority_alignment",
  "clarity_language",
  "structure_completeness",
];
