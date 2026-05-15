---
phase: 61-custom-domain-backend-middleware
verified: 2026-05-14T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (1 user action pending — supabase db push)
human_verification:
  - test: "Apply Supabase migration to live DB"
    expected: "After `supabase db push`, the live DB `domains` table has columns `verified BOOLEAN NOT NULL DEFAULT false`, `verified_at TIMESTAMPTZ`, `verification_token TEXT`, and all existing `is_primary = true` rows have `verified = true` and `verified_at = created_at`"
    why_human: "Migration must be applied via Supabase CLI per project memory (drizzle-kit push has TTY issues). Cannot run from automated verifier."
  - test: "Existing primary domain still resolves end-to-end"
    expected: "Visiting `{slug}.xkedule.com` returns the tenant home page (HTTP 200) after migration is applied. The backfill keeps `is_primary=true` rows verified."
    why_human: "Requires running server + DNS + live request; verifier cannot exercise the full request lifecycle."
  - test: "Unverified custom domain returns 404"
    expected: "POST `/api/admin/domains` with `{ hostname: 'example.com' }`, then visit `example.com` — middleware returns HTTP 404 `{ message: 'Unknown tenant' }` because verified=false."
    why_human: "Requires running server and DNS pointing the test hostname at it; cannot exercise the full request lifecycle from grep."
  - test: "DNS TXT verification flow end-to-end"
    expected: "Register a domain, add the returned TXT record at `_xkedule.<hostname>`, call POST `/api/admin/domains/:id/verify` — receive `{ verified: true }`, then a request to that hostname now resolves to the tenant."
    why_human: "Requires DNS provider access and live propagation; only a human can complete the round-trip."
  - test: "Verify endpoint friendly errors"
    expected: "Calling verify before TXT propagation returns HTTP 400 `{ verified: false, message: 'DNS record not found...' }`; calling with wrong record value returns 400 `{ verified: false, message: 'TXT record found but token did not match...' }`."
    why_human: "Requires triggering ENOTFOUND/ENODATA from a real DNS resolver; verifier cannot simulate."
  - test: "Cross-tenant isolation"
    expected: "Tenant A authenticated against tenantA.xkedule.com cannot view/verify/delete tenant B's domains. Every storage call is filtered by `res.locals.tenant.id`."
    why_human: "Confirmed by code review (all storage methods take tenantId), but live cross-tenant attack should be smoke-tested before milestone close."
---

# Phase 61: Custom Domain Backend + Middleware — Verification Report

**Phase Goal:** Tenants can register, verify, list, and remove custom domains via authenticated API endpoints, and the tenant resolution middleware blocks requests to unverified custom domains while continuing to serve the primary `*.xkedule.com` subdomain.

**Verified:** 2026-05-14
**Status:** human_needed — all code in place; awaits `supabase db push` and live smoke tests
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP)

| # | Truth (Success Criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `domains` table has `verified`, `verifiedAt`, `verificationToken` columns; existing primaries backfilled `verified=true` | ? UNCERTAIN (code complete, migration not yet applied) | Migration file `supabase/migrations/20260522000000_phase61_domain_verification.sql` contains the three `ADD COLUMN IF NOT EXISTS` + backfill UPDATE; Drizzle schema mirrors them in `shared/schema.ts:48-50`. Live DB application is a pending user action (tracked in STATE.md). |
| 2 | `POST /api/admin/domains` returns 201 with `{ id, hostname, verificationToken, instructions }`; row created with `verified=false, isPrimary=false`, 32-byte hex token; TXT record at `_xkedule.<hostname>` described | ✓ VERIFIED | `server/routes/admin-domains.ts:53-94` implements endpoint; `server/storage.ts:2504-2520` generates token via `crypto.randomBytes(32).toString("hex")` and inserts `verified=false, isPrimary=false`; response includes full instructions block with `recordName: _xkedule.${hostname}`. |
| 3 | `POST /api/admin/domains/:id/verify` performs `dns.promises.resolveTxt(_xkedule.<hostname>)`; sets `verified=true, verifiedAt=now()` on match; 400 `{ verified: false, message }` on mismatch | ✓ VERIFIED | `server/routes/admin-domains.ts:97-149` calls `dns.resolveTxt`, compares to stored token, flips state via `storage.verifyDomain(id, tenant.id)` which sets `verified: true, verifiedAt: new Date()` (`server/storage.ts:2522-2529`). Mismatch and ENOTFOUND/ENODATA branches both return 400. |
| 4 | `DELETE /api/admin/domains/:id` removes non-primary; returns 409 for primary; calls `invalidateTenantCache(hostname)` | ✓ VERIFIED | `server/routes/admin-domains.ts:152-180` calls `storage.removeDomainForTenant`; `server/storage.ts:2531-2545` short-circuits with `isPrimary: true` for primary rows (router maps to 409). `invalidateTenantCache(result.hostname)` invoked at line 174 after successful delete. |
| 5 | `GET /api/admin/domains` returns current tenant's rows (id, hostname, isPrimary, verified, verifiedAt, createdAt) — no other tenant's domains | ✓ VERIFIED | `server/routes/admin-domains.ts:27-50` calls `storage.getDomainsForTenant(tenant.id)`; storage filters by `tenantId` (`server/storage.ts:2547-2553`). Response maps strip `verificationToken` (one-time secret pattern). |
| 6 | Unverified non-primary hostname returns 404 from `resolveTenantMiddleware`; primary `*.xkedule.com` bypasses | ✓ VERIFIED | `server/middleware/tenant.ts:33-42` JOIN now selects `isPrimary` + `verified`; gate at lines 55-58 returns 404 when `!row.isPrimary && !row.verified` BEFORE `hostnameCache.set` at line 61. Cache invariant holds: only ONE `hostnameCache.set` call site, located after the gate. |

**Score:** 5/6 fully verified in code; truth #1 verified at code/migration level but live DB application is a pending user action.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `supabase/migrations/20260522000000_phase61_domain_verification.sql` | ADD COLUMN verified/verified_at/verification_token + backfill | ✓ VERIFIED | 17 lines; contains all three `ADD COLUMN IF NOT EXISTS` and the `is_primary = true` backfill UPDATE. |
| `shared/schema.ts` | Drizzle `domains` table extended with verified/verifiedAt/verificationToken | ✓ VERIFIED | Lines 48-50 add `verified` (notNull, default false), `verifiedAt` (TIMESTAMPTZ), `verificationToken` (text). `DomainRow` infers via `$inferSelect`. |
| `server/storage.ts` | IStorage + DatabaseStorage impls for 5 verification methods | ✓ VERIFIED | Interface lines 439-443 declare all five signatures; implementations at lines 2504-2562 cover `addDomainWithVerification`, `verifyDomain`, `removeDomainForTenant`, `getDomainsForTenant`, `findDomainById`. Existing `addDomain/removeDomain/getTenantDomains` untouched. |
| `server/routes/admin-domains.ts` | Express Router with 4 endpoints, `requireAdmin` on each | ✓ VERIFIED | 182 lines; 4 endpoints (GET, POST, POST /:id/verify, DELETE /:id); 6 `requireAdmin` references (1 import + 4 usages + 1 jsdoc); `dns.resolveTxt` and `invalidateTenantCache` both used. |
| `server/routes.ts` | Mount `adminDomainsRouter` at `/api/admin` AFTER `resolveTenantMiddleware` | ✓ VERIFIED | Import at line 32; mount at line 116 (`app.use("/api/admin", adminDomainsRouter)`) — 73 lines AFTER the `resolveTenantMiddleware` mount at line 43. |
| `server/middleware/tenant.ts` | Verification gate before `hostnameCache.set` | ✓ VERIFIED | JOIN selects `isPrimary` + `verified` (lines 36-37); gate at lines 55-58 returns 404 + `return` before `hostnameCache.set` at line 61. Same "Unknown tenant" message as the `!row` branch (prevents enumeration). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `server/storage.ts` | `shared/schema.ts` (domains) | Drizzle insert references `verificationToken` field | ✓ WIRED | Storage line 2516 uses `verificationToken` in insert values; only compiles if `domains.verificationToken` exists in the Drizzle schema, which it does (line 50). TypeScript `npm run check` passes. |
| Migration | `shared/schema.ts` | Column names match snake_case <-> camelCase | ✓ WIRED | `verified_at` ↔ `verifiedAt`, `verification_token` ↔ `verificationToken`, `verified` ↔ `verified` — names match Drizzle conventions. |
| `server/routes/admin-domains.ts` | `server/storage.ts` | `storage.{addDomainWithVerification, verifyDomain, removeDomainForTenant, getDomainsForTenant, findDomainById}` calls | ✓ WIRED | All 5 storage methods invoked (lines 35, 74, 110, 129, 165). `storage` is the local alias for `res.locals.storage`. (gsd-tools regex flagged this as unfound due to indirection through alias — manual grep confirms wiring.) |
| `server/routes/admin-domains.ts` | `server/middleware/tenant.ts` | `invalidateTenantCache(hostname)` on verify success + delete | ✓ WIRED | Imported at line 16; called at line 130 (verify) and line 174 (delete). |
| `server/routes.ts` | `server/routes/admin-domains.ts` | `app.use("/api/admin", adminDomainsRouter)` AFTER resolveTenantMiddleware | ✓ WIRED | Mount at line 116; `resolveTenantMiddleware` mount at line 43 (73 lines earlier). Tenant scoping guaranteed. |
| `server/routes/admin-domains.ts` | `node:dns` | `dns.promises.resolveTxt(_xkedule.${hostname})` | ✓ WIRED | Imported via `import { promises as dns } from "node:dns"` (line 14); used at line 126 as `dns.resolveTxt(\`_xkedule.${domain.hostname}\`)`. |
| `server/middleware/tenant.ts` | `shared/schema.ts` (domains) | SELECT `domains.isPrimary` + `domains.verified` in JOIN | ✓ WIRED | Lines 36-37 select both columns. (gsd-tools regex false negative — manual grep confirms.) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| GET `/api/admin/domains` | `domains` (response) | `storage.getDomainsForTenant(tenant.id)` → real Drizzle SELECT from `domains` table filtered by tenantId | Yes (Drizzle query) | ✓ FLOWING |
| POST `/api/admin/domains` | `verificationToken` | `crypto.randomBytes(32).toString("hex")` → real entropy, then persisted by Drizzle INSERT | Yes (random + DB write) | ✓ FLOWING |
| POST `/api/admin/domains/:id/verify` | `records` (TXT lookup) | `dns.resolveTxt(_xkedule.<hostname>)` → real DNS resolver call | Yes (live DNS) | ✓ FLOWING |
| `resolveTenantMiddleware` | `row.isPrimary`, `row.verified` | Drizzle JOIN SELECT from `domains` + `tenants` | Yes (DB read) | ✓ FLOWING |

No hollow props or hardcoded empty sources detected.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| TypeScript compiles cleanly | `npm run check` | No errors | ✓ PASS |
| Migration file shape | `grep -E "ADD COLUMN.*verified|verified_at|verification_token" 20260522000000_phase61_domain_verification.sql` | 3 column adds + backfill UPDATE present | ✓ PASS |
| 4 admin endpoints registered | `grep -E "adminDomainsRouter\.(get|post|delete)" server/routes/admin-domains.ts` | 4 matches (GET, POST, POST :id/verify, DELETE :id) | ✓ PASS |
| `requireAdmin` guards every endpoint | `grep requireAdmin server/routes/admin-domains.ts` | 6 references (1 import + 4 endpoint usages + 1 jsdoc) | ✓ PASS |
| Single `hostnameCache.set` call site (cache invariant) | `grep hostnameCache.set server/middleware/tenant.ts` | 1 match, at line 61 (AFTER the gate at line 55) | ✓ PASS |
| Verification gate exists before cache set | `grep "!row.isPrimary && !row.verified" server/middleware/tenant.ts` | 1 match at line 55 | ✓ PASS |
| Same 404 message for unknown and unverified (anti-enumeration) | `grep "Unknown tenant" server/middleware/tenant.ts` | 2 matches (`!row` branch + verification gate) | ✓ PASS |
| Live HTTP smoke (curl endpoints) | (skipped — requires running server + auth + DB migration applied) | — | ? SKIP (routed to human) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CD-01 | 61-01 | `domains` table extended with `verified/verifiedAt/verificationToken` | ✓ SATISFIED (code) / pending live migration | Migration file + Drizzle schema + 5 storage methods all in place |
| CD-02 | 61-02 | POST /api/admin/domains returns `{ id, hostname, verificationToken, instructions }` | ✓ SATISFIED | `admin-domains.ts:53-94`; returns 201 with full payload + 32-byte hex token |
| CD-03 | 61-02 | POST /api/admin/domains/:id/verify performs `dns.promises.resolveTxt`, flips verified=true on match | ✓ SATISFIED | `admin-domains.ts:97-149` + `storage.verifyDomain` sets verified=true + verifiedAt=now() |
| CD-04 | 61-02 | DELETE /api/admin/domains/:id removes non-primary; 409 for primary; invalidates cache | ✓ SATISFIED | `admin-domains.ts:152-180`; 409 branch at line 171; `invalidateTenantCache` at line 174 |
| CD-05 | 61-02 | GET /api/admin/domains returns current tenant's rows (id, hostname, isPrimary, verified, verifiedAt, createdAt) | ✓ SATISFIED | `admin-domains.ts:27-50`; storage filters by tenantId; response shape excludes verificationToken (one-time secret pattern) |
| CD-06 | 61-03 | Middleware blocks unverified non-primary; primary bypasses | ✓ SATISFIED | `tenant.ts:55-58` gate before cache set; "Unknown tenant" message identical to unknown-host case |

All 6 requirements satisfied at the code level. Live verification of CD-01 (DB migration applied), CD-03 (real DNS round-trip), and CD-06 (live HTTP 404 behavior) is routed to human verification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No TODO/FIXME/placeholder markers found in any phase 61 file | — | None |
| — | — | No stub returns / hardcoded empties detected | — | None |
| — | — | No console.log-only handlers | — | None |

### Human Verification Required

See frontmatter `human_verification` block above. Six items routed to human:
1. Apply Supabase migration (`supabase db push`) to live DB
2. Existing primary domain resolves after migration
3. Unverified custom domain → 404 (live request)
4. DNS TXT verification round-trip (real DNS provider)
5. Verify endpoint friendly errors for ENOTFOUND / mismatch
6. Cross-tenant isolation smoke test

### Gaps Summary

No code-level gaps. The phase delivers:

- **Schema layer:** Migration file + Drizzle schema mirror the three new columns; backfill keeps existing primaries servable.
- **Storage layer:** Five new IStorage methods with DatabaseStorage implementations; existing super-admin domain methods untouched.
- **Route layer:** 4-endpoint router with `requireAdmin` on every endpoint, full tenant scoping via `res.locals`, DNS TXT verification with friendly error mapping, reserved-hostname guard for `*.xkedule.com`, and one-time-secret pattern on `verificationToken`.
- **Middleware layer:** Verification gate before cache set; cache invariant ("anything in cache is safe to serve") preserved; primary domains bypass via `isPrimary` clause.
- **Wiring:** Router mounted at `/api/admin` 73 lines AFTER `resolveTenantMiddleware`; `invalidateTenantCache` called from both verify and delete handlers; `npm run check` passes.

The only outstanding item is the pending user action `supabase db push` (already tracked in STATE.md, called out in 61-01-SUMMARY and 61-03-SUMMARY). Until that runs, the live DB has no `verified` column and the middleware JOIN would fail — but that is a deployment step, not a code gap.

REQUIREMENTS.md table currently lists CD-02 through CD-05 as "Pending" even though they are now satisfied in code by 61-02 — recommend updating that status table when closing the phase. CD-01 and CD-06 are already marked Complete there.

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
