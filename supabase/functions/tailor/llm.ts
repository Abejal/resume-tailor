// LLM router with multi-key + multi-provider fallback.
//
// Attempt order (each only added if its key is present in the env):
//   Gemini key 1..3  ->  OpenRouter  ->  Groq
// Each key/provider is its own attempt; on a recoverable error we roll to the
// next. Multiple Gemini keys each carry their OWN free-tier quota, so one
// hitting "limit: 0" / 429 no longer takes the whole app down.
//
// Secrets (all optional except the first — set only what you have):
//   GOOGLE_AI_API_KEY        primary Gemini key
//   GOOGLE_AI_API_KEY_2/_3   extra Gemini keys (different Google accounts)
//   GEMINI_MODEL             default "gemini-2.5-flash" (2.0-flash has no free quota on some keys)
//   OPENROUTER_API_KEY       OpenRouter key (one key, many models)
//   OPENROUTER_MODEL         default "google/gemini-2.0-flash-exp:free"
//   GROQ_API_KEY             Groq key (final fallback)

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export type LLMResult = {
  text: string;
  model: string;
  usage?: { input?: number; output?: number };
};

class LLMError extends Error {
  constructor(public code: "rate_limit" | "server" | "auth" | "bad_request" | "unknown",
              public provider: string, message: string) {
    super(message);
  }
}

type Opts = { json: boolean; temperature?: number };

function mapStatus(status: number): LLMError["code"] {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server";
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "auth";
  return "unknown";
}

// ----- Gemini ------------------------------------------------------------
async function callGemini(messages: Msg[], opts: Opts, key: string, model: string): Promise<LLMResult> {
  const system = messages.find(m => m.role === "system")?.content;
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: 8192,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`gemini ${res.status} (model=${model}): ${t.slice(0, 300)}`);
    throw new LLMError(mapStatus(res.status), "gemini", t);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  if (!text) throw new LLMError("server", "gemini", "empty response");

  return {
    text,
    model,
    usage: {
      input: data?.usageMetadata?.promptTokenCount,
      output: data?.usageMetadata?.candidatesTokenCount,
    },
  };
}

// ----- OpenAI-compatible (OpenRouter / Groq) -----------------------------
async function callOpenAICompatible(
  messages: Msg[], opts: Opts, cfg: { url: string; key: string; model: string; provider: string; extraHeaders?: Record<string, string> },
): Promise<LLMResult> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: 8192,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cfg.key}`,
      ...(cfg.extraHeaders ?? {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`${cfg.provider} ${res.status} (model=${cfg.model}): ${t.slice(0, 300)}`);
    throw new LLMError(mapStatus(res.status), cfg.provider, t);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new LLMError("server", cfg.provider, "empty response");

  return {
    text,
    model: cfg.model,
    usage: { input: data?.usage?.prompt_tokens, output: data?.usage?.completion_tokens },
  };
}

// ----- Provider chain ----------------------------------------------------
type Provider = { name: string; family: "gemini" | "openrouter" | "groq"; fn: () => Promise<LLMResult> };

function buildProviders(messages: Msg[], o: Opts): Provider[] {
  const providers: Provider[] = [];

  const geminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const geminiKeys = [
    Deno.env.get("GOOGLE_AI_API_KEY"),
    Deno.env.get("GOOGLE_AI_API_KEY_2"),
    Deno.env.get("GOOGLE_AI_API_KEY_3"),
  ].filter((k): k is string => !!k);
  geminiKeys.forEach((k, i) => {
    providers.push({
      name: `gemini#${i + 1}`,
      family: "gemini",
      fn: () => callGemini(messages, o, k, geminiModel),
    });
  });

  const orKey = Deno.env.get("OPENROUTER_API_KEY");
  if (orKey) {
    const orModel = Deno.env.get("OPENROUTER_MODEL") ?? "google/gemini-2.0-flash-exp:free";
    providers.push({
      name: "openrouter",
      family: "openrouter",
      fn: () => callOpenAICompatible(messages, o, {
        url: "https://openrouter.ai/api/v1/chat/completions",
        key: orKey, model: orModel, provider: "openrouter",
        extraHeaders: {
          "HTTP-Referer": Deno.env.get("APP_URL") ?? "https://resume-tailor-sepia.vercel.app",
          "X-Title": "Resume Tailor",
        },
      }),
    });
  }

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (groqKey) {
    providers.push({
      name: "groq",
      family: "groq",
      fn: () => callOpenAICompatible(messages, o, {
        url: "https://api.groq.com/openai/v1/chat/completions",
        key: groqKey, model: "llama-3.3-70b-versatile", provider: "groq",
      }),
    });
  }

  return providers;
}

// ----- Public API --------------------------------------------------------
export async function callLLM(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number; noFallback?: boolean } = {},
): Promise<LLMResult> {
  const o: Opts = { json: opts.json ?? false, temperature: opts.temperature };

  let providers = buildProviders(messages, o);
  if (providers.length === 0) throw new Error("No LLM providers configured");

  // noFallback (best-effort callers like the critique pass): only rotate among
  // Gemini keys — each has free quota — never spend the shared OpenRouter/Groq
  // budget that user-facing generations depend on.
  if (opts.noFallback) {
    const geminiOnly = providers.filter(p => p.family === "gemini");
    providers = geminiOnly.length ? geminiOnly : providers.slice(0, 1);
  }

  let lastErr: unknown;
  for (const p of providers) {
    try {
      return await p.fn();
    } catch (e) {
      lastErr = e;
      if (e instanceof LLMError &&
          (e.code === "rate_limit" || e.code === "server" || e.code === "auth" || e.code === "bad_request")) {
        console.warn(`LLM ${p.name} ${e.code}: ${e.message.slice(0, 200)} -- trying next`);
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("all LLM providers failed");
}

export { LLMError };
