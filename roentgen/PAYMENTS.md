# Payments (Stripe + Vercel KV)

The paywall unlocks a single AI analysis per paid token. Flow:

1. Client generates `unlockToken` (UUID), stores pending receipt in `localStorage`.
2. `POST /api/checkout` with `{unlockToken, module}` → returns Stripe Checkout URL.
3. Browser → Stripe → back to `?unlock=<token>&status=ok`.
4. Stripe webhook (`POST /api/stripe-webhook`) writes `{paid:true, module}` into Vercel KV.
5. Client polls `GET /api/unlock/:token` → once paid, marks local receipt paid and dispatches the analysis.
6. `POST /api/analyze` requires `x-unlock-token` header → server validates against KV, forwards to Anthropic, burns the token.

## One-time setup

### Stripe
1. Create 3 Products in the Stripe Dashboard (test mode is fine):
   - **Personal analysis** — recurring: off, price: €3 → copy `price_…` → `STRIPE_PRICE_PROFILES`
   - **Relationship analysis** — price: €3 → `STRIPE_PRICE_RELATIONSHIP`
   - **Bundle** — price: €5 → `STRIPE_PRICE_BUNDLE`
2. Developers → API keys → copy secret key → `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → + Add endpoint → `https://<your-domain>/api/stripe-webhook`, event: `checkout.session.completed` → copy signing secret → `STRIPE_WEBHOOK_SECRET`.

### Vercel
1. Connect the repo.
2. Storage → KV → Create. Attach to project. Vercel auto-populates `KV_*` env vars.
3. Project Settings → Env Vars — paste `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (all Production + Preview scopes).

## Local testing

Vite dev server (`npm run dev`) still serves `/api/analyze` via the Vite plugin — no token check, free usage for UI work. The Stripe endpoints only exist on Vercel, so for an end-to-end local test:

```sh
npm install -g vercel
vercel link
vercel env pull .env.development.local
vercel dev          # serves both Vite and the api/ functions on :3000
```

Forward Stripe webhooks to local:

```sh
stripe listen --forward-to localhost:3000/api/stripe-webhook
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET in .env.development.local
```

Use test card `4242 4242 4242 4242`, any future expiry, any CVC.

## Production deploy

```sh
vercel --prod
```

After the first production webhook test, confirm in Stripe Dashboard → Webhooks → your endpoint shows a 200 delivery and in Vercel KV Browser that the key `unlock:<token>` was written.
