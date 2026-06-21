// Tailor edge function — two-pass AI generation with credit gating.
// Anonymous users authenticate via x-anon-fp header; signed-in via JWT.

import { preflight, json } from "../_shared/cors.ts";
import { getUserIdFromJwt, serviceClient, userClient } from "../_shared/supabase.ts";
import { callLLM } from "./llm.ts";
import { analyzePrompt, resumePrompt, coverPrompt, TailorInput } from "./prompts.ts";

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

    const authHeader = req.headers.get("authorization");
    const fp = req.headers.get("x-anon-fp");
    const userId = await getUserIdFromJwt(authHeader);

    if (userId) {
      const userSb = userClient(authHeader);
      const { error } = await userSb.rpc("consume_credit_signed_in");
      if (error) {
        if (error.message?.includes("insufficient_credit"))
          return json(req, { error: "insufficient_credit" }, 402);
        console.error(JSON.stringify({ at: "consume_signed_in", error }));
        return json(req, { error: "credit_error" }, 500);
      }
      consumed = { kind: "user", userId };
    } else if (fp && /^[a-f0-9]{32,128}$/i.test(fp)) {
      const ipHash = await sha256(req.headers.get("x-forwarded-for") ?? "");
      const { error } = await sb.rpc("consume_credit_anon", { fp, ip_h: ipHash });
      if (error) {
        if (error.message?.includes("insufficient_credit"))
          return json(req, { error: "insufficient_credit" }, 402);
        console.error(JSON.stringify({ at: "consume_anon", error }));
        return json(req, { error: "credit_error" }, 500);
      }
      consumed = { kind: "anon", fp };
    } else {
      return json(req, { error: "auth_required" }, 401);
    }

    const analysis = await callLLM(analyzePrompt(body), { json: true, temperature: 0.2 });

    const writeMessages = mode === "resume"
      ? resumePrompt(body, analysis.text)
      : coverPrompt(body, analysis.text);

    const result = await callLLM(writeMessages, { json: true, temperature: 0.45 });

    let payload: any;
    try {
      payload = parseJson(result.text);
    } catch (e) {
      console.error(JSON.stringify({ at: "parse_json", err: String(e), raw: result.text.slice(0, 500) }));
      if (consumed?.kind === "user") await userClient(authHeader).rpc("refund_credit_signed_in");
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
      });
    }

    return json(req, {
      payload,
      mode,
      model: result.model,
      latency_ms: Date.now() - startedAt,
    });

  } catch (e) {
    console.error(JSON.stringify({ at: "tailor", err: e instanceof Error ? e.message : String(e) }));
    if (consumed?.kind === "user") {
      try { await userClient(req.headers.get("authorization")).rpc("refund_credit_signed_in"); } catch (_) {}
    } else if (consumed?.kind === "anon") {
      try { await sb.rpc("refund_credit_anon", { fp: consumed.fp }); } catch (_) {}
    }
    return json(req, { error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
