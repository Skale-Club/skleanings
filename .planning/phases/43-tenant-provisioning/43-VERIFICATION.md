---
phase: 43-tenant-provisioning
verified: 2026-05-13T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Provision Admin flow end-to-end"
    expected: "Dialog opens, email submitted, credentials (email + password) displayed once with copy buttons, password gone after dialog close"
    why_human: "React mutation result display and clipboard interaction require browser"
  - test: "409 Conflict surfaced in dialog (not crash)"
    expected: "Provisioning a duplicate email shows error message inside the dialog"
    why_human: "Error state rendering requires live API call to trigger 23505 PG error"
  - test: "New tenant companySettings auto-seeded (booking flow doesn't crash)"
    expected: "Creating a new tenant via Add Tenant and visiting its booking flow succeeds without 500 errors"
    why_human: "Requires DB write and cross-tenant HTTP request to verify"
  - test: "Domain add/remove cache invalidation without server restart"
    expected: "Adding or removing a domain takes effect on the next HTTP request to that hostname"
    why_human: "Requires live server with LRU cache state to confirm invalidation"
---

# Phase 43: Tenant Provisioning Verification Report

**Phase Goal:** Creating a tenant is complete — admin user, company settings, and cache invalidation all happen atomically
**Verified:** 2026-05-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | users table has nullable password column after migration | VERIFIED | Migration file `20260515000002_phase43_users_password.sql` contains `ALTER TABLE users ADD COLUMN IF NOT EXISTS password text` (no NOT NULL, no DEFAULT) |
| 2 | IStorage interface declares provisionTenantAdmin and seedTenantCompanySettings | VERIFIED | `server/storage.ts` lines 425–426 |
| 3 | DatabaseStorage implements both methods using db.transaction / onConflictDoNothing | VERIFIED | Lines 2384–2421: `provisionTenantAdmin` uses `db.transaction`, `seedTenantCompanySettings` uses `.onConflictDoNothing()` |
| 4 | provisionTenantAdmin inserts users + user_tenants atomically | VERIFIED | Single `db.transaction` block inserts both rows (lines 2389–2405) |
| 5 | invalidateTenantCache exported from server/middleware/tenant.ts | VERIFIED | `export function invalidateTenantCache(hostname: string): void` at line 15; hostnameCache is NOT exported |
| 6 | POST /tenants/:id/provision creates users+user_tenants, returns {userId, email, password} once | VERIFIED | Route at lines 363–392, calls `provisionTenantAdmin`, returns 201 with plaintext password in body |
| 7 | POST /tenants (create tenant) calls seedTenantCompanySettings after createTenant+addDomain | VERIFIED | Line 227: `await storage.seedTenantCompanySettings(tenant.id, name.trim())` before `res.status(201)` |
| 8 | POST /tenants/:id/domains calls invalidateTenantCache after addDomain | VERIFIED | Line 315: `invalidateTenantCache(hostname)` between `addDomain` and `res.status(201)` |
| 9 | DELETE /domains/:id calls invalidateTenantCache(domain.hostname) after removeDomain | VERIFIED | Line 351: `invalidateTenantCache(domain.hostname)` after `storage.removeDomain(id)`, before `res.status(204)` |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260515000002_phase43_users_password.sql` | ALTER TABLE adding nullable password column | VERIFIED | Contains exact required statement |
| `shared/schema.ts` | password field on users table | VERIFIED | Line 20: `password: text("password"),  // bcrypt hash; null for OAuth-only users` |
| `server/storage.ts` | IStorage + DatabaseStorage provision + seed methods | VERIFIED | Interface at lines 425–426, implementation at lines 2384–2421 |
| `server/middleware/tenant.ts` | exported invalidateTenantCache function | VERIFIED | Line 15, hostnameCache remains module-private |
| `server/routes/super-admin.ts` | provision endpoint + cache invalidation + settings seed | VERIFIED | All four wiring points confirmed |
| `client/src/hooks/useSuperAdmin.ts` | ProvisionResult type + useSuperAdminProvision hook | VERIFIED | Lines 297–316 |
| `client/src/pages/SuperAdmin.tsx` | ProvisionDialog component + Provision Admin button per row | VERIFIED | Component at lines 234–341, button at line 509, dialog wired at lines 534–538 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| POST /tenants/:id/provision | storage.provisionTenantAdmin | `await storage.provisionTenantAdmin(tenantId, email.trim(), hashedPassword)` | WIRED | Line 381 |
| POST /tenants | storage.seedTenantCompanySettings | `await storage.seedTenantCompanySettings(tenant.id, name.trim())` | WIRED | Line 227 |
| POST /tenants/:id/domains | invalidateTenantCache | `invalidateTenantCache(hostname)` | WIRED | Line 315 |
| DELETE /domains/:id | invalidateTenantCache | `invalidateTenantCache(domain.hostname)` | WIRED | Line 351 |
| ProvisionDialog | POST /api/super-admin/tenants/:id/provision | `superAdminFetch` in `useSuperAdminProvision` | WIRED | `/api/super-admin/tenants/${tenantId}/provision` |
| provision.data | ProvisionResult.password | `provision.data.password` rendered in Input | WIRED | Line 323 in SuperAdmin.tsx |
| superAdminRouter | /api/super-admin/* | `app.use("/api/super-admin", superAdminRouter)` in routes.ts | WIRED | server/routes.ts line 32 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| ProvisionDialog | provision.data | POST /api/super-admin/tenants/:id/provision → storage.provisionTenantAdmin → db.transaction → users + user_tenants | Yes — DB insert in transaction, returns userId | FLOWING |
| POST /tenants handler | companySettings row | storage.seedTenantCompanySettings → db.insert(companySettings).onConflictDoNothing() | Yes — real DB insert with tenant name, America/New_York, en | FLOWING |
| resolveTenantMiddleware | hostnameCache | invalidateTenantCache deletes entry; next request re-queries DB via JOIN domains → tenants | Yes — cache miss triggers live DB lookup | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED for API routes that require a running server and DB connection. TypeScript compilation (`npm run check`) exits 0 — no type errors.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npm run check` | Exit 0, no output | PASS |
| Migration file exists with correct SQL | `grep "ADD COLUMN IF NOT EXISTS password text"` | Match found | PASS |
| invalidateTenantCache exported (not hostnameCache) | grep checks | export function confirmed, const not exported | PASS |
| 409 wired in provision route | `(err as any)?.code === "23505"` | Present at line 385 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TO-05 | 43-01, 43-02, 43-03 | Super-admin pode provisionar o admin inicial de um tenant — criar um usuário na tabela `users` com email e senha bcrypt e inserir na `user_tenants` com role='admin' | SATISFIED | `provisionTenantAdmin` uses `db.transaction` inserting both `users` (with bcrypt hash) and `user_tenants` (role='admin'). Route returns credentials. UI dialog shown once. |
| TO-06 | 43-01, 43-02 | Ao criar um tenant, company settings padrão são inseridos automaticamente (nome do tenant, fuso horário padrão, locale padrão) | SATISFIED | `seedTenantCompanySettings` called in POST /tenants with `timeZone: "America/New_York"` and `language: "en"` |
| TO-07 | 43-02 | O cache LRU do middleware de resolução é invalidado quando um domínio é adicionado ou removido | SATISFIED | `invalidateTenantCache(hostname)` called in both POST /tenants/:id/domains and DELETE /domains/:id |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, empty returns, or stub patterns found in phase 43 files. The provision route correctly returns plaintext password once — not stored after response (comment confirms intent).

### Human Verification Required

#### 1. Provision Admin Flow

**Test:** Log in to /superadmin, click "Provision Admin" for a tenant, enter an email, click Provision
**Expected:** Success view shows email + generated password fields with individual Copy buttons; clicking Done closes dialog and re-opening shows the email form (password gone from state)
**Why human:** React mutation state and clipboard API require browser interaction; `provision.reset()` behavior on dialog close cannot be confirmed from static analysis alone

#### 2. Duplicate Email Returns 409 in Dialog (Not Crash)

**Test:** Provision the same email twice on the same tenant
**Expected:** Second attempt shows an inline error message ("Email already registered") inside the dialog — dialog stays open, no page crash
**Why human:** Requires live API call to trigger Postgres `23505` unique violation and confirm the `onError` callback populates `setError` state correctly

#### 3. New Tenant Booking Flow Works Immediately

**Test:** Create a new tenant via "Add Tenant" (name/slug/domain), then make an HTTP request to that tenant's booking flow (or check DB for companySettings row)
**Expected:** `company_settings` row exists for the new tenant with correct name, timezone=America/New_York, language=en; booking flow does not return 500
**Why human:** Requires DB write and subsequent read to confirm the row was inserted

#### 4. Domain Cache Invalidation Without Restart

**Test:** Add a new hostname to an existing tenant, then send an HTTP request with `Host: <new-hostname>` to the server
**Expected:** Request resolves to the correct tenant on the first attempt (no 404 "Unknown tenant" and no server restart required)
**Why human:** Requires live server with LRU cache state — can't verify cache behavior from static analysis

### Gaps Summary

No gaps found. All 9 truths verified. All artifacts exist and are substantive. All key links are wired. TypeScript check passes cleanly. The four human verification items are confirmations of runtime behavior (DB writes, browser state, LRU cache operation) that cannot be verified statically.

---

_Verified: 2026-05-13_
_Verifier: Claude (gsd-verifier)_
