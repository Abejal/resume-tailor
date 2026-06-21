// ToyyibPay client.
// Docs: https://toyyibpay.com/apireference/
//
// ToyyibPay uses form-encoded POSTs (not JSON) and a userSecretKey on each call.
// No native subscriptions — we model them as time-boxed credit packs.
//
// Use https://dev.toyyibpay.com/ for sandbox, https://toyyibpay.com/ for live.

const BASE      = Deno.env.get("TOYYIBPAY_BASE_URL") ?? "https://toyyibpay.com";
const SECRET    = Deno.env.get("TOYYIBPAY_SECRET_KEY") ?? "";
const CATEGORY  = Deno.env.get("TOYYIBPAY_CATEGORY_CODE") ?? "";

function form(obj: Record<string, string | number | undefined>): URLSearchParams {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") f.set(k, String(v));
  }
  return f;
}

async function call<T>(path: string, body: Record<string, string | number | undefined>): Promise<T> {
  const res = await fetch(`${BASE}/index.php/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ ...body, userSecretKey: SECRET }),
  });
  const text = (await res.text()).trim();
  if (!res.ok) {
    throw new Error(`ToyyibPay ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  // ToyyibPay returns bracketed plain-text errors on misconfig (HTTP 200 body
  // like "[KEY-DID-NOT-EXIST]", "[FALSE]", "[CATEGORY-DOES-NOT-EXIST]").
  if (text.startsWith("[") && text.endsWith("]") && !text.startsWith("[{")) {
    throw new Error(`ToyyibPay error: ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`ToyyibPay returned non-JSON from ${path}: ${text.slice(0, 200)}`);
  }
}

export type CreateBillInput = {
  name: string;
  description: string;
  amountCents: number;        // we keep cents internally; ToyyibPay wants the same
  userEmail: string;
  userName: string;
  userPhone?: string;
  externalReference: string;   // our internal id (e.g. JSON of {user_id, kind, plan, credits})
  returnUrl: string;
  callbackUrl: string;
};

export async function createBill(input: CreateBillInput): Promise<{ billCode: string; url: string }> {
  if (!SECRET)   throw new Error("TOYYIBPAY_SECRET_KEY not set");
  if (!CATEGORY) throw new Error("TOYYIBPAY_CATEGORY_CODE not set");

  const result = await call<Array<{ BillCode: string }>>("createBill", {
    categoryCode:           CATEGORY,
    billName:               input.name.slice(0, 30),
    billDescription:        input.description.slice(0, 200),
    billPriceSetting:       1,                // fixed price
    billPayorInfo:          1,                // collect payer info
    billAmount:             input.amountCents,
    billReturnUrl:          input.returnUrl,
    billCallbackUrl:        input.callbackUrl,
    billExternalReferenceNo: input.externalReference.slice(0, 100),
    billTo:                 input.userName,
    billEmail:              input.userEmail,
    billPhone:              input.userPhone ?? "0000000000",
    billPaymentChannel:     2,                // 0=FPX, 1=cards, 2=both
    billContentEmail:       "Thanks for your purchase from Resume Tailor!",
    billChargeToCustomer:   1,                // pass fees to customer
  });

  if (!Array.isArray(result) || !result[0]?.BillCode) {
    throw new Error(`createBill unexpected response: ${JSON.stringify(result)}`);
  }
  const code = result[0].BillCode;
  return { billCode: code, url: `${BASE}/${code}` };
}

export type BillTxn = {
  billName: string;
  billDescription: string;
  billTo: string;
  billEmail: string;
  billPhone: string;
  billStatus: string;             // "1" = paid, "2" = pending, "3" = failed
  billPaymentStatus: string;      // "1" = success
  billpaymentAmount: string;      // ringgit (string, e.g. "29.00")
  billpaymentDate: string;
  billExternalReferenceNo: string;
  billPermalink: string;
  billPaymentInvoiceNo: string;
};

export async function getBillTransactions(billCode: string): Promise<BillTxn[]> {
  if (!SECRET) throw new Error("TOYYIBPAY_SECRET_KEY not set");
  return await call<BillTxn[]>("getBillTransactions", {
    billCode,
    billpaymentStatus: 1,
  });
}
