---
phase: 23-multiple-durations-per-service
plan: "03"
subsystem: admin-ui, booking-flow, cart
tags: [durations, booking-flow, admin-ui, cart-context]
dependency_graph:
  requires: [23-01, 23-02]
  provides: [admin-durations-manager, booking-duration-selector]
  affects: [ServiceForm, CartContext, BookingPage]
tech_stack:
  added: []
  patterns: [useQueries-for-service-details, optimistic-duration-ui, cart-service-override]
key_files:
  created: []
  modified:
    - client/src/components/admin/services/ServiceForm.tsx
    - client/src/context/CartContext.tsx
    - client/src/pages/BookingPage.tsx
decisions:
  - "Duration section only shown in edit mode (service.id exists) — creation mode has no serviceId to associate rows with"
  - "updateItem spreads data.service to allow durationMinutes override without breaking other CartItem fields"
  - "serviceDetailsLoading added to isSlotsPending to prevent calendar flash before durations are known"
  - "allDurationsSelected is true when itemsWithDurations is empty (no-duration path unchanged)"
metrics:
  duration_minutes: 45
  completed_date: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
requirements: [SEED-029-ui]
---

# Phase 23 Plan 03: Admin Durations Manager and Booking Duration Selector Summary

Admin can configure per-service duration options (label, hours, min, price) in the ServiceForm; customers see a "Choose Your Duration" selector before the calendar when at least one cart service has durations configured.

## What Was Built

### Task 1: Admin UI — Available Durations section in ServiceForm.tsx

Added a complete duration management UI inside the ServiceForm (edit mode only):

- `ServiceDurationInput` interface with `id`, `label`, `durationHours`, `durationMinutesRemainder`, `price`, `order`
- State: `serviceDurations[]` + `durationsLoading` boolean
- `useEffect` on `service.id` that fetches `GET /api/services/:id/durations` and maps to UI shape (total minutes split into h/m)
- `handleAddDuration` — appends a blank row locally (optimistic, no API call until Save)
- `handleSaveDuration(index)` — calls POST (new rows) or PATCH (rows with id) with Bearer token from `getAccessToken()`
- `handleDeleteDuration(index)` — calls DELETE if row has an id, then removes from local state
- Rendered as a `grid-cols-[1fr_auto_auto_auto_auto]` grid: Label | Hours | Min | Price | Save+Del actions
- Section gated on `service?.id` — invisible when creating a new service

### Task 2: CartContext extension + BookingPage duration selector

**CartContext.tsx:**
- `CartItem.selectedDurationId?: number` — tracks which duration the customer chose
- `AddToCartData.selectedDurationId?: number` — allows passing at add/update time
- `addItem` passes `selectedDurationId` through in both the update-existing and new-item branches
- `updateItem` spreads `data.service` first (enabling `durationMinutes` override), then applies all other fields including `selectedDurationId`

**BookingPage.tsx:**
- `updateItem` added to `useCart()` destructuring
- `selectedDurations: Record<number, any>` state — maps serviceId → chosen ServiceDuration object
- `serviceDetailsQueries` via `useQueries` — fetches full service details (including `durations[]`) for each cart item
- `itemsWithDurations` — filtered list of services that have `durations.length > 0`
- `allDurationsSelected` — true when `itemsWithDurations` is empty OR every item has a selection
- `serviceDetailsLoading` added to `isSlotsPending` to prevent premature calendar rendering
- Duration selector panel: renders at `step === 3 && itemsWithDurations.length > 0 && !allDurationsSelected`
  - Per-service duration cards with label, formatted hours+minutes, and price
  - "Continue to Schedule" button disabled until all durations selected
  - On click: calls `updateItem` for each service with `{ service: {...svc, durationMinutes: chosen.durationMinutes}, calculatedPrice: Number(chosen.price), selectedDurationId: chosen.id }`
- Calendar (step 3) gated behind `allDurationsSelected || itemsWithDurations.length === 0`
- No-duration path: `itemsWithDurations` is empty → `allDurationsSelected` is true → calendar shown immediately (unchanged behavior)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all duration data is sourced from live API calls (GET /api/services/:id/durations, GET /api/services/:id). No hardcoded placeholders.

## Checkpoint

**checkpoint:human-verify** — AUTO-APPROVED per orchestrator instruction.

## Self-Check: PASSED

Files verified:
- `/c/Users/Vanildo/Dev/skleanings/.claude/worktrees/agent-a95c8305e8edc75b5/client/src/components/admin/services/ServiceForm.tsx` — FOUND
- `/c/Users/Vanildo/Dev/skleanings/.claude/worktrees/agent-a95c8305e8edc75b5/client/src/context/CartContext.tsx` — FOUND
- `/c/Users/Vanildo/Dev/skleanings/.claude/worktrees/agent-a95c8305e8edc75b5/client/src/pages/BookingPage.tsx` — FOUND

Commits verified:
- `839f816` feat(23-03): add Available Durations section to ServiceForm — FOUND
- `fab677d` feat(23-03): add duration selector to booking flow and extend CartContext — FOUND

`npm run check` exit 0 — PASSED
`npm run build` completes without errors — PASSED
