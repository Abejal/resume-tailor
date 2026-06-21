const ALLOWED = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED === "*" || ALLOWED.split(",").map(s => s.trim()).includes(origin)
    ? (origin || "*")
    : ALLOWED.split(",")[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-anon-fp",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  return null;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}
