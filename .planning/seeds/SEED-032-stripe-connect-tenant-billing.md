---
id: SEED-032
status: shipped
shipped_in: v19.0 Stripe Connect Onboarding (Phases 63–64, payment routing deferred to v20.0)
shipped_at: 2026-05-15
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when migrating to Xkedule multi-tenant — first tenant that needs to receive online payments from their own customers
scope: Large
---

# SEED-032: Stripe Connect — tenant connects their Stripe account via OAuth (plug & play)

## Why This Matters

Today Skleanings has Stripe integrated with a single API key (the current owner's). When it becomes Xkedule multi-tenant, **each tenant needs to receive payments from their own customers in THEIR Stripe account** — not in Xkedule's account.

The solution is **Stripe Connect with OAuth**: tenant clicks "Connect Stripe" in admin → is redirected to Stripe → authorizes Xkedule → returns with tokens stored in the database. From that point, all checkouts from that tenant's customers are created in the tenant's Stripe account via the `stripeAccount` parameter.

**Why:** Without Stripe Connect, the end customers' money would land in Xkedule's account and would have to be manually transferred — legally unviable (Xkedule isn't a payment processor), fiscally (tenant's invoice can't be issued on Xkedule revenue), and operationally. Stripe Connect solves all of this in plug-and-play fashion.

This is a billing flow **completely separate** from SEED-014 (Xkedule charging tenants). Here it's tenant charging end customers.

## When to Surface

**Trigger:** when planning the Skleanings → Xkedule multi-tenant migration (SEED-013), because the current payment system must be refactored to Stripe Connect before the second tenant exists.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule SaaS milestone (together with SEED-013)
- Payments / finance milestone
- Before the first second paying tenant

## Scope Estimate

**Large** — A complete phase. Components:

1. **Schema:**
   - `tenantStripeConnections` (tenantId FK unique, stripeAccountId, accessToken, refreshToken, scope, livemode, chargesEnabled, payoutsEnabled, detailsSubmitted, connectedAt, lastSyncedAt)
   - Migration: remove Stripe API key from `integrationSettings` (was global) — now each tenant has their own connection

2. **OAuth flow:**
   - `GET /api/admin/integrations/stripe/connect` — generates Stripe Connect authorization URL and redirects
   - `GET /api/admin/integrations/stripe/callback` — receives `code`, exchanges for access token via `stripe.oauth.token`, saves to `tenantStripeConnections`
   - `POST /api/admin/integrations/stripe/disconnect` — calls `stripe.oauth.deauthorize` and removes tokens
   - Sync: `GET /api/admin/integrations/stripe/account` — calls `stripe.accounts.retrieve(stripeAccountId)` to refresh status of `chargesEnabled` etc.

3. **Checkout refactor:**
   - `POST /api/payments/create-session` — previously used global API key; now accepts the tenant from middleware, fetches `tenantStripeConnections`, creates session with `{ stripeAccount: connection.stripeAccountId }`
   - Webhook handler — now processes events from multiple connected accounts; use `event.account` to identify the tenant

4. **Admin UI:**
   - "Payments" section with large "Connect Stripe" button if not connected
   - If connected: shows account ID, status (chargesEnabled, payoutsEnabled), "Reconnect" and "Disconnect" buttons
   - Banner if `detailsSubmitted = false` (needs to complete Stripe onboarding)

5. **Booking flow guard:**
   - If tenant doesn't have Stripe connected OR `chargesEnabled = false`, hide "Pay online" option from customer booking flow — only show "Pay on site"

## Breadcrumbs

- `server/routes/payments.ts` — current Stripe endpoints that need to be refactored to use `stripeAccount` parameter
- `shared/schema.ts` — `integrationSettings` table (has Stripe key today) + new `tenantStripeConnections`
- `client/src/pages/BookingPage.tsx` — payment method step that needs to hide "online" if tenant has no Stripe
- Stripe Connect docs: Standard accounts (recommended — tenant has own dashboard) vs Express accounts (simpler but Xkedule responsible for compliance)
- Stripe app registration: needs a Connect application with OAuth flow enabled, redirect URI configured, branding

## Notes

**Standard vs Express accounts:**
- **Standard (recommended):** Tenant creates/uses own Stripe account. Has complete Stripe dashboard, manages disputes, payouts go directly to them. Xkedule just facilitates the payment.
- **Express:** Account created via API, Xkedule responsible for onboarding and compliance. More friction.

Start with Standard. If a tenant doesn't have a Stripe account yet, Stripe Connect creates one during OAuth (`stripe.com/connect/...?signup`).

**Application fee (revenue share):** Stripe Connect allows Xkedule to charge a per-transaction fee (`application_fee_amount` in the checkout session). Can be an additional revenue model — e.g., 1% per processed transaction in addition to subscription. Configurable per plan (SEED-017).

**Webhook routing:** Connected account events arrive at the Xkedule webhook with `event.account` populated. Lookup `tenantStripeConnections.stripeAccountId` → resolve tenant → process.

**Tokens:** Stripe Connect `access_token` doesn't expire (no refresh needed) — different from traditional OAuth. But if the tenant revokes access in the Stripe dashboard, the token becomes invalid — capture errors and mark `connection.status = 'revoked'`.

**Principle:** Plug & play means the tenant never touches API key, secret key, webhook secret — Xkedule handles that. The tenant just clicks "Connect" and authorizes.
