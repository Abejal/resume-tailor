// Create a ToyyibPay bill for a top-up or a subscription credit pack.
//
// Subscriptions are modeled as time-boxed credit packs because ToyyibPay has
// no true recurring API. When `plan` is "monthly"/"annual", we also record a
// `subscriptions` row with a 30/365-day window so the UI can show "Pro until …".

import { preflight, json } from "../_shared/cors.ts";
import { getUserIdFromJwt, serviceClient } from "../_shared/supabase.ts";
import { createBill } from "../_shared/toyyibpay.ts";

type Kind = "topup" | "monthly" | "annual";

const PRICE_TOPUP   = parseInt(Deno.env.get("TOYYIBPAY_PRICE_TOPUP")   ?? "1000",  10);
const PRICE_MONTHLY = parseInt(Deno.env.get("TOYYIBPAY_PRICE_MONTHLY") ?? "2900",  10);
const PRICE_ANNUAL  = parseInt(Deno.env.get("TOYYIBPAY_PRICE_ANNUAL")  ?? "29000", 10);

const PRODUCTS: Record<Kind, { name: string; description: string; price: number; credits: number; planDb: "monthly" | "annual" | null }> = {
  topup:   { name: "Resume Tailor Top-up",     description: "5 AI-tailoring credits", price: PRICE_TOPUP,   credits: 5,   planDb: null },
  monthly: { name: "Resume Tailor Pro Monthly",description: "50 credits valid 30 days", price: PRICE_MONTHLY, credits: 50,  planDb: "monthly" },
  annual:  { name: "Resume Tailor Pro Annual", description: "600 credits valid 365 days", price: PRICE_ANNUAL, credits: 600, planDb: "annual" },
};

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const userId = await getUserIdFromJwt(req.headers.get("authorization"));
    if (!userId) return json(req, { error: "auth_required" }, 401);

    const body = await req.json().catch(() => ({})) as { kind?: Kind; origin?: string };
    const kind = body.kind ?? "topup";
    if (!(kind in PRODUCTS)) return json(req, { error: "invalid_kind" }, 400);

    const product = PRODUCTS[kind];
    const baseUrl = body.origin || req.headers.get("origin") || "";
    const sb = serviceClient();

    const { data: profile } = await sb
      .from("profiles")
      .select("email,full_name")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email) return json(req, { error: "profile_missing" }, 400);

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/toyyibpay-callback`;
    const reference = JSON.stringify({
      user_id: userId,
      kind,
      credits: product.credits,
      plan: product.planDb,
    });

    const bill = await createBill({
      name: product.name,
      description: product.description,
      amountCents: product.price,
      userEmail: profile.email,
      userName: profile.full_name ?? profile.email.split("@")[0],
      externalReference: reference,
      returnUrl: `${baseUrl}/billing?paid=${kind}`,
      callbackUrl,
    });

    return json(req, { url: bill.url, bill_code: bill.billCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("toyyibpay-create-bill:", msg);
    if (msg.startsWith("ToyyibPay")) {
      return json(req, { error: "toyyibpay_misconfigured", detail: msg }, 502);
    }
    return json(req, { error: msg }, 500);
  }
});
