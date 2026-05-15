# Requirements — v17.0 Plan Tiers

**Milestone:** v17.0 Plan Tiers
**Goal:** Tenants can be assigned to one of three Stripe plan tiers (Basic, Pro, Enterprise) with different price IDs and feature gates. Super-admin sets the plan; tenant admin sees their tier; backend enforces feature limits via a single `tenantHasFeature()` helper.
**Status:** Active

---

## Milestone Requirements

### Plan Tier Foundation (Phase 59)

- [x] **PT-01**: `tenant_subscriptions` table has a `planTier` column with values `'basic' | 'pro' | 'enterprise'`, default `'basic'` (Supabase migration + Drizzle schema)
- [x] **PT-02**: Three environment variables `STRIPE_SAAS_PRICE_ID_BASIC`, `STRIPE_SAAS_PRICE_ID_PRO`, `STRIPE_SAAS_PRICE_ID_ENTERPRISE` map plan tiers to Stripe Price IDs; a helper `getPriceIdForTier(tier)` returns the correct ID
- [x] **PT-03**: `server/lib/feature-flags.ts` exports a feature catalog (`{ maxStaff: number, maxBookingsPerMonth: number, customBranding: boolean, prioritySupport: boolean }` per tier) and a `tenantHasFeature(tier, feature)` helper returning the limit/boolean
- [x] **PT-04**: Stripe webhook (`customer.subscription.updated`) reads the new `priceId` from `sub.items.data[0].price.id` and maps it back to a tier via reverse lookup of the 3 env vars — updates `tenant_subscriptions.planTier`

### Super-Admin Plan Management (Phase 59)

- [x] **PT-05**: `PATCH /api/super-admin/tenants/:id/plan` (guarded by `requireSuperAdmin`) accepts `{ planTier }` body, calls Stripe to update the subscription to the new price (`stripe.subscriptions.update(subId, { items: [{ id, price: newPriceId }] })`), then updates `tenant_subscriptions.planTier`

### Plan Display UI (Phase 60)

- [x] **PT-06**: `/admin/billing` shows the current `planTier` (Basic/Pro/Enterprise badge) and a feature list derived from `tenantHasFeature()` rendered server-side via a new field on `GET /api/billing/status` — e.g. "Max staff: 5", "Custom branding: ✓", "Priority support: ✗"
- [ ] **PT-07**: Super-admin `/superadmin` Tenants table shows the current `planTier` badge per tenant and provides a Select dropdown to change it — change triggers `PATCH /api/super-admin/tenants/:id/plan` and refreshes the table

---

## Future Requirements

- Plan selection at signup (currently always defaults to Basic)
- Annual billing discount per tier
- Feature gate enforcement at route level (block requests when limit exceeded)
- Custom tier creation via super-admin UI

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plan selection at signup | Stays default-Basic for MVP; super-admin promotes manually |
| Route-level enforcement | Requires per-route limit checks; deferred to v18.0 |
| Annual billing | Adds Stripe complexity; monthly sufficient for MVP |
| Custom tiers | Feature catalog stays hardcoded for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PT-01 | Phase 59 | Complete |
| PT-02 | Phase 59 | Complete |
| PT-03 | Phase 59 | Complete |
| PT-04 | Phase 59 | Complete |
| PT-05 | Phase 59 | Complete |
| PT-06 | Phase 60 | Complete |
| PT-07 | Phase 60 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15*
