---
phase: 06-unified-users-roles
plan: 04
subsystem: api
tags: [express, storage, staff-bridge, user-management]

requires:
  - phase: 06-01
    provides: userId FK on staffMembers + role column on users
  - phase: 06-03
    provides: user-routes with role-based POST/PATCH/DELETE

provides:
  - POST /api/users with role=staff auto-creates staffMembers record
  - PATCH /api/users/:id role→staff creates staffMembers if not exists
  - DELETE /api/users/:id cleans up linked staffMembers before delete
  - storage.getStaffMemberByUserId + storage.linkStaffMemberToUser

affects: 06-05-staff-settings-page

tech-stack:
  added: []
  patterns: [create-then-link pattern for FK-excluded fields, dedicated linkXToY storage methods]

key-files:
  modified:
    - server/storage.ts
    - server/routes/user-routes.ts

key-decisions:
  - "linkStaffMemberToUser added to storage instead of updateStaffMember — userId excluded from InsertStaffMember type"
  - "create-then-link pattern: createStaffMember() → linkStaffMemberToUser() — two-step because schema omits FK for safety"

patterns-established:
  - "When a schema type omits an FK field, add a dedicated linkXToY(id, foreignId) storage method"

duration: ~15min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 2 Plan 04: Staff Creation Bridge Summary

**POST/PATCH/DELETE /api/users now automatically manages linked staffMembers records when role=staff — creates on user creation/role-change, deletes before user deletion.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 2 completed |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Staff user creation creates staffMembers record | Pass | POST creates user → creates staffMember → links via userId |
| AC-2: Role change to staff creates staffMembers record | Pass | PATCH checks existing by userId before creating |
| AC-3: Staff user deletion cleans up staffMembers first | Pass | DELETE looks up linked staffMember and deletes before user |

## Accomplishments

- `getStaffMemberByUserId` added to IStorage + DatabaseStorage — enables lookup of staff by users.id
- `linkStaffMemberToUser` added — dedicated method to set userId FK (bypasses InsertStaffMember type omission)
- POST bridge: createStaffMember → linkStaffMemberToUser on role=staff
- PATCH bridge: idempotent — checks existing before creating
- DELETE cleanup: prevents FK constraint violation

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/storage.ts` | Modified | Added getStaffMemberByUserId + linkStaffMemberToUser |
| `server/routes/user-routes.ts` | Modified | Staff bridge in POST/PATCH/DELETE handlers |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| linkStaffMemberToUser instead of updateStaffMember | userId omitted from InsertStaffMember by design — can't pass it through updateStaffMember's Partial type | Dedicated method does raw DB update for the FK field only |
| create-then-link two-step | Maintains schema type safety — InsertStaffMember stays clean | Any code creating staff without userId still works |

## Deviations from Plan

### Auto-fixed Issues

**1. Type system: userId excluded from InsertStaffMember**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `updateStaffMember(id, { userId })` rejected — userId omitted from the schema type
- **Fix:** Added `linkStaffMemberToUser(staffId, userId)` storage method with direct DB update
- **Verification:** npm run check clean after fix

## Issues Encountered

None beyond the auto-fixed type issue above.

## Next Phase Readiness

**Ready:**
- Creating a staff-role user now produces both a users record and a staffMembers record
- Staff appears in booking flow, availability engine, and calendar management automatically
- Foundation set for Phase 3: StaffSettings page (staff logs in → /staff/settings)

**Concerns:**
- Role change AWAY from staff (demotion) does not delete/unlink staffMembers record — intentionally deferred as edge case

**Blockers:**
- None

---
*Phase: 06-unified-users-roles, Plan: 04*
*Completed: 2026-04-04*
