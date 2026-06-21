# Resume Tailor

AI-powered, ATS-optimized resume + cover letter tailoring built for the Malaysia market.

- **Free tier**: 3 lifetime credits per anonymous device — no sign-up needed.
- **Pro Monthly** (RM29 / 50 credits) and **Pro Annual** (RM290 / 600 credits) for power users.
- **Top-up** RM10 / 5 credits for one-off use.
- **FPX bank transfer** + cards via [ToyyibPay](https://toyyibpay.com) (no business registration required).
- Resume tailoring uses a **two-pass** prompt against **Google Gemini 2.5 Flash** (free tier) with a **Groq Llama 3.3 70B** fallback when rate-limited — both 100% free LLMs.
- Polished **PDF + DOCX** output (`@react-pdf/renderer` + `docx`) with Classic and Modern templates.
- **EN + Bahasa Malaysia** UI and output.
- Referral program: give-3-get-3 credits on first paid purchase.

## Tech

| Layer | Stack |
|---|---|
| Frontend | Vite, React 18, TypeScript, Tailwind, shadcn/ui, react-router, react-i18next |
| Backend | Supabase (Postgres + Auth + Edge Functions on Deno) |
| Payments | ToyyibPay (FPX + cards, individual accounts OK) |
| LLM | Google Gemini 2.5 Flash → Groq Llama 3.3 70B fallback |
| Exports | @react-pdf/renderer (PDF) + docx (Word) |

## Local development

```bash
npm install
cp .env.example .env  # fill in Supabase URL + anon key
npm run dev
```

Open http://localhost:5173.

## Backend setup

### 1. Supabase project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push      # applies supabase/migrations/0001_init.sql
npx supabase functions deploy tailor
npx supabase functions deploy toyyibpay-create-bill
npx supabase functions deploy toyyibpay-callback
```

### 2. Edge function secrets

```bash
npx supabase secrets set \
  GOOGLE_AI_API_KEY=... \
  GROQ_API_KEY=... \
  TOYYIBPAY_BASE_URL=https://dev.toyyibpay.com \
  TOYYIBPAY_SECRET_KEY=... \
  TOYYIBPAY_CATEGORY_CODE=... \
  TOYYIBPAY_PRICE_MONTHLY=2900 \
  TOYYIBPAY_PRICE_ANNUAL=29000 \
  TOYYIBPAY_PRICE_TOPUP=1000 \
  ALLOWED_ORIGIN=https://your-domain.com
```

Switch `TOYYIBPAY_BASE_URL` to `https://toyyibpay.com` when going live.

### 3. Provider keys

- **Google AI Studio**: https://aistudio.google.com/apikey → "Create API key in new project" — the project is just a Google Cloud billing container, unrelated to this codebase. Free tier: 15 req/min, 1M context.
- **Groq**: https://console.groq.com/keys → free tier, ~30 req/min on Llama 3.3 70B.
- **ToyyibPay**: see the step-by-step setup below.

### 3a. ToyyibPay step-by-step

ToyyibPay has separate sandbox and production accounts. Sandbox keys do NOT work in production and vice-versa — so start in sandbox while testing.

**Sandbox (for testing):**

1. Sign up at https://dev.toyyibpay.com (free, no SSM needed — IC + bank account is enough).
2. Dashboard → **Profile** → copy the **userSecretKey** at the bottom of the page.
   - Set it: `npx supabase secrets set TOYYIBPAY_SECRET_KEY="<paste>"`
3. Dashboard → **Category** → **Add New Category** → name it "Resume Tailor" (description optional) → Submit.
4. Copy the resulting **Category Code** (looks like `abc12xyz`).
   - Set it: `npx supabase secrets set TOYYIBPAY_CATEGORY_CODE="<paste>"`
5. Keep `TOYYIBPAY_BASE_URL=https://dev.toyyibpay.com` while in sandbox.
6. Verify all secrets: `npx supabase secrets list` — both keys should appear.
7. Test payments with ToyyibPay's sandbox FPX — no real bank charge.

**Going live:**

1. Sign up separately at https://toyyibpay.com (production account).
2. Repeat the Profile / Category steps to get a NEW secret key and category code.
3. Update the three secrets to the production values.
4. Change `TOYYIBPAY_BASE_URL=https://toyyibpay.com` (no `dev.` prefix).
5. Redeploy: `npx supabase functions deploy toyyibpay-create-bill toyyibpay-callback`.

**Common errors (now surfaced clearly in your Supabase function log):**

- `ToyyibPay error: [KEY-DID-NOT-EXIST]` — wrong `TOYYIBPAY_SECRET_KEY` for the current base URL (e.g. sandbox key against prod URL).
- `ToyyibPay error: [FALSE]` or `[CATEGORY-DOES-NOT-EXIST]` — wrong `TOYYIBPAY_CATEGORY_CODE`, or the category belongs to a different account than the secret key.

### 4. ToyyibPay callback URL

In the ToyyibPay dashboard → each bill's `billCallbackUrl` is set automatically by our code to:

```
https://<your-supabase-project>.supabase.co/functions/v1/toyyibpay-callback
```

No configuration required in the ToyyibPay dashboard.

## Architecture notes

- **Credits live in Postgres**, never in client storage. RLS + `SECURITY DEFINER` RPCs enforce that users can't mutate their own balance.
- **Anonymous fingerprint** (`x-anon-fp` header) tracks free-tier usage per device. Fingerprint is a SHA-256 of UUID + UA + screen + timezone — not reversible into a tracking signal.
- **Tailoring is two-pass**: Pass 1 extracts JD keyword tiers and maps to resume evidence. Pass 2 writes the structured tailored resume conditioned on Pass 1. Both return JSON.
- **Webhook idempotency**: ToyyibPay callbacks are re-verified server-side via `getBillTransactions` and deduped by `event_id` (billCode + invoice) in `webhook_events`.
- **Subscriptions = time-boxed credit packs**: ToyyibPay has no native recurring billing, so Pro Monthly and Pro Annual are modeled as one-time purchases that grant credits valid for 30 / 365 days. Users re-purchase when credits run out (a banner reminds them).
- **Refunds on failure**: if the LLM call errors after a credit was consumed, the credit is refunded automatically.

## Verification checklist

1. `npm run dev` → land on the app **without signing in**, see "3 credits left".
2. Generate a resume → balance drops to 2 in DB.
3. Spend all 3 → Paywall opens.
4. Sign up → anon balance merges into account credits.
5. Buy Pro Monthly via ToyyibPay → checkout shows FPX banks + cards → callback fires → `subscriptions` row created, balance = 50.
6. Tailor again → PDF + DOCX exports look polished.
7. Toggle EN/BM in header → labels translate, AI output respects language.
8. `/r/<code>` → cookie set → sign-up + first purchase grants +3 credits each side.
9. `npm run test` passes.

## Cost

Free tier covers most users:

- Gemini 2.5 Flash free tier (15 RPM, 1M context).
- Groq Llama 3.3 70B free tier (~30 RPM, 8K context).
- Supabase free tier (500 MB DB, 2 GB egress, 500K function invocations/month).
- ToyyibPay charges RM1.00 + 0% per FPX transaction (or ~3% for cards) — passed to the customer in our setup (`billChargeToCustomer: 1`).
