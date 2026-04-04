---
phase: 06-unified-users-roles
plan: 05
subsystem: ui
tags: [react, staff, settings, google-calendar, auth]

requires:
  - phase: 06-04
    provides: staff-creation bridge, getStaffMemberByUserId storage method

provides:
  - GET /api/staff/me — returns staffMember for authenticated staff user
  - PATCH /api/staff/me — updates own profile fields
  - CalendarTab extracted as shared component
  - /staff/settings full personal settings page

affects: []

tech-stack:
  added: []
  patterns:
    - "Staff self-service endpoints use requireAuth (not requireAdmin)"
    - "CalendarTab shared between admin dialog and staff page via named export"

key-files:
  created:
    - client/src/components/admin/CalendarTab.tsx
  modified:
    - server/routes/staff.ts
    - client/src/components/admin/StaffManageDialog.tsx
    - client/src/pages/StaffSettings.tsx

key-decisions:
  - "Calendar endpoints (status/connect/disconnect/clear-reconnect) use requireAuth so staff can manage their own calendar"
  - "GET /calendar/all-statuses kept as requireAdmin (admin banner only)"
  - "CalendarTab extracted to standalone file to avoid duplication between StaffManageDialog and StaffSettings"

patterns-established:
  - "Staff-scoped endpoints use getStaffMemberByUserId(user.id) to resolve staffId from auth token"

duration: ~45min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 6 Plan 05: Staff Personal Settings Page — Summary

**Staff users now land on a personal settings page at /staff/settings where they can edit their profile (name, phone, bio, avatar) and manage their Google Calendar connection, isolated from the admin dashboard.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~45 min |
| Tasks | 2 completed |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Staff can view and edit own profile | Pass | GET/PATCH /api/staff/me implemented; form pre-fills and saves |
| AC-2: Staff can manage Google Calendar connection | Pass | CalendarTab rendered in settings page |
| AC-3: Minimal header with logout (no admin UI) | Pass | Inline header with company name + logout; no sidebar |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `client/src/components/admin/CalendarTab.tsx` | Created | Extracted CalendarTab component, shared by StaffManageDialog + StaffSettings |
| `client/src/components/admin/StaffManageDialog.tsx` | Modified | Removed inline CalendarTab; imports from new file |
| `server/routes/staff.ts` | Modified | Added GET/PATCH /me; changed calendar endpoints to requireAuth |
| `client/src/pages/StaffSettings.tsx` | Modified | Full implementation replacing placeholder |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| requireAuth on calendar endpoints (not requireAdmin) | Staff need to manage their own calendar without admin privilege | Staff can connect/disconnect from /staff/settings |
| CalendarTab as named export in standalone file | Both StaffManageDialog and StaffSettings need the same UI | Single source of truth; no duplication |
| PATCH /me updates staffMembers only (not users table) | Clean separation; staff profile ≠ auth identity | Users table fields (email, role) remain admin-only |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `stripe` ERR_MODULE_NOT_FOUND on server start | Unrelated — `npm install stripe` resolved it |
| Port 5000 EADDRINUSE | Unrelated — killed stale process (PID 53028) |

## Next Phase Readiness

**Ready:**
- v0.6 milestone is complete (all 3 phases, 5 plans)
- Staff login → /staff/settings flow fully functional
- CalendarTab shared correctly

**Concerns:**
- `npm run db:push` required before deploying (role + phone + userId FK columns)

**Blockers:**
- None

---
*Phase: 06-unified-users-roles, Plan: 05*
*Completed: 2026-04-04*
