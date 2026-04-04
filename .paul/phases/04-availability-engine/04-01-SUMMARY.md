---
phase: 04-availability-engine
plan: 01
subsystem: api + lib
tags: [availability, staff, per-staff, express, drizzle]

provides:
  - getBookingsByDateAndStaff storage method
  - getStaffMembersByServiceId storage method
  - server/lib/staff-availability.ts with getStaffAvailableSlots
  - /api/availability?staffId= param (per-staff slots)
  - /api/availability/month?staffId= param (per-staff calendar)

affects:
  - 04-02 (cross-service intersection builds on getStaffAvailableSlots)
  - 05-xx (booking flow passes staffId to availability endpoint)

key-files:
  created:
    - server/lib/staff-availability.ts
  modified:
    - server/storage.ts
    - server/routes/availability.ts

key-decisions:
  - "No staffId → original global logic unchanged (backward compat)"
  - "staffId present → per-staff schedule, skips GHL and business hours"
  - "getStaffAvailableSlots returns [] if no availability record for that day"

duration: ~10min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 4 Plan 01: Per-Staff Slot Computation

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: getBookingsByDateAndStaff | Pass | Filters by date AND staffMemberId |
| AC-2: getStaffAvailableSlots | Pass | Uses staffAvailability + staff bookings, today-aware |
| AC-3: /api/availability?staffId= | Pass | Routes to per-staff logic when staffId present |
| AC-4: Backward compat | Pass | No staffId → original logic unchanged |
| AC-5: TypeScript | Pass | Zero errors |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/lib/staff-availability.ts` | Created | getStaffAvailableSlots function |
| `server/storage.ts` | +2 methods | getBookingsByDateAndStaff, getStaffMembersByServiceId |
| `server/routes/availability.ts` | Updated | staffId param, per-staff branch for both endpoints |

---
*Phase: 04-availability-engine, Plan: 01 — Completed: 2026-04-02*
