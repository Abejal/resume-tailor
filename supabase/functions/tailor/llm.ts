// LLM router: Gemini 2.5 Flash (primary) -> Groq Llama 3.3 70B (fallback).
// Both providers return { text, model, usage }.

export type Msg = { role: "system" | "user" | "assistant"; content: string };

export type LLMResult = {
  text: string;
  model: string;
  usage?: { input?: number; output?: number };
};

const GOOGLE_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
const GROQ_KEY   = Deno.env.get("GROQ_API_KEY");

class LLMError extends Error {
  constructor(public code: "rate_limit" | "server" | "auth" | "bad_request" | "unknown",
              public provider: string, message: string) {
    super(message);
  }
}

// ----- Gemini ------------------------------------------------------------
async function callGemini(messages: Msg[], opts: { json: boolean; temperature?: number }): Promise<LLMResult> {
  if (!GOOGLE_KEY) throw new LLMError("auth", "gemini", "GOOGLE_AI_API_KEY not set");

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

  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new LLMError("rate_limit", "gemini", t);
    if (res.status >= 500) throw new LLMError("server", "gemini", t);
    if (res.status === 400) throw new LLMError("bad_request", "gemini", t);
    if (res.status === 401 || res.status === 403) throw new LLMError("auth", "gemini", t);
    throw new LLMError("unknown", "gemini", t);
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

// ----- Groq --------------------------------------------------------------
async function callGroq(messages: Msg[], opts: { json: boolean; temperature?: number }): Promise<LLMResult> {
  if (!GROQ_KEY) throw new LLMError("auth", "groq", "GROQ_API_KEY not set");

  const model = "llama-3.3-70b-versatile";
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: 8192,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new LLMError("rate_limit", "groq", t);
    if (res.status >= 500) throw new LLMError("server", "groq", t);
    if (res.status === 401 || res.status === 403) throw new LLMError("auth", "groq", t);
    throw new LLMError("unknown", "groq", t);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new LLMError("server", "groq", "empty response");

  return {
    text,
    model,
    usage: { input: data?.usage?.prompt_tokens, output: data?.usage?.completion_tokens },
  };
}

// ----- Public API --------------------------------------------------------
export async function callLLM(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number } = {},
): Promise<LLMResult> {
  const o = { json: opts.json ?? false, temperature: opts.temperature };

  const providers: Array<{ name: string; fn: () => Promise<LLMResult> }> = [
    { name: "gemini", fn: () => callGemini(messages, o) },
    { name: "groq",   fn: () => callGroq(messages, o) },
  ];

  let lastErr: unknown;
  for (const p of providers) {
    try {
      return await p.fn();
    } catch (e) {
      lastErr = e;
      if (e instanceof LLMError && (e.code === "rate_limit" || e.code === "server" || e.code === "auth")) {
        console.warn(`LLM ${p.name} ${e.code}: trying fallback`);
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("all LLM providers failed");
}

export { LLMError };
