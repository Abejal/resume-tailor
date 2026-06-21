import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

export function serviceClient(): SupabaseClient {
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(authHeader: string | null): SupabaseClient {
  return createClient(URL, ANON, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getUserIdFromJwt(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const sb = userClient(authHeader);
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}
