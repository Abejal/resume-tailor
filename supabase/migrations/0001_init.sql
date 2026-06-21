-- Resume Tailor — initial schema
-- Tables, RLS, RPCs, triggers.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text,
  locale          text not null default 'en' check (locale in ('en', 'ms')),
  referral_code   text unique not null default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  referred_by     uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_self_select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_self_update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- credits  (one row per signed-in user)
-- ---------------------------------------------------------------------------
create table public.credits (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  balance          int not null default 0 check (balance >= 0),
  lifetime_used    int not null default 0,
  monthly_quota    int not null default 0,
  updated_at       timestamptz not null default now()
);

alter table public.credits enable row level security;

create policy "credits_self_select"
  on public.credits for select
  using (auth.uid() = user_id);

-- mutations only via SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------------
-- anon_credits  (one row per anonymous device fingerprint)
-- ---------------------------------------------------------------------------
create table public.anon_credits (
  fingerprint    text primary key,
  balance        int not null default 3 check (balance >= 0),
  ip_hash        text,
  last_seen      timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.anon_credits enable row level security;
-- service role only.

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  chip_customer_id        text,
  chip_subscription_id    text unique,
  plan                    text not null check (plan in ('monthly', 'annual')),
  status                  text not null default 'active'
                          check (status in ('active', 'past_due', 'cancelled', 'paused')),
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

create policy "subscriptions_self_select"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- generations  (history)
-- ---------------------------------------------------------------------------
create table public.generations (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete cascade,
  anon_fingerprint    text,
  mode                text not null check (mode in ('resume', 'cover_letter')),
  job_title           text,
  company             text,
  jd_hash             text,
  payload             jsonb not null,
  ats_score           int,
  created_at          timestamptz not null default now()
);

create index generations_user_id_created_idx
  on public.generations(user_id, created_at desc);

alter table public.generations enable row level security;

create policy "generations_self_select"
  on public.generations for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references public.profiles(id) on delete set null,
  chip_purchase_id    text unique not null,
  amount              int not null,
  currency            text not null default 'myr',
  status              text not null,
  kind                text not null check (kind in ('topup', 'subscription', 'renewal')),
  credits_granted     int not null default 0,
  created_at          timestamptz not null default now()
);

create index payments_user_id_idx on public.payments(user_id);

alter table public.payments enable row level security;

create policy "payments_self_select"
  on public.payments for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
create table public.referrals (
  referee_id     uuid primary key references public.profiles(id) on delete cascade,
  referrer_id    uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'pending'
                 check (status in ('pending', 'credited', 'expired')),
  credited_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index referrals_referrer_idx on public.referrals(referrer_id);

alter table public.referrals enable row level security;

create policy "referrals_self_select"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- ---------------------------------------------------------------------------
-- webhook idempotency
-- ---------------------------------------------------------------------------
create table public.webhook_events (
  event_id     text primary key,
  source       text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now()
);
alter table public.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Trigger: when a new auth user is created, provision profile + credits.
-- Honors a `referral_code` in user metadata to link referrals.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
  referrer uuid;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into public.credits (user_id, balance)
  values (new.id, 3);

  ref_code := lower(coalesce(new.raw_user_meta_data ->> 'referral_code', ''));
  if ref_code <> '' then
    select id into referrer from public.profiles where referral_code = ref_code and id <> new.id;
    if referrer is not null then
      update public.profiles set referred_by = referrer where id = new.id;
      insert into public.referrals (referee_id, referrer_id) values (new.id, referrer);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: consume_credit_signed_in
-- Atomically decrements caller's credit balance; returns the new balance.
-- Raises insufficient_credit if balance <= 0.
-- ---------------------------------------------------------------------------
create or replace function public.consume_credit_signed_in()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.credits
     set balance = balance - 1,
         lifetime_used = lifetime_used + 1,
         updated_at = now()
   where user_id = auth.uid() and balance > 0
   returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient_credit' using errcode = 'P0002';
  end if;

  return new_balance;
end;
$$;

revoke all on function public.consume_credit_signed_in() from public;
grant execute on function public.consume_credit_signed_in() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: consume_credit_anon (service-role only, called from edge function)
-- ---------------------------------------------------------------------------
create or replace function public.consume_credit_anon(fp text, ip_h text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance int;
begin
  insert into public.anon_credits (fingerprint, balance, ip_hash)
  values (fp, 3, ip_h)
  on conflict (fingerprint) do update set last_seen = now();

  update public.anon_credits
     set balance = balance - 1,
         last_seen = now()
   where fingerprint = fp and balance > 0
   returning balance into new_balance;

  if new_balance is null then
    raise exception 'insufficient_credit' using errcode = 'P0002';
  end if;

  return new_balance;
end;
$$;

revoke all on function public.consume_credit_anon(text, text) from public;

-- ---------------------------------------------------------------------------
-- RPC: refund_credit_signed_in  (used when AI call fails after consuming)
-- ---------------------------------------------------------------------------
create or replace function public.refund_credit_signed_in()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare new_balance int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.credits
     set balance = balance + 1,
         lifetime_used = greatest(lifetime_used - 1, 0),
         updated_at = now()
   where user_id = auth.uid()
   returning balance into new_balance;
  return new_balance;
end;
$$;

revoke all on function public.refund_credit_signed_in() from public;
grant execute on function public.refund_credit_signed_in() to authenticated;

create or replace function public.refund_credit_anon(fp text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare new_balance int;
begin
  update public.anon_credits
     set balance = balance + 1, last_seen = now()
   where fingerprint = fp
   returning balance into new_balance;
  return coalesce(new_balance, 0);
end;
$$;
revoke all on function public.refund_credit_anon(text) from public;

-- ---------------------------------------------------------------------------
-- RPC: grant_credits (called by webhook handler via service role)
-- Idempotency is enforced at the webhook layer via webhook_events.
-- ---------------------------------------------------------------------------
create or replace function public.grant_credits(p_user_id uuid, p_amount int, p_monthly_quota int default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare new_balance int;
begin
  insert into public.credits (user_id, balance, monthly_quota)
  values (p_user_id, p_amount, coalesce(p_monthly_quota, 0))
  on conflict (user_id) do update
    set balance = public.credits.balance + p_amount,
        monthly_quota = coalesce(p_monthly_quota, public.credits.monthly_quota),
        updated_at = now()
  returning balance into new_balance;
  return new_balance;
end;
$$;
revoke all on function public.grant_credits(uuid, int, int) from public;

-- ---------------------------------------------------------------------------
-- RPC: merge_anon_into_user (run during signup)
-- Adds the device's remaining anon credits to the user's balance, then deletes.
-- ---------------------------------------------------------------------------
create or replace function public.merge_anon_into_user(fp text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  anon_balance int;
  new_balance int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select balance into anon_balance
    from public.anon_credits
   where fingerprint = fp
   for update;

  if anon_balance is null then
    select balance into new_balance from public.credits where user_id = auth.uid();
    return coalesce(new_balance, 0);
  end if;

  update public.credits
     set balance = balance + anon_balance,
         updated_at = now()
   where user_id = auth.uid()
  returning balance into new_balance;

  delete from public.anon_credits where fingerprint = fp;
  return coalesce(new_balance, 0);
end;
$$;
revoke all on function public.merge_anon_into_user(text) from public;
grant execute on function public.merge_anon_into_user(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: redeem_referral_on_first_purchase
-- Called by webhook handler when a user makes their first paid purchase.
-- Grants 3 credits to referrer and 3 to referee. Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_referral_on_first_purchase(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  select * into rec
    from public.referrals
   where referee_id = p_user_id and status = 'pending'
   for update;

  if not found then return; end if;

  perform public.grant_credits(rec.referrer_id, 3, null);
  perform public.grant_credits(rec.referee_id,  3, null);

  update public.referrals
     set status = 'credited', credited_at = now()
   where referee_id = p_user_id;
end;
$$;
revoke all on function public.redeem_referral_on_first_purchase(uuid) from public;

-- ---------------------------------------------------------------------------
-- View: my_credits  (convenience for the client)
-- ---------------------------------------------------------------------------
create or replace view public.my_credits with (security_invoker = true) as
  select user_id, balance, lifetime_used, monthly_quota, updated_at
    from public.credits
   where user_id = auth.uid();
