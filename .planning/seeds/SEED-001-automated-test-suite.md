---
id: SEED-001
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Not worth the effort without a second dev on the team
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: start of any milestone that touches booking flow, availability logic, or GHL sync
scope: Large
---

# SEED-001: Add automated test suite (vitest + React Testing Library)

## Why This Matters

The repository has zero `.test.ts` or `.spec.ts` files. The entire booking flow, availability logic, area-based pricing calculation, GHL sync, and attribution are only tested manually. Any future phase that changes `POST /api/bookings`, `getAvailableSlots`, or `recordConversionEvent` has no safety net — regressions only show up in production.

**Why:** Regression risk grows quadratically with the number of phases. Phase 14 introduced create-from-calendar that duplicated booking creation paths. Phase 15+ multiplies that with white-label. Without tests, long-term maintenance becomes unsustainable.

## When to Surface

**Trigger:** when starting any milestone after v2.0 White Label, or when production bug reports increase, or when the team grows and a second person starts touching the codebase.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Milestone includes refactoring of large components (BookingPage, AppointmentsCalendarSection)
- Milestone includes a new external integration (new payment gateway, new CRM)
- First developer beyond the founder starts contributing

## Scope Estimate

**Large** — A full phase, maybe two. Vitest + RTL setup (1 plan), backend booking flow tests (1 plan), availability logic tests (1 plan), attribution/analytics tests (1 plan).

## Breadcrumbs

Critical files without coverage:
- `server/routes.ts` — `POST /api/bookings` (~10KB of creation logic)
- `server/storage.ts` — `getAvailableSlots`, `recordConversionEvent`
- `client/src/pages/BookingPage.tsx` — 39KB, 5 booking flow steps
- `server/integrations/ghl.ts` — retry logic, timezone formatting
- `shared/schema.ts` — Zod validators used across the system

Suggested test pattern: Vitest for backend (Node-compatible), React Testing Library for components, MSW for mocking external APIs (Stripe, GHL).

## Notes

No test runner config exists (`vitest.config.ts`, `jest.config.ts`). Start with booking flow happy paths (site payment + Stripe payment) before edge cases. Pessimistic locking (timeSlotLocks) is especially critical to test with simulated concurrency.
