# Requirements — v19.0 Stripe Connect Onboarding

**Milestone:** v19.0 Stripe Connect Onboarding
**Goal:** Tenants can connect their own Stripe Express account so future booking payments flow directly to them. This milestone delivers the connection/onboarding foundation only — payment flow integration is deferred to v20.0.
**Status:** Active

---

## Milestone Requirements

### Connect Backend (Phase 63)

- [x] **SC-01**: `tenant_stripe_accounts` table (Supabase migration + Drizzle schema) with columns: `id`, `tenantId UNIQUE`, `stripeAccountId TEXT UNIQUE`, `chargesEnabled BOOLEAN DEFAULT false`, `payoutsEnabled BOOLEAN DEFAULT false`, `detailsSubmitted BOOLEAN DEFAULT false`, `createdAt`, `updatedAt`
- [x] **SC-02**: `POST /api/admin/stripe/connect/onboard` (requireAdmin) creates a new Stripe Express `Account` if none exists for the tenant, persists `stripeAccountId`, generates an `AccountLink` (type `account_onboarding`, return_url + refresh_url to `/admin/payments`), and returns `{ url }`
- [x] **SC-03**: `GET /api/admin/stripe/status` (requireAdmin) returns `{ connected: boolean, stripeAccountId, chargesEnabled, payoutsEnabled, detailsSubmitted }` for the current tenant
- [x] **SC-04**: `POST /api/admin/stripe/refresh` (requireAdmin) calls `stripe.accounts.retrieve(stripeAccountId)`, updates the DB row with current capability flags — useful when admin returns from onboarding before webhook fires
- [x] **SC-05**: Webhook handler extended to process `account.updated` and `account.application.deauthorized` events — updates `chargesEnabled`/`payoutsEnabled`/`detailsSubmitted` (or removes the row on deauthorize)

### Connect Frontend (Phase 64)

- [x] **SC-06**: `/admin/payments` page shows a status card with: connection state badge (Connected / Not Connected), capability badges (Charges Enabled, Payouts Enabled), "Connect Stripe Account" or "Continue Onboarding" button (POSTs to onboard endpoint, redirects to Stripe URL), and a "Refresh Status" button
- [x] **SC-07**: Super-admin Tenants table shows a Stripe Connect Status column with Connected/Not Connected badge per tenant — column derived from a join on `tenant_stripe_accounts`

---

## Future Requirements (deferred to v20.0)

- Booking payment flow uses tenant's connected account with `application_fee_amount` for platform fee
- Reject booking creation when `chargesEnabled = false`
- Platform fee percentage configurable per plan tier
- Stripe payout history visible in /admin/payments

## Out of Scope

| Feature | Reason |
|---------|--------|
| Payment flow migration | v20.0 — requires careful migration of existing customer flow |
| Custom Stripe Connect (vs Express) | Express is sufficient and minimizes compliance burden |
| Direct charges with destination | Standard accounts only — Express requires platform on-behalf-of |
| Multi-currency payouts | English/USD-only for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SC-01 | Phase 63 | Complete |
| SC-02 | Phase 63 | Complete |
| SC-03 | Phase 63 | Complete |
| SC-04 | Phase 63 | Complete |
| SC-05 | Phase 63 | Pending |
| SC-06 | Phase 64 | Complete |
| SC-07 | Phase 64 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15*
