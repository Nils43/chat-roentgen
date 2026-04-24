# Credits system — setup

Migration away from per-analysis unlock tokens → user accounts with a credits balance. Google sign-in (one tap, no SMS provider needed), Stripe packs top up credits, AI calls decrement.

## 1. Supabase

### 1a. Create project (once)

Europe region (Frankfurt) for GDPR. Write down:

| Field | Where | Goes into |
|---|---|---|
| Project URL | Settings → API | `VITE_SUPABASE_URL` |
| `anon` / `publishable` key | Settings → API | `VITE_SUPABASE_ANON_KEY` |
| `service_role` / `secret` key | Settings → API | `SUPABASE_SERVICE_ROLE_KEY` (**server only**) |

### 1b. Enable Google OAuth

**In Google Cloud Console** (https://console.cloud.google.com):

1. Create a project (or pick existing) → **APIs & Services → OAuth consent screen**
   - User type: **External** → save
   - App name, user support email, developer email — fill in
   - Scopes: leave default (email, profile, openid)
   - Publish app (otherwise only test users can sign in)
2. **Credentials → + Create Credentials → OAuth Client ID**
   - Type: **Web application**
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (dev)
     - `https://<your-domain>.vercel.app` (prod)
   - **Authorized redirect URIs** — one entry, from Supabase:
     - `https://<project>.supabase.co/auth/v1/callback`
     - (Supabase → Auth → Providers → Google shows this exact URL — copy it)
   - Create → copy **Client ID** + **Client Secret**

**In Supabase**:

Authentication → **Sign In / Up** → **Google** → Enable → paste Client ID + Secret → Save.

Authentication → **URL Configuration** → add to **Redirect URLs**:
- `http://localhost:5173`
- `https://<your-domain>.vercel.app`

Set **Site URL** to your production URL (or localhost during dev).

### 1c. Schema

Supabase → SQL Editor → **New query** → paste and **Run**:

```sql
-- One row per paying user. Keyed on the Supabase auth user id.
create table if not exists public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
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
  insert into public.accounts (id, email)
  values (new.id, new.email)
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

-- Sync the auth.users email into public.accounts on every sign-in. The
-- handle_new_user trigger only fires on INSERT, so users who start anonymous
-- and later link Google via linkIdentity never get their email copied over
-- (auth.users UPDATE doesn't re-trigger INSERT handlers). The client calls
-- this RPC on every SIGNED_IN event to keep the row in sync.
create or replace function public.ensure_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return; end if;

  select email into v_email from auth.users where id = v_user_id;

  insert into public.accounts (id, email)
    values (v_user_id, v_email)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.accounts.email);
end;
$$;

grant execute on function public.ensure_account() to authenticated;
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
