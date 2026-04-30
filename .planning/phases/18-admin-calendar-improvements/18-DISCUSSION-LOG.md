# Phase 18: Admin Calendar Improvements — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 18-admin-calendar-improvements
**Areas discussed:** Multiple services UX, End time editing UX, Modal layout & field order

---

## Multiple Services UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic rows with + Add service button | Each row has service selector + quantity + trash icon. Min 1 row. | ✓ |
| Multi-select checkboxes | Checklist of all services with qty per checked item | |

**No limit on service rows**

| Option | Description | Selected |
|--------|-------------|----------|
| No limit | Admin adds as many rows as needed | ✓ |
| Cap at 3 services | Prevents long forms | |
| Cap at 5 services | Moderate cap | |

**Live total**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — sum all rows live | Total updates as admin changes service or quantity | ✓ |
| No — show total only on submit | Simpler, but no preview before confirming | |

---

## End Time Editing UX

| Option | Description | Selected |
|--------|-------------|----------|
| Always a direct time input | Remove toggle; field always a time input pre-filled from computed value | ✓ |
| Keep toggle, improve label | Rename to "Override end time"; keep read-only until toggled | |

**Auto-update behavior with multiple services**

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-update unless admin manually changed it | Only updates if value = previously computed value | ✓ |
| Always auto-update when service changes | Resets even intentional custom values | |
| Never auto-update | Admin always controls end time manually | |

**Duration computation for multiple services**

| Option | Description | Selected |
|--------|-------------|----------|
| Sum of all service durations | end = start + Σ(duration × qty) | ✓ |
| Longest single service | end = start + max(duration) | |
| First service only | Ignores add-ons | |

---

## Modal Layout & Field Order

| Option | Description | Selected |
|--------|-------------|----------|
| 2-column grid for short fields | Name+Phone, Email+Address in rows; services/notes full-width | ✓ |
| Single column, same order | Wider modal, no layout change | |

**Field order**

| Option | Description | Selected |
|--------|-------------|----------|
| Customer info before services | Current order — identify customer first, then services | ✓ |
| Services before customer info | Job-first workflow for walk-ins | |

---

## Claude's Discretion

- Exact CSS values for rbc-label alignment (measure in browser)
- Whether to use `useFieldArray` from RHF (recommended) or manual state
- Trash button styling for remove rows

## Deferred Ideas

- Multi-staff parallel column view → Phase 19
- Drag-to-reschedule on calendar grid → future phase
