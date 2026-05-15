---
phase: 61-custom-domain-backend-middleware
plan: 02
subsystem: api
tags: [express, dns, multi-tenant, custom-domains, admin-api, zod]

requires:
  - phase: 61-01
    provides: "IStorage.addDomainWithVerification / verifyDomain / removeDomainForTenant / getDomainsForTenant / findDomainById + domains.verified/verifiedAt/verificationToken columns"
  - phase: 40
    provides: "resolveTenantMiddleware + invalidateTenantCache(hostname)"
  - phase: 45
    provides: "requireAdmin middleware"
provides:
  - "GET /api/admin/domains — list tenant domains (verificationToken stripped)"
  - "POST /api/admin/domains — register custom hostname, returns verificationToken + DNS TXT instructions"
  - "POST /api/admin/domains/:id/verify — performs dns.promises.resolveTxt at _xkedule.<hostname>; flips verified=true on match and invalidates LRU cache"
  - "DELETE /api/admin/domains/:id — removes non-primary domain (409 for primary); invalidates LRU cache"
affects: [phase-62-custom-domain-frontend, phase-61-03-middleware-gate]

tech-stack:
  added: []
  patterns:
    - "node:dns promises.resolveTxt for DNS verification challenges"
    - "One-time secret pattern: verificationToken returned only on POST create, stripped from GET list"
    - "Reserved-hostname guard: API rejects *.xkedule.com to prevent system subdomain hijacking"

key-files:
  created:
    - server/routes/admin-domains.ts
  modified:
    - server/routes.ts

key-decisions:
  - "GET /domains response excludes verificationToken — token is a one-time secret revealed only on POST create; frontend must store it in component state since re-list will not return it"
  - "POST /domains rejects xkedule.com and *.xkedule.com — those are reserved system subdomains created by signup flow; tenants must not be able to hijack them via the admin API"
  - "DNS verification uses node:dns promises.resolveTxt against _xkedule.<hostname>; ENOTFOUND and ENODATA mapped to friendly 400 'DNS record not found. Wait for propagation.' to distinguish from 500 system errors"
  - "Verify endpoint short-circuits with 400 when domain.verificationToken is null — defensive for primary domains created pre-Phase-61"
  - "DELETE distinguishes 404 (not found) from 409 (is primary) via removeDomainForTenant result shape, never silently masking the difference"
  - "Cache invalidation called on verify success AND on delete — verify so the newly-verified domain becomes resolvable, delete so cached tenant isn't served for a removed hostname"
  - "Router mounted at /api/admin (not /api/admin/domains) — the router itself registers /domains paths; double-prefixing would yield /api/admin/domains/domains"

patterns-established:
  - "Admin-API DNS verification pattern: POST /resource → returns secret token + DNS instructions; POST /resource/:id/verify → resolveTxt at _<system>.<host> and match"
  - "Defensive Tenant scoping: every endpoint reads res.locals.tenant.id and passes it to storage methods that accept tenantId as a required filter — cross-tenant access impossible at storage layer"

requirements-completed: [CD-02, CD-03, CD-04, CD-05]

duration: 7min
completed: 2026-05-15
---

# Phase 61 Plan 02: Custom Domain Admin API Summary

**Tenant-admin Custom Domain API delivered: list, register-with-token, DNS-TXT verify, and delete, mounted at /api/admin behind resolveTenantMiddleware.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-15T14:20:44Z
- **Completed:** 2026-05-15T14:27:44Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Four-endpoint router for custom-domain self-service shipped at `server/routes/admin-domains.ts` (182 LOC)
- All endpoints guarded by `requireAdmin` and tenant-scoped via `res.locals.storage` / `res.locals.tenant.id`
- DNS challenge wired through `node:dns` promises.resolveTxt at `_xkedule.<hostname>` with friendly error mapping for ENOTFOUND/ENODATA
- LRU tenant cache invalidated on verify-success and delete so middleware (61-03) sees fresh DB state immediately
- Reserved-hostname guard rejects `*.xkedule.com` and `xkedule.com`, protecting system signup subdomains from admin-API hijack

## Task Commits

1. **Task 1: Create admin-domains router with 4 endpoints** — `860ef3e` (feat)
2. **Task 2: Mount adminDomainsRouter at /api/admin in server/routes.ts** — `2300d11` (feat)

**Plan metadata:** _pending — final commit_

## Files Created/Modified
- `server/routes/admin-domains.ts` (created) — Express router with 4 endpoints: GET /domains, POST /domains, POST /domains/:id/verify, DELETE /domains/:id. Imports `requireAdmin` and `invalidateTenantCache`; uses `res.locals.storage` for all data access (no Drizzle, no raw SQL — per CLAUDE.md storage-layer pattern).
- `server/routes.ts` (modified) — Added `import { adminDomainsRouter } from "./routes/admin-domains"` at the import block and `app.use("/api/admin", adminDomainsRouter)` mount after the staff-invitation router (inside resolveTenantMiddleware scope).
- `api/index.js` (modified) — Regenerated serverless bundle includes new router (esbuild output).

## Endpoint Signatures

| Method | Path | Auth | Request | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/domains` | requireAdmin | — | `{ domains: Array<{ id, hostname, isPrimary, verified, verifiedAt, createdAt }> }` (no verificationToken) |
| POST | `/api/admin/domains` | requireAdmin | `{ hostname: string }` | `201 { id, hostname, verificationToken, instructions: { recordType, recordName, recordValue, message } }` / `409` on duplicate / `400` on reserved or invalid |
| POST | `/api/admin/domains/:id/verify` | requireAdmin | — | `{ verified: true, alreadyVerified?: true }` / `400 { verified: false, message }` on mismatch or DNS-not-found / `404` if domain not in tenant |
| DELETE | `/api/admin/domains/:id` | requireAdmin | — | `{ message: "Domain removed" }` / `409` if primary / `404` if not found |

## Decisions Made
- **GET response excludes verificationToken:** One-time secret pattern. Frontend (Phase 62) must capture the token from the POST response and hold it in component state until the user clicks Verify; revisiting the page will not re-show it. Rationale: minimize token surface area in logs/screenshots and signal it as a one-shot DNS challenge.
- **Reject *.xkedule.com hostnames in POST:** The signup flow at `server/storage.ts:2597` provisions system subdomains. Allowing tenant admins to register `someone-elses-slug.xkedule.com` here would let them shadow another tenant's primary domain. Hard 400 with reserved-message is cheaper and clearer than detecting collisions downstream.
- **Verify uses node:dns promises.resolveTxt at _xkedule.<host>:** Matches the spec contract exactly. ENOTFOUND/ENODATA are DNS-not-yet-propagated states; we return 400 with "Wait a few minutes" — a 500 here would mis-signal a server bug.
- **DELETE distinguishes 404 vs 409 via storage result shape:** Storage returns `{ removed, isPrimary, hostname }` so the router can tell whether the row didn't exist (404) vs. it's the protected primary (409). Avoids over-permissive 500.

## Deviations from Plan

None — plan executed exactly as written. All four endpoints, validation rules, error mappings, and the mount line landed verbatim from the plan's `<action>` block.

**Total deviations:** 0
**Impact on plan:** None.

## Issues Encountered

None. `npm run check` and `npm run build` both passed on first run after Task 2. The wave-2 parallel pattern worked as designed: because `res.locals.storage` is loosely typed, the storage methods promised by 61-01 (`addDomainWithVerification`, `verifyDomain`, `removeDomainForTenant`, `getDomainsForTenant`, `findDomainById`) compile cleanly even though 61-01 hasn't been merged into this worktree branch yet. Runtime verification will happen post-merge.

## User Setup Required

None for this plan. Plan 61-01 carries the `supabase db push` requirement for the domains-table migration; this plan adds no new env vars or external service config.

## Hand-off Notes

**For Phase 62 (Custom Domain Frontend, CD-07/08):**
- The `verificationToken` field is returned **only** on `POST /api/admin/domains`. The component must persist it in local React state (or React Query mutation result cache) so the user can copy it into their DNS provider UI. Refreshing the page or refetching `GET /api/admin/domains` will not return the token.
- The POST response includes a ready-to-display `instructions` object with `recordType: "TXT"`, `recordName: "_xkedule.<hostname>"`, `recordValue: <token>`, and a human-readable `message`. Render these as a copy-to-clipboard panel.
- The Verify button should call `POST /api/admin/domains/:id/verify` and handle three states: `{ verified: true }` (success — refetch list), `{ verified: false, message }` (show inline error, keep dialog open), and HTTP 500 (toast generic failure).
- Delete on a primary domain returns 409 — surface this as a disabled state in the UI rather than letting the user click and fail.

**For Phase 61-03 (Middleware Verification Gate):**
- This router calls `invalidateTenantCache(hostname)` on both successful verify and delete, so the middleware's LRU cache stays consistent. No additional invalidation hook is needed from the middleware side.
- 61-03 should treat `verified = false` as cache-miss equivalent (404) to keep unverified hostnames un-routable until DNS proves ownership.

## Self-Check: PASSED

- FOUND: `server/routes/admin-domains.ts`
- FOUND: `.planning/phases/61-custom-domain-backend-middleware/61-02-SUMMARY.md`
- FOUND: commit `860ef3e` (Task 1 — router file)
- FOUND: commit `2300d11` (Task 2 — routes.ts mount)
- FOUND: `import { adminDomainsRouter }` in `server/routes.ts`
- FOUND: `app.use("/api/admin", adminDomainsRouter)` in `server/routes.ts`
- VERIFIED: `npm run check` passes
- VERIFIED: `npm run build` succeeds
