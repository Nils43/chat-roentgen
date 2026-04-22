# Credits system — setup

Migration away from per-analysis unlock tokens → phone-authed user accounts with a credits balance. Phone-only sign-in (no email), Stripe packs top up credits, AI calls decrement.

## 1. Supabase

### 1a. Create project (once)

Europe region (Frankfurt) for GDPR. Write down:

| Field | Where | Goes into |
|---|---|---|
| Project URL | Settings → API | `VITE_SUPABASE_URL` |
| `anon` / `publishable` key | Settings → API | `VITE_SUPABASE_ANON_KEY` |
| `service_role` / `secret` key | Settings → API | `SUPABASE_SERVICE_ROLE_KEY` (**server only**) |

### 1b. Enable Phone Auth

Authentication → Providers → **Phone** → Enable.

Pick an SMS provider. Cheapest reliable path: **Twilio**. Register at twilio.com, create a Messaging Service, paste:

- Twilio Account SID
- Twilio Auth Token
- Twilio Messaging Service SID (looks like `MG…`)

into Supabase Phone provider settings. Save.

Optional: under **Auth → Rate Limits**, cap SMS per hour (e.g. 10/IP). Twilio bills per SMS; abuse can run up a bill.

### 1c. Schema

Supabase → SQL Editor → **New query** → paste and **Run**:

```sql
-- One row per paying user. Keyed on the Supabase auth user id.
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

-- Ledger of every grant / spend. Immutable append-only log.
create type public.txn_kind as enum ('purchase', 'spend', 'refund', 'grant');

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  delta integer not null,                -- signed: +3 for a 3-pack, -1 for a spend
  kind public.txn_kind not null,
  stripe_session_id text unique,         -- idempotency for webhook
  note text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_account_idx
  on public.transactions (account_id, created_at desc);

-- Automatic account row on signup. Fired by the Supabase auth webhook-trigger.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.accounts (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: users can only read their own account + transactions.
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

create policy "own account readable"
  on public.accounts for select
  using (auth.uid() = id);

create policy "own transactions readable"
  on public.transactions for select
  using (auth.uid() = account_id);

-- Credit-decrement RPC. Called by the analyze API after auth check.
-- Runs with SECURITY DEFINER so the user can't bypass the balance check.
create or replace function public.spend_credit(p_account uuid, p_note text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  select credits into current_balance from public.accounts
    where id = p_account for update;
  if current_balance is null or current_balance <= 0 then
    return false;
  end if;
  update public.accounts set credits = credits - 1 where id = p_account;
  insert into public.transactions (account_id, delta, kind, note)
    values (p_account, -1, 'spend', p_note);
  return true;
end;
$$;

-- Grant credits RPC. Called by stripe webhook on successful checkout.
-- Idempotent on stripe_session_id.
create or replace function public.grant_credits(
  p_account uuid,
  p_delta integer,
  p_session_id text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Already processed? Then skip silently.
  if exists (select 1 from public.transactions where stripe_session_id = p_session_id) then
    return false;
  end if;
  insert into public.transactions (account_id, delta, kind, stripe_session_id, note)
    values (p_account, p_delta, 'purchase', p_session_id, p_note);
  update public.accounts set credits = credits + p_delta where id = p_account;
  return true;
end;
$$;
```

## 2. Stripe

Test mode first. Dashboard → Products → + Add product (×3):

| Name | Price | Env var |
|---|---|---|
| 1 Credit | €3.00 one-time | `STRIPE_PRICE_PACK_1` |
| 3 Credits | €7.00 one-time | `STRIPE_PRICE_PACK_3` |
| 10 Credits | €18.00 one-time | `STRIPE_PRICE_PACK_10` |

For each: click the `…` menu next to the price → **Copy price ID** (looks like `price_1…`).

## 3. Vercel env vars

Production + Preview:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...            ← after first deploy
STRIPE_PRICE_PACK_1=price_...
STRIPE_PRICE_PACK_3=price_...
STRIPE_PRICE_PACK_10=price_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://XXX.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
VITE_ROENTGEN_ANALYZER=api
```

## 4. Stripe webhook

After first deploy, Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://<your-domain>.vercel.app/api/stripe-webhook`
- Event: `checkout.session.completed`
- Copy signing secret (`whsec_…`) into Vercel env as `STRIPE_WEBHOOK_SECRET`, then redeploy.
