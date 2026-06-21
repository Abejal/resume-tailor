// ToyyibPay callback handler.
//
// ToyyibPay POSTs form data when a bill changes status. There's no signature,
// so we re-verify against ToyyibPay's API server-side before granting anything.
// Idempotency is enforced by `webhook_events.event_id` = billCode + paymentInvoiceNo.

import { serviceClient } from "../_shared/supabase.ts";
import { getBillTransactions } from "../_shared/toyyibpay.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const ct = req.headers.get("content-type") ?? "";
  let billCode = "";
  let refNo = "";
  let statusFromBody = "";

  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    billCode      = String(body.billcode ?? body.billCode ?? "");
    refNo         = String(body.refno ?? "");
    statusFromBody = String(body.status ?? "");
  } else {
    const f = await req.formData();
    billCode      = String(f.get("billcode") ?? f.get("billCode") ?? "");
    refNo         = String(f.get("refno") ?? "");
    statusFromBody = String(f.get("status") ?? "");
  }

  if (!billCode) return new Response("missing billcode", { status: 400 });
  if (statusFromBody !== "1") {
    return new Response("ok (not paid)", { status: 200 });
  }

  const sb = serviceClient();

  // Verify against ToyyibPay before doing anything.
  let txns;
  try { txns = await getBillTransactions(billCode); }
  catch (e) { console.error("verify err:", e); return new Response("verify failed", { status: 500 }); }

  const paid = txns.find(t => t.billpaymentStatus === "1");
  if (!paid) return new Response("ok (no paid txn)", { status: 200 });

  const eventId = `${billCode}:${paid.billPaymentInvoiceNo || refNo}`;

  // Idempotency.
  const { error: insErr } = await sb
    .from("webhook_events")
    .insert({ event_id: eventId, source: "toyyibpay", payload: { billCode, ...paid } });

  if (insErr) {
    if ((insErr as any).code === "23505") return new Response("ok (dup)", { status: 200 });
    console.error("webhook insert err:", insErr);
    return new Response("db error", { status: 500 });
  }

  let ref: { user_id?: string; kind?: "topup" | "monthly" | "annual"; credits?: number; plan?: "monthly" | "annual" | null } = {};
  try { ref = JSON.parse(paid.billExternalReferenceNo); } catch (_) {}
  const userId = ref.user_id;
  if (!userId) {
    console.error("webhook missing user_id in reference", paid.billExternalReferenceNo);
    return new Response("missing reference", { status: 200 });
  }

  const credits = ref.credits ?? 0;
  const amountCents = Math.round(parseFloat(paid.billpaymentAmount || "0") * 100);

  try {
    // Top-up: just grant credits.
    if (ref.kind === "topup") {
      await sb.rpc("grant_credits", { p_user_id: userId, p_amount: credits, p_monthly_quota: null });
      await sb.from("payments").insert({
        user_id: userId,
        chip_purchase_id: eventId,
        amount: amountCents, currency: "myr", status: "paid",
        kind: "topup", credits_granted: credits,
      });
    } else {
      // Subscription pack: grant credits + create/extend subscriptions row.
      const plan = ref.plan === "annual" ? "annual" : "monthly";
      const days = plan === "annual" ? 365 : 30;
      const periodEnd = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
      const monthlyQuota = plan === "annual" ? 50 : 50;

      await sb.rpc("grant_credits", { p_user_id: userId, p_amount: credits, p_monthly_quota: monthlyQuota });

      const { data: existing } = await sb.from("subscriptions")
        .select("id").eq("user_id", userId).maybeSingle();
      if (existing) {
        await sb.from("subscriptions").update({
          plan, status: "active",
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await sb.from("subscriptions").insert({
          user_id: userId, plan, status: "active",
          current_period_end: periodEnd,
        });
      }

      await sb.from("payments").insert({
        user_id: userId, chip_purchase_id: eventId,
        amount: amountCents, currency: "myr", status: "paid",
        kind: "subscription", credits_granted: credits,
      });

      await sb.rpc("redeem_referral_on_first_purchase", { p_user_id: userId });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook handler err:", e);
    return new Response("err", { status: 500 });
  }
});
