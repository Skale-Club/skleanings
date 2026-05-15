---
phase: 60-plan-display-ui
verified: 2026-05-14T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Tenant admin sees Basic/Pro/Enterprise badge on /admin/billing"
    expected: "Visiting /admin/billing as a tenant admin whose tenant_subscriptions.planTier='basic' renders a purple capitalized 'Basic' Badge above the Status row, plus a Features Card listing maxStaff:3, maxBookings/month:100, Custom branding: X icon, Priority support: X icon."
    why_human: "Visual rendering and styling of the Badge + Features Card cannot be verified by grep — needs a live browser session against a tenant with seeded data."
  - test: "Tier change reflects across catalog values"
    expected: "Updating tenant_subscriptions.planTier to 'enterprise' and reloading /admin/billing flips badge to 'Enterprise', both numeric rows render 'Unlimited', and both booleans render the green Check icon."
    why_human: "Requires DB write + live reload + visual confirmation of icon swap."
  - test: "Super-admin sees Plan column populated and can change tier"
    expected: "Visiting /superadmin as super-admin shows a Plan column between Status and Primary Domain. Each tenant with a subscription row displays a Select set to its current tier (Basic/Pro/Enterprise). Changing the Select fires PATCH /api/super-admin/tenants/:id/plan in Network panel, the row re-renders with the new tier after invalidation, and tenant_subscriptions.plan_tier is updated in the DB."
    why_human: "End-to-end interactive behavior with Stripe API side-effects (subscription item swap) cannot be safely automated here without a live Stripe test environment."
  - test: "Tenants without a subscription row show '—' instead of Select"
    expected: "For a tenant whose tenant_subscriptions row is missing (or planTier is null), the Plan column renders an em-dash and no Select. No PATCH can be triggered for these rows."
    why_human: "Conditional rendering on null is in code, but confirming UX of dash + no clickable control needs visual check."
  - test: "ROADMAP success criterion #3 deviation — 'planTier badge column'"
    expected: "ROADMAP Phase 60 success criterion #3 says the super-admin Tenants table 'shows a planTier badge column per tenant'. Current implementation renders a Select directly (no separate Badge) — the Select trigger displays the current tier as plain text inside a button. Confirm with product whether this satisfies PT-07 intent or requires a Badge alongside the Select."
    why_human: "Acceptance is a product/UX judgment call; both PLAN 60-02 and SUMMARY explicitly chose Select-only and noted no Badge was added."
  - test: "ROADMAP success criterion #4 deviation — 'success toast'"
    expected: "ROADMAP criterion #4 specifies the tier change should show a 'success toast'. Current implementation surfaces only errors (via alert) and relies on silent React Query invalidation for success feedback. Confirm whether toast on success is required."
    why_human: "Acceptance criterion deviation; needs human/product call on whether silent refresh suffices."
---

# Phase 60: Plan Display UI Verification Report

**Phase Goal:** Both the tenant admin (/admin/billing) and the super-admin (/superadmin Tenants table) can see and act on plan tier — tenant admin sees their current tier badge and feature list; super-admin sees a badge per tenant and can change the tier via a dropdown.
**Verified:** 2026-05-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (consolidated from 60-01 and 60-02 must-haves)

| #   | Truth                                                                                                                          | Status     | Evidence                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | GET /api/billing/status returns planTier ('basic'\|'pro'\|'enterprise') when sub row exists                                    | VERIFIED   | `server/routes/billing.ts:290-298` — `tier = isPlanTier(sub.planTier) ? sub.planTier : "basic"`, emitted as `planTier: tier`.     |
| 2   | GET /api/billing/status returns features object (maxStaff, maxBookingsPerMonth, customBranding, prioritySupport)                | VERIFIED   | `server/routes/billing.ts:295` — `features: getFeatureCatalog(tier)`. Catalog confirmed at `server/lib/feature-flags.ts:33-50`.   |
| 3   | Tenant admin sees tier badge (Basic/Pro/Enterprise) on /admin/billing                                                          | VERIFIED   | `client/src/pages/admin/BillingPage.tsx:152-158` — purple Badge with capitalized `billingStatus.planTier`, gated on truthiness.   |
| 4   | Tenant admin sees Features section with 4 catalog items (humanized values, Unlimited for -1, Check/X icons)                    | VERIFIED   | `BillingPage.tsx:225-262` — Features Card with 4 rows, `=== -1 ? 'Unlimited'`, `<Check/>` and `<X/>` for booleans.                |
| 5   | GET /api/super-admin/tenants returns planTier per tenant (null when no sub row)                                                | VERIFIED   | `server/routes/super-admin.ts:198` — `planTier: tenantSubscriptions.planTier` added to projection; LEFT JOIN already in place.    |
| 6   | Super-admin sees Plan column with Select dropdown (Basic/Pro/Enterprise) in Tenants table                                      | VERIFIED   | `client/src/pages/SuperAdmin.tsx:477` (`<TableHead>Plan</TableHead>`), `:504-526` (Select + 3 SelectItems).                       |
| 7   | Changing Select fires PATCH /api/super-admin/tenants/:id/plan and table refreshes                                              | VERIFIED   | `SuperAdmin.tsx:507-512` calls `updatePlan.mutate`; `useSuperAdmin.ts:271-282` uses `superAdminFetch` PATCH + invalidate query.   |
| 8   | Tenants with no subscription row show disabled placeholder; Select cannot trigger 404                                          | VERIFIED   | `SuperAdmin.tsx:504/524-526` — em-dash rendered when `tenant.planTier` is null, no Select instantiated.                           |

**Score:** 8/8 truths verified (all PLAN-level must-haves) — but ROADMAP success criteria #3 and #4 raise UX deviations flagged for human review (see below).

### Required Artifacts (3-level + data-flow check)

| Artifact                                | Exists | Substantive | Wired | Data Flows | Status     |
| --------------------------------------- | ------ | ----------- | ----- | ---------- | ---------- |
| `server/routes/billing.ts`              | yes    | yes         | yes   | yes        | VERIFIED   |
| `client/src/pages/admin/BillingPage.tsx`| yes    | yes         | yes   | yes        | VERIFIED   |
| `server/routes/super-admin.ts`          | yes    | yes         | yes   | yes        | VERIFIED   |
| `client/src/hooks/useSuperAdmin.ts`     | yes    | yes         | yes   | yes        | VERIFIED   |
| `client/src/pages/SuperAdmin.tsx`       | yes    | yes         | yes   | yes        | VERIFIED   |
| `server/lib/feature-flags.ts` (dep)     | yes    | yes         | yes   | yes        | VERIFIED   |
| `server/lib/stripe-plans.ts` (dep)      | yes    | yes         | yes   | yes        | VERIFIED   |

### Key Link Verification

| From                                       | To                                                | Via                                          | Status | Details                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------- | -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `server/routes/billing.ts`                 | `server/lib/feature-flags.ts`                     | `getFeatureCatalog(tier)` import + call      | WIRED  | Import at line 18; call at line 295.                                                                                     |
| `BillingPage.tsx`                          | `/api/billing/status`                             | fetch in useEffect, reads planTier+features  | WIRED  | Fetch at lines 70-85; reads `billingStatus.planTier` (152, 156) + `billingStatus.features.*` (236, 242, 248-256).        |
| `server/routes/billing.ts`                 | `server/lib/stripe-plans.ts`                      | `isPlanTier`, `PlanTier` import + guard      | WIRED  | Import at line 17; `isPlanTier(sub.planTier)` at line 290.                                                               |
| `server/routes/super-admin.ts`             | `tenantSubscriptions` table                       | LEFT JOIN, planTier projection               | WIRED  | Projection line 198; LEFT JOIN line 202.                                                                                 |
| `SuperAdmin.tsx`                           | `useUpdateTenantPlan` hook                        | Select onValueChange calls `mutate`          | WIRED  | Hook instance line 364; `updatePlan.mutate(...)` at lines 508-511.                                                       |
| `useUpdateTenantPlan`                      | `PATCH /api/super-admin/tenants/:id/plan`         | `superAdminFetch` with PATCH + JSON body     | WIRED  | `useSuperAdmin.ts:271-279` — method PATCH, body `{ planTier }`, credentials handled by superAdminFetch.                  |
| `PATCH onSuccess`                          | `GET /api/super-admin/tenants` cache              | `queryClient.invalidateQueries`              | WIRED  | `useSuperAdmin.ts:280-282` invalidates `["/api/super-admin/tenants"]`.                                                   |

(gsd-tools reported some links as unverified due to regex-escape issues in the YAML patterns — manual grep confirms all are actually wired.)

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable                  | Source                                       | Produces Real Data | Status   |
| ----------------------- | ------------------------------ | -------------------------------------------- | ------------------ | -------- |
| BillingPage.tsx         | `billingStatus.planTier/features` | fetch `/api/billing/status` -> setBillingStatus | Yes — derived from `getTenantSubscription` row + `getFeatureCatalog`. | FLOWING  |
| SuperAdmin.tsx          | `tenant.planTier`              | `useSuperAdminTenants` query -> projection from `tenantSubscriptions.planTier` LEFT JOIN | Yes — real DB column. | FLOWING  |
| Select onValueChange    | mutation payload `{ tenantId, planTier }` | Direct user input + bound tenant row     | Yes               | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                  | Command                          | Result          | Status   |
| ----------------------------------------- | -------------------------------- | --------------- | -------- |
| TypeScript compiles cleanly               | `npm run check`                  | exit 0, no errs | PASS     |
| Phase commits present                     | `git log --oneline`              | 7a99640, 58849fb, f2862d3, 27f7ea3, cc87630 all visible | PASS     |
| `getFeatureCatalog` exported              | grep server/lib/feature-flags.ts | line 74 found   | PASS     |
| Live API responses                        | n/a — server not started         | n/a             | SKIP (no running server; route to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                                                                       | Status      | Evidence                                                                                                                              |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PT-06       | 60-01       | `/admin/billing` shows current planTier (badge) + feature list from `tenantHasFeature()` via `GET /api/billing/status`                                            | SATISFIED   | Server emits `planTier` + `features`; client renders Badge + Features Card with humanized values (lines 152-262 of BillingPage.tsx).  |
| PT-07       | 60-02       | Super-admin Tenants table shows planTier badge per tenant + Select dropdown that PATCHes `/tenants/:id/plan` and refreshes                                        | NEEDS HUMAN | Select dropdown present and wired; query invalidates on success. ROADMAP wording asks for a "badge" — current UI uses only a Select. Awaiting product call. |

### Anti-Patterns Found

| File                                  | Line | Pattern                                | Severity | Impact                                                                |
| ------------------------------------- | ---- | -------------------------------------- | -------- | --------------------------------------------------------------------- |
| (none)                                | —    | No TODO/FIXME/HACK/placeholder stubs in changed files | —    | "placeholder" hits in SuperAdmin.tsx are legitimate `<Input placeholder="…" />` attributes on unrelated dialogs, not stubs. |

### Human Verification Required

See YAML `human_verification` block above for the 6 items needing live verification:
1. Tenant Basic tier renders Badge + Features Card correctly.
2. Tier change (Basic -> Enterprise) flips badge and shows "Unlimited" / green Checks.
3. Super-admin Plan column populated; Select PATCHes and table refreshes; DB row updates.
4. Tenants without subscription show em-dash, no clickable control.
5. ROADMAP criterion #3 deviation: ROADMAP asks for a "planTier badge column" but PLAN 60-02 / implementation used only a Select (no separate Badge). Confirm product acceptance.
6. ROADMAP criterion #4 deviation: ROADMAP asks for a "success toast" on tier change; implementation has no toast (only `alert` on error + silent React Query invalidation). Confirm product acceptance.

### Gaps Summary

**No code-level gaps.** All PLAN-level must-haves are implemented, wired, and data-flowing end-to-end. TypeScript compiles cleanly. All commits referenced by the SUMMARYs are present in `git log`.

**Two ROADMAP success-criteria deviations** require human/product sign-off (not blocking gaps — implementation choices flagged in PLAN 60-02 decisions):
- ROADMAP #3 calls for a "badge column"; implementation uses Select-only.
- ROADMAP #4 calls for a "success toast"; implementation uses silent invalidation + alert-on-error.

Both deviations were explicitly documented in `60-02-SUMMARY.md` "Decisions Made" — the deviations are deliberate (operator-facing UI keeps it minimal). The verifier flags these for human acceptance because they materially diverge from the contract recorded in ROADMAP.md success criteria, even if PLAN 60-02 deemed them acceptable.

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
