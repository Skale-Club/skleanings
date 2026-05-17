---
phase: 58-staff-invitation-frontend
plan: 02
subsystem: ui
tags: [react, react-query, shadcn, admin, staff-invitation, dialog]

requires:
  - phase: 57-staff-invitation-backend
    provides: "GET /api/admin/staff/invitations, POST /api/admin/staff/invite, DELETE /api/admin/staff/invite/:id (requireAdmin session-cookie auth)"
provides:
  - "Pending Invitations management UI inside /admin/users"
  - "Invite Staff Member dialog (email + role) wired to POST /api/admin/staff/invite"
  - "Revoke flow with AlertDialog confirmation wired to DELETE /api/admin/staff/invite/:id"
  - "Live React Query invalidation of ['/api/admin/staff/invitations'] on invite/revoke"
affects: [tenant-admin-onboarding, future-staff-management-screens]

tech-stack:
  added: []
  patterns:
    - "Cookie-session admin fetch: plain fetch with credentials: 'include' for /api/admin/* (distinct from bearer-token apiRequest used by /api/users)"
    - "Card-with-Table empty-state convention for admin list surfaces (Mail icon + muted text when zero rows)"

key-files:
  created:
    - "client/src/components/admin/PendingInvitationsSection.tsx"
  modified:
    - "client/src/components/admin/UnifiedUsersSection.tsx"

key-decisions:
  - "Used plain fetch with credentials: 'include' instead of apiRequest/authenticatedRequest because Phase 57 admin routes use requireAdmin session-cookie auth, not the bearer-token flow that /api/users relies on"
  - "Mounted PendingInvitationsSection BELOW the existing Team table inside UnifiedUsersSection — the 'who is on the team' surface stays primary; invitations are management/secondary"
  - "Kept the entire feature in one component file (no separate hook) per plan guidance — listing, invite, and revoke flows colocated for a small/focused surface"
  - "Used AlertDialog (not native confirm) for revoke confirmation to match the destructive-action pattern used elsewhere in the admin panel (UsersSection)"

patterns-established:
  - "Pending invitations card: Card + CardHeader (title + CTA Button) + CardContent (loader | empty-state | Table)"
  - "Inline dialog form validation: setInviteError on regex fail, mutation onError sets the same error slot — no separate form library needed"

requirements-completed: [SF-07]

duration: 3min
completed: 2026-05-15
---

# Phase 58 Plan 02: Staff Invitation Frontend — Pending Invitations Section Summary

**React Query-powered Pending Invitations card inside /admin/users with invite dialog (email + role) and revoke confirmation, all wired to the Phase 57 cookie-session endpoints**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-15T11:15:50Z
- **Completed:** 2026-05-15T11:19:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- New `PendingInvitationsSection` component renders a live list of pending staff invitations scoped to the current tenant via `useQuery(['/api/admin/staff/invitations'])`.
- "Invite Staff Member" button opens a shadcn Dialog with Email input + Role Select (staff/admin); submitting POSTs to `/api/admin/staff/invite`, invalidates the query, shows a success toast, and closes the dialog — the new invitation appears without a manual refresh.
- Trash icon on each row triggers an AlertDialog that names the invitee's email; confirming calls `DELETE /api/admin/staff/invite/:id` and the row disappears via query invalidation.
- Empty state shows a Mail icon and "No pending invitations." copy when the list is empty (not an empty table).
- Wired into `UnifiedUsersSection` so it ships immediately on the existing /admin/users route.

## Task Commits

1. **Task 1: Create PendingInvitationsSection.tsx** — `57d5c8f` (feat)
2. **Task 2: Wire PendingInvitationsSection into UnifiedUsersSection.tsx** — `831c5df` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

- `client/src/components/admin/PendingInvitationsSection.tsx` (created, 319 lines) — Pending invitations card, invite dialog, revoke AlertDialog; all React Query state, no extra hook file.
- `client/src/components/admin/UnifiedUsersSection.tsx` (modified) — Renders `<PendingInvitationsSection />` below `<UsersSection />` inside the existing `space-y-6` wrapper.

## Decisions Made

- **Auth pattern (cookie fetch):** Chose plain `fetch(url, { credentials: 'include' })` over the existing `apiRequest` / `authenticatedRequest` helpers from `@/lib/queryClient`. Those helpers expect a Supabase bearer token (used by `/api/users`), but the Phase 57 admin invitation router is mounted under `/api/admin` with `requireAdmin` which validates the express-session cookie — sending an Authorization header is unnecessary and the bearer token would not be present in the tenant-admin session context. Plain fetch with credentials matches the actual server contract.
- **Render order:** Team table first, Pending Invitations card second — keeps the primary "current team" surface above the management surface, matching admin UX convention.
- **Validation:** Lightweight inline regex check before POST (`/^[^@\s]+@[^@\s]+\.[^@\s]+$/`). Server uses Zod `email()` as the authoritative validator; this just gives instant user feedback without pulling in react-hook-form for two fields.
- **AlertDialogAction.preventDefault():** Called `e.preventDefault()` inside the destructive action's onClick so the dialog stays open while the DELETE is in flight; the `onSuccess` handler in `revokeMutation` then clears `invitationToRevoke` which closes the dialog atomically with the list refresh.

## Deviations from Plan

None - plan executed exactly as written. Both tasks landed in a single iteration with `npm run check` passing on first try.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. The Phase 57 backend endpoints are already live and emit invite emails via Resend (already configured in earlier phases).

## Self-Check: PASSED

- `client/src/components/admin/PendingInvitationsSection.tsx`: FOUND
- `client/src/components/admin/UnifiedUsersSection.tsx`: FOUND (modified)
- Commit `57d5c8f`: FOUND
- Commit `831c5df`: FOUND
- Acceptance grep checks: all pass (export function PendingInvitationsSection: 1; /api/admin/staff/invitations references: 4; POST method: 1; DELETE method: 1; invalidateQueries: 2; DialogContent: 6; PendingInvitationsSection in UnifiedUsersSection: 2; UsersSection in UnifiedUsersSection: 3; `Section />` count in UnifiedUsersSection: 2)
- `npm run check`: exit 0

## Next Phase Readiness

- SF-07 closed. The staff invitation loop (Phase 57 backend + Phase 58 plans 01 & 02 frontend) is now end-to-end usable from the admin UI: tenant admin clicks Invite → email is sent → invitee accepts on the public /accept-invite page (Plan 01) → admin can revoke pending invites at any time from /admin/users.
- No blockers for closing Phase 58 / v16.0.

---
*Phase: 58-staff-invitation-frontend*
*Completed: 2026-05-15*
