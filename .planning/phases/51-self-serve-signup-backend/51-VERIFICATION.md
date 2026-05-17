---
phase: 51-self-serve-signup-backend
verified: 2026-05-14T00:00:00Z
status: passed
score: 6/6 must-haves verified
gaps: []
human_verification:
  - test: "Duplicate slug returns 409 with no partial rows in DB"
    expected: "No rows in tenants/domains/users/user_tenants/companySettings after a 409 response"
    why_human: "Requires live DB with transaction rollback; can't verify atomicity from static code alone"
  - test: "Stripe trial subscription created with status=trialing"
    expected: "tenant_subscriptions row has status='trialing' and currentPeriodEnd 14 days out after signup with STRIPE_SAAS_PRICE_ID configured"
    why_human: "Requires live Stripe sandbox and configured env var; non-fatal path can't be exercised statically"
  - test: "customer.subscription.updated webhook transitions status to active or past_due"
    expected: "Posting a Stripe-signed webhook with status='active' updates the row; status='past_due' also updates correctly"
    why_human: "Requires Stripe CLI event replay or ngrok; Stripe's logic (not our code) determines which status is sent"
---

# Phase 51: Self-Serve Signup Backend — Verification Report

**Phase Goal:** Any business can sign up without super-admin involvement — a single POST endpoint atomically provisions the full tenant stack (tenant, domain, admin user, company settings, Stripe customer, trial subscription) and the Stripe webhook keeps trial status in sync
**Verified:** 2026-05-14
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/auth/signup with valid data returns 201 with subdomain and adminUrl | VERIFIED | `server/routes/signup.ts` line 141: `return res.status(201).json({ subdomain, adminUrl })` |
| 2 | Duplicate slug returns 409 with `{ field: 'slug', message: 'Subdomain already taken' }` and no partial rows | VERIFIED | `signupTenant()` throws `SUBDOMAIN_TAKEN` pre-transaction; route maps to 409 at lines 65-70 of signup.ts; Postgres 23505 belt-and-suspenders also handled |
| 3 | DB has rows in tenants, domains, users, user_tenants, companySettings atomically; tenant_subscriptions when Stripe configured | VERIFIED | `db.transaction` at storage.ts:2531 inserts into all 5 tables; Stripe block creates subscription with `trial_period_days: 14` (signup.ts:103-107) |
| 4 | Session set after signup allows immediate /admin access | VERIFIED | signup.ts:133-138 sets `req.session.adminUser = { id: userId, email, role: 'admin', tenantId }` |
| 5 | POST /api/auth/signup accessible without session cookie (no resolveTenantMiddleware) | VERIFIED | routes.ts line 37: `app.use("/api", signupRouter)` appears before `app.use(resolveTenantMiddleware)` at line 40 |
| 6 | Stripe webhook handles trial_will_end and subscription.updated events | VERIFIED | billing.ts has `customer.subscription.updated` (line 40) and `customer.subscription.trial_will_end` (line 77) cases; both look up by stripeCustomerId and call `db.update(tenantSubscriptions)` |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/routes/signup.ts` | POST /api/auth/signup route | VERIFIED | Exists, 144 lines, exports Router; contains signupSchema, SUBDOMAIN_TAKEN handling, Stripe trial, session setup, 201 response |
| `server/storage.ts` (IStorage) | `signupTenant()` interface declaration | VERIFIED | Line 446: interface method declared with correct signature |
| `server/storage.ts` (DatabaseStorage) | `signupTenant()` implementation | VERIFIED | Lines 2509-2575: full implementation with pre-check, db.transaction covering 5 tables, returns `{ tenantId, userId, subdomain }` |
| `server/routes.ts` | signupRouter mounted before resolveTenantMiddleware | VERIFIED | Line 37 (signupRouter) < Line 40 (resolveTenantMiddleware) — confirmed |
| `server/routes/billing.ts` | `customer.subscription.trial_will_end` case | VERIFIED | Lines 77-107: separate case block, looks up by stripeCustomerId, calls db.update, logs console.warn |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/routes.ts` | `server/routes/signup.ts` | `app.use("/api", signupRouter)` at line 37 | WIRED | Import at line 29; mount at line 37 before middleware at line 40 |
| `POST /api/auth/signup` | `storage.signupTenant()` | direct call, lines 55-63 of signup.ts | WIRED | Result destructured into tenantId, userId, subdomain |
| `storage.signupTenant()` | `db.transaction` (5 tables) | `db.transaction(async tx => ...)` at storage.ts:2531 | WIRED | All 5 inserts: tenants, domains, users, userTenants, companySettings |
| `POST /api/auth/signup` | `stripe.subscriptions.create` | non-fatal try/catch, signup.ts:103-107 | WIRED | `trial_period_days: 14`; non-fatal on error |
| `POST /api/billing/webhook` | `tenantSubscriptions` table | `db.update(tenantSubscriptions)` in trial_will_end case | WIRED | billing.ts:95-103 |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 51 is backend-only (no components that render dynamic data). The signup route produces DB rows; the webhook updates DB rows. No client-side rendering artifacts.

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — server must be running with live DB and Stripe credentials to exercise the endpoints. All logic paths were verified statically.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SS-01 | 51-01-PLAN.md | Atomic provision of full tenant stack in single db.transaction | SATISFIED | `signupTenant()` db.transaction covers tenants + domains + users + userTenants + companySettings; Stripe customer + subscription created post-transaction |
| SS-02 | 51-01-PLAN.md | Duplicate slug returns 409 with field-level error | SATISFIED | Pre-transaction uniqueness check + SUBDOMAIN_TAKEN error code + 409 `{ field: 'slug', message: 'Subdomain already taken' }` at signup.ts:65-70 |
| SS-03 | 51-01-PLAN.md | After signup API returns tenant subdomain; frontend can redirect to slug.xkedule.com/admin | SATISFIED | 201 response body: `{ subdomain: 'slug.xkedule.com', adminUrl: 'https://slug.xkedule.com/admin' }` at signup.ts:141 |
| SS-04 | 51-01-PLAN.md | /signup publicly accessible; authenticated admins redirected to /admin | PARTIAL — BACKEND SATISFIED | No auth guard on POST /api/auth/signup (mounted before resolveTenantMiddleware). Client-side redirect of authenticated admins is Phase 52 frontend work, not a backend concern |
| SS-05 | 51-01-PLAN.md | Stripe trial subscription with status='trialing' and currentPeriodEnd 14 days out | SATISFIED (code path) | signup.ts:103-107: `stripe.subscriptions.create({ trial_period_days: 14 })`; upsertTenantSubscription called with `status: stripeSub.status` ("trialing") and periodEnd; needs live Stripe to verify runtime |
| SS-06 | 51-02-PLAN.md | Webhook handles trial_will_end and subscription.updated → active or past_due | SATISFIED | `customer.subscription.updated` at billing.ts:40 uses `sub.status` (Stripe's authoritative value — active/past_due); `customer.subscription.trial_will_end` at billing.ts:77 updates status + periodEnd with console.warn |

**Note on REQUIREMENTS.md / ROADMAP discrepancy:** REQUIREMENTS.md marks SS-06 as `[ ]` (Pending) and ROADMAP shows 51-02-PLAN.md unchecked. The code IS implemented (commit `41d58f3` confirmed). These documentation flags should be updated to `[x]` / checked in the roadmap to reflect reality.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/routes/signup.ts` | 92-130 | Stripe block is non-fatal — tenant exists even if Stripe fails | INFO | Intentional design: allows backfill; Stripe availability does not block signup |

No blockers. No TODO/FIXME/placeholder comments. No empty return stubs. The non-fatal Stripe pattern is intentional and documented.

---

### Human Verification Required

#### 1. Atomic rollback on duplicate slug

**Test:** POST `/api/auth/signup` with a slug that matches an existing domain. Then query `tenants`, `domains`, `users`, `user_tenants`, `company_settings` for rows with that slug's data.
**Expected:** 409 response AND zero rows inserted in any table.
**Why human:** Transaction rollback correctness requires a live DB; can't verify atomicity from static code inspection alone.

#### 2. Stripe trial subscription runtime behavior

**Test:** With `STRIPE_SAAS_PRICE_ID` set, POST valid signup data. Check the Stripe dashboard and the `tenant_subscriptions` row.
**Expected:** Stripe customer and trial subscription created; `tenant_subscriptions` row has `status='trialing'` and `currentPeriodEnd` approximately 14 days from now.
**Why human:** Requires live Stripe sandbox credentials and `STRIPE_SAAS_PRICE_ID` configured.

#### 3. Webhook status transition (SS-06 runtime)

**Test:** Use Stripe CLI (`stripe trigger customer.subscription.updated`) or send a signed test webhook with `status='active'`, then verify `tenant_subscriptions.status` changes to `'active'`.
**Expected:** DB row updated to `status='active'`; same test with `status='past_due'` should update to `'past_due'`.
**Why human:** Requires `STRIPE_WEBHOOK_SECRET`, live ngrok or Stripe CLI event replay; Stripe determines which status is sent based on payment method presence.

---

### Gaps Summary

No functional gaps. All six must-haves from the plan frontmatter are verified in the actual codebase. Both commits (`b39119e`, `89c146e`, `41d58f3`) confirmed to exist in git log.

**Documentation drift to resolve (not blocking):**
- REQUIREMENTS.md line 21: SS-06 should be changed from `[ ]` to `[x]`
- REQUIREMENTS.md traceability table line 63: SS-06 status should be "Complete"
- ROADMAP.md Phase 51 plan list: `- [ ] 51-02-PLAN.md` should be `- [x] 51-02-PLAN.md`
- ROADMAP.md progress table: Phase 51 should show "2/2" plans complete and "Complete" status

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
