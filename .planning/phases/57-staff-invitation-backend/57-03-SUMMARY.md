---
phase: 57-staff-invitation-backend
plan: 03
subsystem: auth-api
tags: [auth, staff-invitations, sessions, drizzle-transaction, multi-tenant]

# Dependency graph
requires:
  - phase: 57-staff-invitation-backend
    plan: 01
    provides: findStaffInvitation / markInvitationAccepted storage methods + staffInvitations table
  - phase: 38-multi-tenant-foundation
    provides: users / user_tenants / domains / tenants tables
  - phase: 45-tenant-admin-auth
    provides: req.session.adminUser shape (id/email/role/tenantId)
provides:
  - GET /api/auth/validate-invite (token lookup → metadata or 410)
  - POST /api/auth/accept-invite (atomic user + user_tenants creation, session, adminUrl)
affects: [58 staff invitation frontend — /accept-invite page consumes both endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public (no-session) auth routes mounted under resolveTenantMiddleware — uses res.locals.storage when applicable but falls back to direct db queries for cross-tenant resolution"
    - "Atomic Drizzle transaction (db.transaction) for users insert + user_tenants insert — both succeed or both rollback"
    - "Invitation mark-accepted runs AFTER transaction commit — prevents marking a token used when user creation fails"
    - "Tenant-scoped session establishment via req.session.adminUser inside accept-invite — newly created staff is logged in immediately"

key-files:
  modified:
    - server/routes/auth.ts

key-decisions:
  - "Mark invitation accepted OUTSIDE the user-creation transaction — keeps the transaction tight (user + user_tenants only) and ensures invitation acceptance only happens after a confirmed user/membership exists"
  - "companyName resolution falls back from storage.getCompanySettings() to direct db.select on companySettings keyed by invitation.tenantId — handles the case where validate-invite is hit on the platform domain (different tenant scope than the invitation)"
  - "adminUrl built from primary domain (domains.isPrimary = true) inside the transaction — if no primary domain found, falls back to req.protocol + req.hostname"
  - "Best-effort name splitting (firstName = first token, lastName = remainder) with filter(Boolean) to handle empty/whitespace-only names without producing empty-string lastName"
  - "410 Gone (not 404) returned for invalid/expired/used tokens — semantically correct for a resource that existed but is no longer available"

patterns-established:
  - "Cross-tenant token validation pattern: storage scoped to current hostname tenant, but token resolution (findStaffInvitation) uses global db registry — allows public invite links on any domain"
  - "Reuse of bcrypt.hash(password, 12) cost factor consistent with tenant-login / reset-password / change-password elsewhere in auth.ts"

requirements-completed: [SF-03, SF-04]

# Metrics
duration: 5min
completed: 2026-05-15
---

# Phase 57 Plan 03: Staff Invitation Backend — Validate + Accept Routes Summary

**Two new public auth endpoints (GET /validate-invite, POST /accept-invite) that turn a hashed-token invitation into a fully-provisioned tenant staff user with an active session and a tenant-scoped adminUrl redirect target.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-15T02:11:57Z
- **Completed:** 2026-05-15T02:17:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `GET /api/auth/validate-invite?token=...` returns `{ email, role, companyName, tenantId }` for valid tokens; returns 410 Gone for expired/used/missing tokens; returns 400 only on a missing or non-string token parameter
- `POST /api/auth/accept-invite` validates token (410 on failure), hashes password with bcrypt (cost 12), and runs an atomic `db.transaction` that:
  - Inserts a new `users` row (tenant-scoped, with role copied from the invitation, firstName/lastName split from `name`)
  - Inserts the matching `user_tenants` join row
  - Resolves the tenant's primary `domains` row for the redirect URL
- After the transaction commits, `storage.markInvitationAccepted(invitation.id)` is called — guaranteeing invitations are only "used" when a user actually exists
- Session established via `req.session.adminUser = { id, email, role, tenantId }` (same shape as tenant-login)
- Response returns `{ adminUrl }` — either `https://{primaryHostname}/admin` or the local fallback `{protocol}://{hostname}/admin`
- companyName cross-tenant fallback: if `storage.getCompanySettings()` returns nothing or the wrong tenant, a direct `db.select(...).from(companySettings).where(eq(companySettings.tenantId, invitation.tenantId))` query is used
- `npm run check` exits 0 with zero TypeScript errors

## Task Commits

1. **Task 1: GET /auth/validate-invite + POST /auth/accept-invite** — `e3c83d7` (feat)

## Files Created/Modified
- `server/routes/auth.ts` — added 3 imports (`db`, schema tables, `eq`/`and`) + 140 new lines for the two routes appended before `export default router`

## Decisions Made
- Plan executed exactly as written.
- All key decisions captured in frontmatter `key-decisions` for inheritance by Phase 58 (frontend will consume both endpoints).

## Deviations from Plan

None — plan executed exactly as written. The plan-supplied implementation was complete and accurate; only a minor robustness tweak was applied:

**[Rule 1 - Defensive] Filter empty tokens in name split**
- **Found during:** Task 1 implementation
- **Issue:** `(name ?? '').trim().split(/\s+/)` returns `['']` for an empty/whitespace-only name, which would result in `firstName = ''` (an empty string) rather than `null`
- **Fix:** Added `.filter(Boolean)` after the split so empty results yield `nameParts = []` and `firstName` correctly defaults to `null`
- **Files modified:** server/routes/auth.ts
- **Commit:** e3c83d7 (folded into the task commit)

## Authentication Gates
None — both routes are explicitly public (no session required).

## Issues Encountered
- Working tree contained pre-existing modifications from a parallel executor (plan 57-02: `server/routes.ts` + new file `server/routes/staff-invitations.ts`). Staged `server/routes/auth.ts` individually to avoid committing parallel-executor work into this plan's commit.

## User Setup Required
None new. The `supabase db push` migration from plan 57-01 is still required before these endpoints can read/write `staff_invitations` at runtime — already documented in 57-01-SUMMARY.md.

## Next Phase Readiness
- Phase 58 (Staff Invitation Frontend) can now consume:
  - `GET /api/auth/validate-invite?token=...` → render the accept-invite form pre-filled with `email`, `role`, and `companyName`
  - `POST /api/auth/accept-invite` with `{ token, name, password }` → on 201, follow `response.adminUrl` to land the freshly-logged-in user on their tenant's admin dashboard
  - 410 responses from either endpoint → render the "this invitation has expired or already been used" empty state

## Self-Check: PASSED

- FOUND: server/routes/auth.ts (validate-invite + accept-invite routes added at lines 281 and 328)
- FOUND: `db.transaction` in server/routes/auth.ts (line 359)
- FOUND: `markInvitationAccepted` call in server/routes/auth.ts (line 397)
- FOUND: 410 status code returned for both routes (lines 293, 344)
- FOUND: commit e3c83d7 (Task 1)
- `npm run check`: PASSED (exit 0, no errors)

---
*Phase: 57-staff-invitation-backend*
*Completed: 2026-05-15*
