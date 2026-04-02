---
phase: 04-availability-engine
plan: 03
subsystem: lib
tags: [availability, checkAvailability, staff-aware, backward-compat]

provides:
  - checkAvailability(date, start, end, excludeId?, staffMemberId?) — staff-scoped conflict check
  - Ready for Phase 5: booking creation with staffMemberId uses scoped conflict detection

key-decisions:
  - "staffMemberId optional → no breaking change to existing callers"
  - "When staffMemberId present: conflict checked against that staff's bookings only"

duration: ~3min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 4 Plan 03: Graceful Fallback + Staff-Aware Conflict Check

## Changes

| File | Change |
|------|--------|
| `server/lib/availability.ts` | `checkAvailability` accepts optional `staffMemberId` param |

## Phase 4 Complete

All three plans done. The availability engine now:
1. Returns per-staff slots when `staffId` provided
2. Performs cross-service intersection when `serviceIds` provided
3. Falls back to legacy global logic when no staff exist
4. Scopes booking conflict checks to a specific staff member

---
*Phase: 04-availability-engine, Plan: 03 — Completed: 2026-04-02*
