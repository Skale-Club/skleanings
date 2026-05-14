---
phase: 49-subscription-enforcement
verified: 2026-05-13T00:00:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Super-admin Tenants table shows Billing Status column with status badge, planId, and currentPeriodEnd per tenant"
    status: partial
    reason: "billingPlanId is returned by the API and declared in TenantListItem but is not rendered in the TenantsSection billing cell. The cell shows status badge and renewal date only."
    artifacts:
      - path: "client/src/pages/SuperAdmin.tsx"
        issue: "Billing cell renders tenant.billingStatus badge and tenant.billingCurrentPeriodEnd date, but tenant.billingPlanId is never referenced — no plan ID displayed."
    missing:
      - "Add planId rendering inside the billing cell, below the status badge and above the date, e.g.: {tenant.billingPlanId && <div className='text-xs text-gray-500 font-mono'>{tenant.billingPlanId}</div>}"
---

# Phase 49: Subscription Enforcement Verification Report

**Phase Goal:** Tenants with lapsed subscriptions are blocked from all business API routes, and super-admin can see each tenant's billing status without leaving the panel
**Verified:** 2026-05-13
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tenant with status='canceled' receives 402 before any route handler | VERIFIED | `resolveTenantMiddleware` checks `subRow.status === "canceled"` and returns `res.status(402).json(...)` before `next()` |
| 2 | Tenant with status='past_due' outside 3-day grace period receives 402; within grace period passes | VERIFIED | `GRACE_MS = 3 * 24 * 60 * 60 * 1000`; lapsed = `past_due && currentPeriodEnd.getTime() < Date.now() - GRACE_MS` |
| 3 | Tenant with no row in tenant_subscriptions passes through | VERIFIED | `if (subRow)` block is skipped entirely when no subscription row exists |
| 4 | GET /api/super-admin/tenants includes billingStatus, billingPlanId, billingCurrentPeriodEnd per tenant | VERIFIED | LEFT JOIN on `tenantSubscriptions`, all three columns selected and spread into response via `...t` |
| 5 | Super-admin Tenants table shows Billing column with status badge, planId, and renewal date per tenant | FAILED | Badge and renewal date render; planId (`billingPlanId`) is available in API and type but not rendered in the cell |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/middleware/tenant.ts` | 402 enforcement guard after 503 check | VERIFIED | tenantSubscriptions import + db direct query + 402 return; no TypeScript errors |
| `server/routes/super-admin.ts` | Billing columns in GET /tenants response | VERIFIED | LEFT JOIN on tenantSubscriptions; billingStatus, billingPlanId, billingCurrentPeriodEnd selected |
| `client/src/hooks/useSuperAdmin.ts` | TenantListItem extended with billing fields | VERIFIED | billingStatus, billingPlanId, billingCurrentPeriodEnd as `string | null` fields |
| `client/src/pages/SuperAdmin.tsx` | Billing column in TenantsSection with Badge | PARTIAL | Billing TableHead present; badge with color logic present; renewal date present; planId not rendered |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/middleware/tenant.ts` | `tenant_subscriptions` table | `db.select` with `eq(tenantSubscriptions.tenantId, tenant.id)` | WIRED | Direct db query using imported `tenantSubscriptions` schema symbol |
| `server/routes/super-admin.ts GET /tenants` | `tenant_subscriptions` table | `.leftJoin(tenantSubscriptions, eq(tenantSubscriptions.tenantId, tenants.id))` | WIRED | LEFT JOIN in main Drizzle query; billing columns in select; spread into `result` |
| `client/src/pages/SuperAdmin.tsx TenantsSection` | `TenantListItem.billingStatus` | `tenant.billingStatus` in table cell | WIRED | Used in badge class conditional and as badge label |
| `client/src/pages/SuperAdmin.tsx TenantsSection` | `TenantListItem.billingPlanId` | `tenant.billingPlanId` in table cell | NOT_WIRED | Field exists in type and in API response; never referenced in JSX |
| `client/src/pages/SuperAdmin.tsx TenantsSection` | `TenantListItem.billingCurrentPeriodEnd` | `tenant.billingCurrentPeriodEnd` in table cell | WIRED | Rendered as `toLocaleDateString()` when truthy |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SuperAdmin.tsx` billing cell | `tenant.billingStatus` | LEFT JOIN on `tenant_subscriptions.status` in GET /tenants | Yes — live DB column | FLOWING |
| `SuperAdmin.tsx` billing cell | `tenant.billingCurrentPeriodEnd` | LEFT JOIN on `tenant_subscriptions.current_period_end` | Yes — live DB column | FLOWING |
| `SuperAdmin.tsx` billing cell | `tenant.billingPlanId` | LEFT JOIN on `tenant_subscriptions.plan_id` — API returns it | Yes — but cell does not render it | HOLLOW_PROP |

### Behavioral Spot-Checks

Step 7b: Behavioral spot-checks skipped for middleware and React UI — the middleware requires a running server with tenant resolution context; the UI requires a browser. TypeScript type-check (`npm run check`) confirmed clean (0 errors), which covers the wiring contract.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SB-05 | 49-01 | 402 enforcement for lapsed subscriptions in middleware | SATISFIED | `resolveTenantMiddleware` returns 402 for canceled and grace-period-expired past_due tenants |
| SB-06 | 49-01, 49-02 | Super-admin billing visibility per tenant | PARTIAL | API returns all three billing fields; UI shows status + date but omits planId |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/pages/SuperAdmin.tsx` | 505-530 | `tenant.billingPlanId` declared in type and returned by API but never rendered | Warning | planId is invisible to super-admin in the panel; success criterion "shows planId" not met |
| `client/src/pages/SuperAdmin.tsx` | 512-513 | Badge uses `bg-yellow-100 text-yellow-800` for `past_due` | Info | Plan spec called for `bg-amber-100 text-amber-800`; yellow and amber are visually similar, no functional impact |

Note on field naming deviation: plan 01 spec used `billingPeriodEnd`; the actual implementation across all three files uses `billingCurrentPeriodEnd`. The field name is self-consistent (server → type → UI) and TypeScript compiles clean — this is an acceptable deviation from the plan spec with no functional impact.

### Human Verification Required

#### 1. 402 Gate — Canceled Tenant

**Test:** Configure a test tenant with a row in `tenant_subscriptions` with `status = 'canceled'`. Issue any business API request (e.g., `GET /api/services`) against that tenant's hostname.
**Expected:** HTTP 402, body `{"message":"Subscription required"}`
**Why human:** Requires a running server with database seeded with a canceled subscription row.

#### 2. Grace Period Boundary — Past Due Tenant

**Test:** Seed a tenant with `status = 'past_due'` and `current_period_end` set to (a) 4 days ago and (b) 1 day ago. Issue a business API request for each.
**Expected:** 402 for case (a); 200 for case (b).
**Why human:** Requires seeded test data and live request routing.

#### 3. Billing Column Visual — Super-Admin Panel

**Test:** Log in as super-admin, navigate to the Tenants table. Check that the Billing column shows for a tenant with an active subscription: green badge, renewal date visible.
**Expected:** Green badge with status text; date line below it; no planId visible (current gap).
**Why human:** Visual rendering of color-coded Badge component in browser.

### Gaps Summary

One gap blocks full goal achievement for SB-06 and success criterion 3:

The `billingPlanId` field is correctly returned by the API (`billingPlanId` in the LEFT JOIN select) and is declared in `TenantListItem`. However, the billing cell in `TenantsSection` (lines 505-530 of `SuperAdmin.tsx`) only renders the status badge and renewal date. The plan specification for both the phase success criteria and plan 02 task 2 explicitly requires planId to appear below the badge. The fix is a 2-line addition inside the billing cell JSX: render `tenant.billingPlanId` when truthy.

The 402 enforcement gate (SB-05) is fully verified with correct logic for canceled tenants, past_due outside grace period, within-grace-period pass-through, and no-row pass-through. The middleware correctly uses `db` directly (not `res.locals.storage`) and fires before any route handler.

---

_Verified: 2026-05-13_
_Verifier: Claude (gsd-verifier)_
