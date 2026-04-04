---
phase: 04-availability-engine
plan: 02
subsystem: api + lib
tags: [availability, cross-service, intersection, backward-compat]

provides:
  - getSlotsForServices: cross-service intersection with staff qualification check
  - getStaffUnionSlots: any-staff-free union for no-service-specified requests
  - /api/availability?serviceIds= param (cross-service intersection)
  - /api/availability/month?serviceIds= param
  - staffCount===0 guard: legacy path for single-operator deployments

key-decisions:
  - "Staff with no service abilities = unrestricted (can do all services)"
  - "staffCount===0 → GHL+business-hours path unchanged"
  - "staffCount>0, no params → union slots (any staff free)"
  - "staffCount>0, serviceIds → intersection (all services coverable)"
  - "staffCount>0, staffId → that staff's schedule only (qualification skipped)"

duration: ~10min
started: 2026-04-02T00:00:00Z
completed: 2026-04-02T00:00:00Z
---

# Phase 4 Plan 02: Cross-Service Intersection Logic

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: serviceIds intersection | Pass | All services must have coverage per slot |
| AC-2: staffId + serviceIds | Pass | Specific staff's schedule, qualification skipped |
| AC-3: No staff → legacy logic | Pass | staffCount===0 guard in both endpoints |
| AC-4: Staff exist, no params → union | Pass | getStaffUnionSlots |
| AC-5: TypeScript | Pass | Zero errors |

---
*Phase: 04-availability-engine, Plan: 02 — Completed: 2026-04-02*
