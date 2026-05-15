# Requirements — v20.0 Connect Payment Routing

**Milestone:** v20.0 Connect Payment Routing
**Goal:** Customer booking payments are routed through the tenant's connected Stripe Express account with an `application_fee_amount` skimmed by the platform. Legacy per-tenant Stripe API key flow continues to work for tenants not yet on Connect.
**Status:** Active

---

## Milestone Requirements

### Connect-Aware Checkout (Phase 65)

- [x] **PF-01**: When the current tenant has a `tenant_stripe_accounts` row with `chargesEnabled = true`, `POST /api/payments/checkout` creates the Stripe Checkout session using the platform `STRIPE_SECRET_KEY` + `{ stripeAccount: tenant.stripeAccountId }` request options (Stripe-Account header) — payment funds land in the tenant's connected balance
- [x] **PF-02**: The Checkout session includes `payment_intent_data.application_fee_amount` calculated from `STRIPE_PLATFORM_FEE_PERCENT` env var (default `5`) applied to the booking total — minimum 1 cent, fee math uses integer cents
- [x] **PF-03**: When the tenant has a Connect account row but `chargesEnabled = false`, `POST /api/payments/checkout` returns 402 with `{ message: "Stripe Connect onboarding incomplete. Finish onboarding in Admin → Payments." }` — no Stripe API call attempted
- [x] **PF-04**: When the tenant has NO Connect row, the existing legacy flow (per-tenant `integrationSettings.stripe.apiKey`) is used unchanged — backward compatible for current tenants
- [x] **PF-05**: `bookings` table gets `platform_fee_amount INTEGER` and `tenant_net_amount INTEGER` columns (Supabase migration + Drizzle) — populated on `checkout.session.completed` webhook from `payment_intent.application_fee_amount` and `(amount_total - application_fee_amount)`

### Webhook Routing (Phase 65)

- [x] **PF-06**: `paymentsWebhookHandler` (existing handler in `server/routes/payments.ts`) verifies the Stripe signature using `STRIPE_WEBHOOK_SECRET_CONNECT` env var when `event.account` is present (Connect event), falls back to legacy per-tenant secret otherwise — Connect events also call `stripe.checkout.sessions.retrieve(sessionId, { stripeAccount: event.account })` to fetch payment_intent details

### Payments Dashboard (Phase 66)

- [ ] **PF-07**: `GET /api/admin/payments/recent` (requireAdmin) returns the last 20 paid bookings for the current tenant with `{ id, customerName, serviceName, amountTotal, platformFeeAmount, tenantNetAmount, paidAt }`
- [ ] **PF-08**: `/admin/payments` PaymentsSection adds a "Recent Payments" card below the Connect status card — Table with date, customer, service, total, platform fee, net to tenant — empty state "No payments yet"

---

## Future Requirements

- Refund flow on Connect (with reverse_transfer to recover platform fee)
- Per-tier platform fee (basic 7%, pro 5%, enterprise 3%)
- Connect Payout schedule customization
- Stripe-hosted Connect Dashboard deep link

## Out of Scope

| Feature | Reason |
|---------|--------|
| Migrate existing tenants off legacy Stripe integration | Opt-in via Connect onboarding; both flows coexist |
| Refunds with reverse_transfer | v21.0+ — needs careful tenant-balance UX |
| Per-tier fee variation | Single env var sufficient for MVP |
| Connect Express Dashboard SSO | Stripe-hosted login is fine for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PF-01 | Phase 65 | Complete |
| PF-02 | Phase 65 | Complete |
| PF-03 | Phase 65 | Complete |
| PF-04 | Phase 65 | Complete |
| PF-05 | Phase 65 | Complete |
| PF-06 | Phase 65 | Complete |
| PF-07 | Phase 66 | Pending |
| PF-08 | Phase 66 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15*
