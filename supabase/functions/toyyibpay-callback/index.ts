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
  let statusFromBody = "";

  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    billCode       = String(body.billcode ?? body.billCode ?? "");
    statusFromBody = String(body.status ?? "");
  } else {
    const f = await req.formData();
    billCode       = String(f.get("billcode") ?? f.get("billCode") ?? "");
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

  // Idempotency key comes ONLY from server-verified data (never the request
  // body). The invoice number is the unique per-payment id from ToyyibPay.
  const invoiceNo = paid.billpaymentInvoiceNo;
  if (!invoiceNo) {
    console.error("webhook missing verified invoice no", JSON.stringify(paid).slice(0, 300));
    return new Response("missing invoice", { status: 500 });
  }
  const eventId = `${billCode}:${invoiceNo}`;

  let ref: { user_id?: string; kind?: "topup" | "monthly" | "annual"; credits?: number; plan?: "monthly" | "annual" | null } = {};
  try { ref = JSON.parse(paid.billExternalReferenceNo); } catch (_) {}
  const userId = ref.user_id;
  if (!userId) {
    console.error("webhook missing user_id in reference", paid.billExternalReferenceNo);
    return new Response("missing reference", { status: 200 });
  }

  const isTopup = ref.kind === "topup";
  const plan = ref.plan === "annual" ? "annual" : "monthly";
  const credits = ref.credits ?? 0;
  const amountCents = Math.round(parseFloat(paid.billpaymentAmount || "0") * 100);

  // Single atomic RPC: records the idempotency marker AND grants credits /
  // subscription / referral in one transaction. A duplicate event is a no-op;
  // a transient failure rolls back the marker too (so credits are never lost).
  const { data: outcome, error: fErr } = await sb.rpc("fulfill_payment", {
    p_event_id: eventId,
    p_user_id: userId,
    p_kind: isTopup ? "topup" : "subscription",
    p_credits: credits,
    p_plan: isTopup ? null : plan,
    p_monthly_quota: isTopup ? null : 50,
    p_amount_cents: amountCents,
  });

  if (fErr) {
    console.error("fulfill_payment err:", fErr);
    return new Response("fulfillment failed", { status: 500 });
  }
  if (outcome === "duplicate") return new Response("ok (dup)", { status: 200 });
  return new Response("ok", { status: 200 });
});
