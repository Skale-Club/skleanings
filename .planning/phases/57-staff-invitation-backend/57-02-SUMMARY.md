---
phase: 57-staff-invitation-backend
plan: 02
subsystem: api
tags: [staff-invitations, admin-api, resend, multi-tenant, requireAdmin]

# Dependency graph
requires:
  - phase: 57-01
    provides: staffInvitations table + 5 IStorage methods (createStaffInvitation, getPendingInvitations, revokeStaffInvitation, findStaffInvitation, markInvitationAccepted)
  - phase: 47-password-reset
    provides: buildPasswordResetEmail pattern (pure function returning subject/html/text)
  - phase: 56-tenant-setup-checklist
    provides: /api/admin mount pattern using res.locals.storage + requireAdmin
provides:
  - buildInviteEmail() pure function exported from server/lib/email-resend.ts
  - server/routes/staff-invitations.ts router with 3 endpoints (POST invite, DELETE revoke, GET list pending)
  - staffInvitationRouter mounted at /api/admin in registerRoutes (after resolveTenantMiddleware)
affects: [57-03 validate/accept invite endpoints, 58 staff invitation frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget email send: void IIFE wraps sendResendEmail so route returns 201 immediately even if Resend is slow/down"
    - "409-vs-404 disambiguation via direct db query: getPendingInvitations only returns acceptedAt IS NULL rows, so a second targeted query distinguishes accepted invitations from missing ones"
    - "SITE_URL fallback: process.env.SITE_URL ?? `${req.protocol}://${req.hostname}` matches reset-password flow for dev/prod parity"

key-files:
  created:
    - server/routes/staff-invitations.ts
  modified:
    - server/lib/email-resend.ts
    - server/routes.ts

key-decisions:
  - "Added GET /api/admin/staff/invitations even though plan only required POST + DELETE — the frontend (Phase 58) needs a listing endpoint to drive the pending-invitations UI, and getPendingInvitations is already available from 57-01 (Rule 2: auto-add missing critical functionality for the documented downstream consumer)"
  - "409 disambiguation done with a direct db query rather than adding a 6th IStorage method — keeps storage interface minimal and matches the plan's suggested implementation (the route file already imports db/staffInvitations for the 409 check)"
  - "role parameter validated via z.enum(['staff', 'admin']).default('staff') — matches the staff_invitations.role column shape from 57-01"

patterns-established:
  - "Admin endpoints that send tenant-branded transactional emails: resolve companyName from res.locals.storage.getCompanySettings() inside the fire-and-forget IIFE so a missing settings row doesn't block the response"
  - "Tenant-scoped DELETE flows: filter by both id AND tenantId in the supplemental 409-check query to avoid cross-tenant data leaks"

requirements-completed: [SF-01, SF-05]

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 57 Plan 02: Staff Invitation API — Invite + Revoke Summary

**buildInviteEmail() pure function + 3-endpoint admin router (POST invite with Resend fire-and-forget, DELETE with 200/404/409 disambiguation, GET pending list) mounted at /api/admin after resolveTenantMiddleware**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-15T02:12:01Z
- **Completed:** 2026-05-15T02:14:54Z
- **Tasks:** 2
- **Files changed:** 3 (1 created, 2 modified)

## Accomplishments
- `buildInviteEmail(inviteUrl, companyName, inviteeEmail)` exported from `server/lib/email-resend.ts` mirroring buildPasswordResetEmail HTML/text structure with brand-compliant pill CTA (`#FFFF01` background, black bold text, `border-radius: 9999px`) and `#1C53A3` heading
- POST `/api/admin/staff/invite` validates `{email, role}` via Zod (`role` defaults to `"staff"`), calls `storage.createStaffInvitation(tenant.id, email, role)`, builds `${SITE_URL}/accept-invite?token=${rawToken}` URL, and fires-and-forgets `sendResendEmail(...)` so the 201 returns instantly even if Resend is down
- DELETE `/api/admin/staff/invite/:id` returns:
  - `200 { message: "Invitation revoked" }` on successful revoke
  - `409 { message: "Invitation already accepted" }` when the row exists for this tenant with `acceptedAt IS NOT NULL` (direct db query with `eq(id) AND eq(tenantId) AND isNotNull(acceptedAt)`)
  - `404 { message: "Invitation not found" }` when no row exists for this tenant at all
- GET `/api/admin/staff/invitations` (added per Rule 2 for downstream Phase 58 consumer) returns `{ invitations: StaffInvitation[] }` scoped to the authenticated tenant via `getPendingInvitations(tenant.id)`
- All routes guarded by `requireAdmin` and live inside `resolveTenantMiddleware` scope (mounted at line 112 of `server/routes.ts`, after `adminSetupRouter`)
- `npm run check` exits 0 — no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: buildInviteEmail() in email-resend.ts** — `698e6c9` (feat)
2. **Task 2: staffInvitationRouter + mount in routes.ts** — `1fd856e` (feat)

## Files Created/Modified
- `server/lib/email-resend.ts` — Appended `buildInviteEmail()` after `buildWelcomeEmail` (lines 262-308). Pure function, no DB calls. 48-hour expiry messaging.
- `server/routes/staff-invitations.ts` (created) — 113 lines. Imports `db`, `staffInvitations`, `StaffInvitation` for 409-check. Exports `staffInvitationRouter` with POST/DELETE/GET routes.
- `server/routes.ts` — Added import at line 31, mount at line 112 (`app.use("/api/admin", staffInvitationRouter)`)

## Decisions Made
- Added GET `/api/admin/staff/invitations` listing endpoint (Rule 2 — Phase 58 frontend needs this and the storage method already exists from 57-01)
- 409 disambiguation uses inline `db.select` rather than expanding `IStorage` — matches the plan's suggestion and keeps the storage surface minimal
- Used explicit `(inv: StaffInvitation)` parameter type in `.find()` callback to resolve a TypeScript implicit-any error (StaffInvitation imported from `@shared/schema`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript implicit-any in pending.find() callback**
- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** `pending.find((inv) => inv.id === id)` produced `TS7006: Parameter 'inv' implicitly has an 'any' type` because TS could not narrow the `IStorage.getPendingInvitations` return type through the optional `res.locals.storage` chain in this call site.
- **Fix:** Imported `type StaffInvitation` from `@shared/schema` and annotated the callback parameter explicitly: `pending.find((inv: StaffInvitation) => inv.id === id)`
- **Files modified:** `server/routes/staff-invitations.ts`
- **Commit:** `1fd856e` (included in Task 2)

### Rule 2 Addition

**1. [Rule 2 - Missing functionality] GET /api/admin/staff/invitations listing endpoint**
- **Reason:** Phase 58 frontend needs a way to drive the pending-invitations UI section. The storage layer (`getPendingInvitations`) was already shipped in 57-01 specifically for this purpose, and the plan's `<must_haves>` block explicitly references `getPendingInvitations` in `key_links`. Without the listing endpoint, Phase 58 would have to fetch via a side channel.
- **Documented in plan?** Not in the `<tasks>` block, but referenced indirectly via the route file's `<action>` snippet (lines 297-308 of 57-02-PLAN.md) showing a GET handler — so this is more of an inclusion than a deviation.

## Issues Encountered
None beyond the implicit-any TypeScript narrowing fix above.

## User Setup Required

No new environment variables or migrations required for this plan. The pending migration from 57-01 (`supabase db push` for `staff_invitations` table) remains the prerequisite for runtime functionality of these endpoints.

`SITE_URL` env var is read by the POST handler with a fallback to `${req.protocol}://${req.hostname}` — no action required unless production wants to override the invite URL host.

## Next Phase Readiness
- Plan 57-03 (validate-invite + accept-invite endpoints) can now build on the established router pattern; it will live in a separate router (public, no requireAdmin) since the accept flow runs before the user has a session.
- Phase 58 (frontend) is unblocked for the invite + revoke + list flows; it still depends on 57-03 for the accept-invite page.

## Self-Check: PASSED

- FOUND: `export function buildInviteEmail` in server/lib/email-resend.ts (line 262)
- FOUND: server/routes/staff-invitations.ts (113 lines, exports staffInvitationRouter)
- FOUND: `staffInvitationRouter` import in server/routes.ts (line 31)
- FOUND: `app.use("/api/admin", staffInvitationRouter)` in server/routes.ts (line 112)
- FOUND: POST /staff/invite route at staff-invitations.ts:22
- FOUND: DELETE /staff/invite/:id route at staff-invitations.ts:57
- FOUND: GET /staff/invitations route at staff-invitations.ts:99
- FOUND: 409 disambiguation block (acceptedAt IS NOT NULL direct db query)
- FOUND: commit 698e6c9 (Task 1)
- FOUND: commit 1fd856e (Task 2)
- npm run check: PASSED (exit 0, no errors)

---
*Phase: 57-staff-invitation-backend*
*Completed: 2026-05-15*
