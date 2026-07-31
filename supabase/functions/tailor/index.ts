// Tailor edge function — two-pass AI generation with credit gating.
// Anonymous users authenticate via x-anon-fp header; signed-in via JWT.

import { preflight, json } from "../_shared/cors.ts";
import { getUserIdFromJwt, serviceClient, userClient } from "../_shared/supabase.ts";
import { callLLM } from "./llm.ts";
import { analyzePrompt, resumePrompt, coverPrompt, critiquePrompt, TailorInput } from "./prompts.ts";

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function parseJson(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return valid JSON");
  }
}

// Deterministic weighted average — never trust the LLM's own arithmetic for the headline score.
const CRITIQUE_WEIGHTS: Record<string, number> = {
  keyword_match: 0.25,
  role_fit: 0.20,
  impact_quantification: 0.20,
  seniority_alignment: 0.15,
  clarity_language: 0.10,
  structure_completeness: 0.10,
};
function computeOverallScore(categories: { key: string; score: number }[]): number {
  let sum = 0, weightSum = 0;
  for (const c of categories ?? []) {
    const w = CRITIQUE_WEIGHTS[c.key] ?? 0;
    sum += Math.max(0, Math.min(100, c.score ?? 0)) * w;
    weightSum += w;
  }
  return weightSum > 0 ? Math.round(sum / weightSum) : 0;
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const startedAt = Date.now();
  const sb = serviceClient();
  let consumed: { kind: "user"; userId: string } | { kind: "anon"; fp: string } | null = null;

  try {
    const body = await req.json() as TailorInput;
    const { mode, resume, jobDescription } = body;

    if (!mode || (mode !== "resume" && mode !== "cover_letter")) {
      return json(req, { error: "Invalid mode" }, 400);
    }
    if (!resume?.trim() || !jobDescription?.trim()) {
      return json(req, { error: "Resume and job description are required" }, 400);
    }
    if (resume.length > 40_000 || jobDescription.length > 40_000) {
      return json(req, { error: "Input too large" }, 413);
    }
    // Cap the smaller free-text fields too — they're interpolated into the
    // prompt, so they're an injection/cost surface just like the big ones.
    if ((body.preferences?.length ?? 0) > 5_000 ||
        (body.jobTitle?.length ?? 0) > 300 ||
        (body.company?.length ?? 0) > 300) {
      return json(req, { error: "Input too large" }, 413);
    }

    const authHeader = req.headers.get("authorization");
    const userId = await getUserIdFromJwt(authHeader);

    // Free credits require an account. Anonymous requests are not served — this
    // is the real (server-side) enforcement behind the "sign up for 3 free"
    // gate, and it removes the anonymous fingerprint-farming surface entirely.
    if (!userId) return json(req, { error: "auth_required" }, 401);

    {
      const userSb = userClient(authHeader);
      const { error } = await userSb.rpc("consume_credit_signed_in");
      if (error) {
        if (error.message?.includes("insufficient_credit"))
          return json(req, { error: "insufficient_credit" }, 402);
        console.error(JSON.stringify({ at: "consume_signed_in", error }));
        return json(req, { error: "credit_error" }, 500);
      }
      consumed = { kind: "user", userId };
    }

    const analysis = await callLLM(analyzePrompt(body), { json: true, temperature: 0.2 });

    const writeMessages = mode === "resume"
      ? resumePrompt(body, analysis.text)
      : coverPrompt(body, analysis.text);

    // Critique runs concurrently with the write pass — it only depends on the
    // Pass-1 analysis + original resume, same as the write pass. Must never
    // fail the primary request: any error or bad JSON degrades to `null`.
    const critiqueCall = mode === "resume"
      ? callLLM(critiquePrompt(body, analysis.text), { json: true, temperature: 0.3, noFallback: true })
          .then(r => { try { return parseJson(r.text); } catch { return null; } })
          .catch(() => null)
      : Promise.resolve(null);

    const [result, critiqueRaw] = await Promise.all([
      callLLM(writeMessages, { json: true, temperature: 0.45 }),
      critiqueCall,
    ]);

    const critique = critiqueRaw
      ? { ...critiqueRaw, overall_score: computeOverallScore(critiqueRaw.categories) }
      : null;

    let payload: any;
    try {
      payload = parseJson(result.text);
    } catch (e) {
      console.error(JSON.stringify({ at: "parse_json", err: String(e), raw: result.text.slice(0, 500) }));
      if (consumed?.kind === "user") await sb.rpc("refund_credit_by_id", { p_user_id: consumed.userId });
      else if (consumed?.kind === "anon") await sb.rpc("refund_credit_anon", { fp: consumed.fp });
      return json(req, { error: "ai_format_error" }, 502);
    }

    if (consumed?.kind === "user") {
      const jdHash = await sha256(jobDescription);
      await sb.from("generations").insert({
        user_id: consumed.userId,
        mode,
        job_title: body.jobTitle ?? null,
        company: body.company ?? null,
        jd_hash: jdHash,
        payload,
        ats_score: payload?.ats?.score ?? null,
        critique,
      });
    }

    return json(req, {
      payload,
      critique,
      mode,
      model: result.model,
      latency_ms: Date.now() - startedAt,
    });

  } catch (e) {
    console.error(JSON.stringify({ at: "tailor", err: e instanceof Error ? e.message : String(e) }));
    if (consumed?.kind === "user") {
      try { await sb.rpc("refund_credit_by_id", { p_user_id: consumed.userId }); } catch (_) {}
    } else if (consumed?.kind === "anon") {
      try { await sb.rpc("refund_credit_anon", { fp: consumed.fp }); } catch (_) {}
    }
    // Log the real cause server-side; return a generic code so we never leak
    // raw provider error bodies (model names, org ids, keys) to the client.
    return json(req, { error: "generation_failed" }, 500);
  }
});
