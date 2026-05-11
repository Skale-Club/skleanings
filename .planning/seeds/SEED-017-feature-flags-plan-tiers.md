---
id: SEED-017
status: dormant
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when defining subscription plans (together with SEED-014)
scope: Medium
---

# SEED-017: Features and limits per plan (all CRUD in super-admin, nothing hardcoded)

## Why This Matters

Each plan has a set of unlocked features and quantitative limits. Examples:
- Basic: blog ❌, GHL ❌, marketing dashboard ❌, max 2 staff, max 100 bookings/month
- Pro: blog ✓, GHL ✓, marketing dashboard ✓, max 10 staff, max 1000 bookings/month
- Enterprise: everything unlocked, unlimited

**Fundamental principle:** Neither features nor limits can be hardcoded. Super-admin must be able to create a new feature ("AI suggestions") tomorrow, enable it for Enterprise, and have the system respect it without a deploy.

**Why:** Hardcoded feature flags turn every product decision into a code change. With CRUD in super-admin, the product team defines the "plan × feature × limit" matrix as data.

## When to Surface

**Trigger:** together with SEED-014 (billing) and SEED-013 (multi-tenant). The three form the SaaS core.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule SaaS milestone (together with SEED-013 + SEED-014)
- Monetization / pricing strategy milestone
- When needing to differentiate plans by feature

## Scope Estimate

**Medium** — One phase. Components:

1. **Schema:**
   - `features` (id, key, name, description, type enum: `boolean | numeric | enum`, defaultValue) — global catalog of features that exist in the product
   - `planFeatures` (planId FK, featureId FK, enabled, limitValue) — plan × feature matrix
   - `featureUsage` (tenantId FK, featureKey, periodStart, periodEnd, currentValue) — for windowed limits (e.g., bookings/month)

2. **Backend:**
   - `requireFeature(key)` middleware that checks if the tenant's plan has the feature
   - `enforceFeatureLimit(key)` middleware that checks and increments counters (bookings, staff count, storage)
   - `getEnabledFeatures(tenantId)` service cached (5min TTL)

3. **Frontend:**
   - `<FeatureGate feature="ghl_integration">` component that hides/disables admin sections
   - `useFeature(key)` hook returning `{ enabled, limit, current, remaining }`
   - Upgrade banner when tenant hits a limit or tries to access a blocked feature

4. **Super-admin UI:**
   - Feature catalog CRUD (create new feature, define type, default)
   - Visual "plan × feature" matrix with toggles and limit fields
   - Audit: log of which tenants hit limits in the last month

## Breadcrumbs

- `server/middleware/auth.ts` — guard middleware pattern — feature guard follows the same pattern
- `client/src/components/admin/` — sections to be guarded: `MarketingSection`, `IntegrationsSection`, `BlogSection`
- New schema: `features`, `planFeatures`, `featureUsage` — all at Xkedule level (no `tenantId` except `featureUsage`)
- Lookup: tenant → subscription → plan → planFeatures — cached per request

## Notes

**Feature types:**
- `boolean` — on/off (e.g., `ghl_integration`, `marketing_dashboard`, `ai_chat`)
- `numeric` — quantitative limit (e.g., `max_staff = 10`, `max_bookings_per_month = 1000`)
- `enum` — choice between values (e.g., `support_tier = 'email' | 'priority' | 'dedicated'`)

**Windowed limits:** For monthly limits (bookings, emails sent), `featureUsage` has one row per (tenant, feature, month). Automatic reset on the first day of the tenant's billing cycle.

**Soft vs hard limits:** Configurable per feature. Soft: warns but allows (with upgrade banner). Hard: blocks the action completely.

**Anti-pattern to avoid:** `if (plan === 'pro' && feature === 'ghl') { ... }` anywhere in the code. Always via `requireFeature` or `useFeature`.
