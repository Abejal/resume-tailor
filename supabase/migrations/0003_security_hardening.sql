-- Resume Tailor — security hardening (audit remediation).
--
-- Root problem: several SECURITY DEFINER credit/referral functions were only
-- `revoke ... from public`, which does NOT remove the EXECUTE that Supabase
-- grants to the `anon` and `authenticated` roles by default. Any client could
-- therefore call grant_credits(), refund_*(), redeem_referral_*() directly and
-- mint unlimited credits. This migration locks those down, adds an atomic
-- payment-fulfillment path (replay-safe), a service-role refund, a per-IP
-- throttle on anonymous free credits, and a once-per-user guard on the anon
-- credit merge.

-- ---------------------------------------------------------------------------
-- 1. Revoke direct client access to every credit-mutating function.
--    The edge functions call these as service_role (function owner), which
--    always retains EXECUTE regardless of these revokes.
-- ---------------------------------------------------------------------------
revoke execute on function public.grant_credits(uuid, int, int) from anon, authenticated;
revoke execute on function public.refund_credit_anon(text) from anon, authenticated;
revoke execute on function public.refund_credit_signed_in() from anon, authenticated;
revoke execute on function public.redeem_referral_on_first_purchase(uuid) from anon, authenticated;
revoke execute on function public.consume_credit_anon(text, text) from anon, authenticated;
-- consume_credit_signed_in stays callable by `authenticated` on purpose — it
-- only ever decrements the caller's OWN balance, so exposing it is harmless.

-- ---------------------------------------------------------------------------
-- 2. Service-role refund by explicit user id.
--    Replaces the edge function's use of refund_credit_signed_in() (which had
--    to run as the user and was therefore client-callable). Now the tailor
--    function refunds via the service client with an explicit id.
-- ---------------------------------------------------------------------------
create or replace function public.refund_credit_by_id(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare new_balance int;
begin
  update public.credits
     set balance = balance + 1,
         lifetime_used = greatest(lifetime_used - 1, 0),
         updated_at = now()
   where user_id = p_user_id
   returning balance into new_balance;
  return coalesce(new_balance, 0);
end;
$$;
revoke all on function public.refund_credit_by_id(uuid) from public;
revoke execute on function public.refund_credit_by_id(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Atomic, replay-safe payment fulfillment.
--    The webhook idempotency marker and the credit grant now commit together
--    in ONE transaction. If fulfillment throws, the marker rolls back too, so
--    a transient failure never permanently swallows a paid user's credits; and
--    a duplicate event_id (the ONLY idempotency key, derived server-side) is a
--    no-op. Replaces the non-atomic sequence in toyyibpay-callback.
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_payment(
  p_event_id      text,
  p_user_id       uuid,
  p_kind          text,       -- 'topup' | 'subscription'
  p_credits       int,
  p_plan          text,       -- 'monthly' | 'annual' | null
  p_monthly_quota int,
  p_amount_cents  int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_period_end timestamptz;
begin
  -- Idempotency: event_id is the webhook_events primary key.
  begin
    insert into public.webhook_events (event_id, source, payload)
    values (p_event_id, 'toyyibpay',
            jsonb_build_object('user_id', p_user_id, 'kind', p_kind, 'credits', p_credits));
  exception when unique_violation then
    return 'duplicate';
  end;

  perform public.grant_credits(
    p_user_id, p_credits,
    case when p_kind = 'topup' then null else p_monthly_quota end
  );

  insert into public.payments (user_id, chip_purchase_id, amount, currency, status, kind, credits_granted)
  values (p_user_id, p_event_id, p_amount_cents, 'myr', 'paid',
          case when p_kind = 'topup' then 'topup' else 'subscription' end, p_credits);

  if p_kind <> 'topup' then
    v_days := case when p_plan = 'annual' then 365 else 30 end;
    v_period_end := now() + (v_days || ' days')::interval;

    if exists (select 1 from public.subscriptions where user_id = p_user_id) then
      update public.subscriptions
         set plan = coalesce(p_plan, 'monthly'), status = 'active',
             current_period_end = v_period_end, cancel_at_period_end = false,
             updated_at = now()
       where user_id = p_user_id;
    else
      insert into public.subscriptions (user_id, plan, status, current_period_end)
      values (p_user_id, coalesce(p_plan, 'monthly'), 'active', v_period_end);
    end if;

    perform public.redeem_referral_on_first_purchase(p_user_id);
  end if;

  return 'ok';
end;
$$;
revoke all on function public.fulfill_payment(text, uuid, text, int, text, int, int) from public;
revoke execute on function public.fulfill_payment(text, uuid, text, int, text, int, int) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Per-IP throttle on anonymous free credits.
--    A client-chosen fingerprint can be reset (clear localStorage / incognito)
--    to mint fresh free credits. This adds a best-effort circuit breaker keyed
--    on the request IP hash so one source can't farm unlimited free generations
--    by cycling fingerprints. Deliberately GENEROUS (30 / rolling 24h) so that
--    shared/CGNAT mobile IPs — common in the target market — are not blocked;
--    it only trips on egregious scripted abuse. The durable fix remains
--    requiring authentication for credits.
-- ---------------------------------------------------------------------------
create table if not exists public.anon_ip_usage (
  ip_hash       text primary key,
  used          int not null default 0,
  window_start  timestamptz not null default now()
);
alter table public.anon_ip_usage enable row level security;
-- No policies: service-role only (the anon consume RPC runs as definer).

create or replace function public.consume_credit_anon(fp text, ip_h text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
  ip_used int;
  cap constant int := 30;                       -- max free generations / IP / window
  window_len constant interval := interval '24 hours';
begin
  -- Per-IP circuit breaker (only when we have an IP hash).
  if ip_h is not null and ip_h <> '' then
    insert into public.anon_ip_usage (ip_hash, used, window_start)
    values (ip_h, 0, now())
    on conflict (ip_hash) do update
      set used = case when public.anon_ip_usage.window_start < now() - window_len
                      then 0 else public.anon_ip_usage.used end,
          window_start = case when public.anon_ip_usage.window_start < now() - window_len
                              then now() else public.anon_ip_usage.window_start end
    returning used into ip_used;

    if ip_used >= cap then
      raise exception 'insufficient_credit' using errcode = 'P0002';
    end if;
  end if;

  -- Per-fingerprint balance (unchanged behavior).
  insert into public.anon_credits (fingerprint, balance, ip_hash)
  values (fp, 3, ip_h)
  on conflict (fingerprint) do update set last_seen = now();

  update public.anon_credits
     set balance = balance - 1, last_seen = now()
   where fingerprint = fp and balance > 0
   returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient_credit' using errcode = 'P0002';
  end if;

  -- Only count a successful consumption against the IP.
  if ip_h is not null and ip_h <> '' then
    update public.anon_ip_usage set used = used + 1 where ip_hash = ip_h;
  end if;

  return new_balance;
end;
$$;
revoke all on function public.consume_credit_anon(text, text) from public;
revoke execute on function public.consume_credit_anon(text, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Once-per-user guard on anon credit merge.
--    merge_anon_into_user() stays callable by `authenticated` (the client runs
--    it during signup), but a user may now merge at most once, so it can't be
--    replayed with harvested fingerprints to farm credits.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists anon_merged boolean not null default false;

create or replace function public.merge_anon_into_user(fp text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  anon_balance int;
  new_balance int;
  already boolean;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Guard: only allow a single merge per user, ever.
  select anon_merged into already from public.profiles where id = auth.uid();
  if coalesce(already, false) then
    select balance into new_balance from public.credits where user_id = auth.uid();
    return coalesce(new_balance, 0);
  end if;
  update public.profiles set anon_merged = true where id = auth.uid();

  select balance into anon_balance
    from public.anon_credits
   where fingerprint = fp
   for update;

  if anon_balance is null then
    select balance into new_balance from public.credits where user_id = auth.uid();
    return coalesce(new_balance, 0);
  end if;

  update public.credits
     set balance = balance + anon_balance, updated_at = now()
   where user_id = auth.uid()
  returning balance into new_balance;

  delete from public.anon_credits where fingerprint = fp;
  return coalesce(new_balance, 0);
end;
$$;
revoke all on function public.merge_anon_into_user(text) from public;
grant execute on function public.merge_anon_into_user(text) to authenticated;
