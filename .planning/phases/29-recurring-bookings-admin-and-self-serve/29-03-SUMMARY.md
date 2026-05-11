---
phase: 29-recurring-bookings-admin-and-self-serve
plan: "03"
subsystem: frontend
tags: [recurring-bookings, admin-ui, self-serve, react-query, alertdialog]
dependency_graph:
  requires: [29-01, 29-02]
  provides: [RECUR-04, RECUR-05]
  affects: [BookingsSection, App.tsx, admin-dashboard]
tech_stack:
  added: []
  patterns:
    - React Query useQuery/useMutation for admin subscriptions panel
    - AlertDialog confirmation before destructive actions
    - useState activeTab for section-level tab switching
    - wouter useRoute for public token-based page
    - lazy() + PageWrapper pattern for route registration
key_files:
  created:
    - client/src/components/admin/RecurringSubscriptionsPanel.tsx
    - client/src/pages/ManageSubscription.tsx
  modified:
    - client/src/components/admin/BookingsSection.tsx
    - client/src/App.tsx
decisions:
  - "authenticatedRequest takes token string (not function) — adapted from plan interface example which showed getAccessToken function; called getAccessToken() before each request"
  - "ManageSubscription uses default export so lazy import works without .then(m => ({ default: m.X })) reshaping — wrapped in PageWrapper for consistency"
  - "Route uses :token path param (not ?token= query param) — matches API route /api/subscriptions/manage/:token"
metrics:
  duration: 5 minutes
  completed: 2026-05-11
  tasks_completed: 2
  files_modified: 4
---

# Phase 29 Plan 03: Admin Recurring Subscriptions Panel and Self-Serve Management Page

Admin Bookings tab gains a Recurring Subscriptions sub-tab with pause/resume/cancel actions, plus a public `/manage-subscription/:token` page for customer self-serve management.

## Tasks Completed

### Task 1: RecurringSubscriptionsPanel + BookingsSection tab bar

**Files:** `client/src/components/admin/RecurringSubscriptionsPanel.tsx` (new), `client/src/components/admin/BookingsSection.tsx` (modified)

**Commit:** `3c5253c`

- Created `RecurringSubscriptionsPanel` with React Query fetch from `GET /api/admin/recurring-bookings`
- Desktop: full table (customer, service, frequency, status, next date, actions)
- Mobile: card list layout with same data
- Empty state with RefreshCw icon; loading and error states
- `SubscriptionActions` subcomponent: shows Pause (when active) or Resume (when paused), plus Cancel; each behind AlertDialog confirmation
- `BookingsSection` gains `activeTab` state (`'bookings' | 'subscriptions'`) and tab bar above content
- Existing bookings content wrapped in conditional — unchanged when activeTab is 'bookings'

### Task 2: ManageSubscription page and App.tsx route

**Files:** `client/src/pages/ManageSubscription.tsx` (new), `client/src/App.tsx` (modified)

**Commit:** `a14db05`

- `ManageSubscription` is a public page (no auth) reading token from URL via `useRoute('/manage-subscription/:token')`
- Fetches subscription info from `GET /api/subscriptions/manage/:token`
- Shows service name, frequency, status (with color-coded badge and icon), next booking date when active
- Pause (AlertDialog) → POST action=pause; Resume (brand yellow CTA) → POST action=unpause; Cancel (AlertDialog) → POST action=cancel
- `actionResult` state updates displayed status optimistically after mutation success
- `ErrorScreen` component handles 404 and network errors gracefully
- Cancelled subscriptions show terminal message instead of action buttons
- Route `/manage-subscription/:token` registered in App.tsx public Switch, lazy-loaded with PageWrapper

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] authenticatedRequest signature adaptation**
- **Found during:** Task 1
- **Issue:** Plan's interface example showed `getAccessToken: () => Promise<string>` being passed directly to `authenticatedRequest`, but the actual `authenticatedRequest` signature takes a resolved token string as the third argument
- **Fix:** Called `await getAccessToken()` before each `authenticatedRequest` call in both query and mutation functions; added null guard
- **Files modified:** `client/src/components/admin/RecurringSubscriptionsPanel.tsx`
- **Commit:** `3c5253c`

## Known Stubs

None — all data is wired to real API endpoints established in plans 29-01 and 29-02.

## Self-Check: PASSED

- `client/src/components/admin/RecurringSubscriptionsPanel.tsx` — EXISTS
- `client/src/pages/ManageSubscription.tsx` — EXISTS
- `client/src/components/admin/BookingsSection.tsx` contains `activeTab`, `RecurringSubscriptionsPanel`, `Recurring Subscriptions` tab button
- `client/src/App.tsx` contains `manage-subscription/:token` route and `ManageSubscription` lazy import
- `npm run check` — PASSED (exit 0)
- `npm run build` — PASSED (3 pre-existing warnings, no errors)
- Commits `3c5253c` and `a14db05` exist in git log
