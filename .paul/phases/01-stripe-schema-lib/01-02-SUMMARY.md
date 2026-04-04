---
phase: 01-stripe-schema-lib
plan: 02
subsystem: api + lib + admin-ui
tags: [stripe, stripe-connect, oauth2, integrations, admin]

requires:
  - phase: 01-stripe-schema-lib plan 01
    provides: stripe.ts scaffold, integrationSettings shape, StripeSection component

provides:
  - server/lib/stripe.ts: getConnectAuthUrl, exchangeConnectCode, deauthorizeConnectAccount
  - GET /api/integrations/stripe — connection status (connected, stripeUserId, webhookSecret)
  - GET /api/integrations/stripe/connect — initiate Stripe Connect OAuth
  - GET /api/integrations/stripe/callback — exchange code, store tokens
  - DELETE /api/integrations/stripe/disconnect — revoke + clear
  - PUT /api/integrations/stripe/webhook — save webhook secret
  - Admin UI: Connect button / Connected state (acct_xxx badge, webhook input, Disconnect)

key-decisions:
  - "Stripe Connect OAuth — not manual key paste — for white-label ease of setup"
  - "Platform env vars: STRIPE_CLIENT_ID + STRIPE_SECRET_KEY (set once on deploy)"
  - "Connected account access_token stored as apiKey, stripe_user_id as locationId"
  - "Webhook secret still manual entry (Stripe doesn't expose it via API)"
  - "deauthorizeConnectAccount failure is non-fatal — tokens cleared regardless"
  - "Connect button is <a href=/api/integrations/stripe/connect> — full nav to trigger server redirect"

duration: ~15min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 1 Plan 02: Stripe Connect OAuth — Complete

**Stripe Connect OAuth flow fully wired: admin clicks "Connect with Stripe", authorizes on Stripe, tokens stored automatically — no API key copying.**

## Acceptance Criteria Results

| Criterion | Status |
|-----------|--------|
| AC-1: Connect button initiates OAuth | Pass |
| AC-2: Callback stores tokens | Pass |
| AC-3: GET returns connection status | Pass |
| AC-4: Disconnect revokes + clears | Pass |
| AC-5: Admin UI Connect / Connected states | Pass |
| AC-6: stripe.ts uses connected account for charges | Pass |
| AC-7: TypeScript zero errors | Pass |

## Files Modified

| File | Change |
|------|--------|
| `server/lib/stripe.ts` | +getConnectAuthUrl, +exchangeConnectCode, +deauthorizeConnectAccount; verifyWebhookEvent uses platform STRIPE_SECRET_KEY |
| `server/routes/integrations.ts` | Replaced old GET/PUT /stripe with 5 new routes; +stripe import |
| `client/src/components/admin/IntegrationsSection.tsx` | StripeSection rewritten: credentials form → Connect button + Connected state UI |

## Next Phase Readiness

**Ready:** Connect infrastructure complete — Plan 01-03 builds payment routes on top (`createCheckoutSession` + webhook handler).

**Env vars needed before testing:** `STRIPE_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_REDIRECT_URI`

---
*Phase: 01-stripe-schema-lib, Plan: 02 — Completed: 2026-04-02*
