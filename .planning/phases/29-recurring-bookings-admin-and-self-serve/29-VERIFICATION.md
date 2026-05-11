---
phase: 29-recurring-bookings-admin-and-self-serve
verified: 2026-05-11T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Admin Recurring Subscriptions tab renders the panel in-browser"
    expected: "Clicking 'Recurring Subscriptions' tab in Admin Bookings section shows the subscriptions table (or empty state message)"
    why_human: "React Query fetch + conditional render; can't drive browser in this environment"
  - test: "Pause/Cancel AlertDialog confirmation appears before mutation"
    expected: "Clicking Pause or Cancel buttons shows a confirmation dialog; only confirmed actions fire the PATCH request"
    why_human: "UI interaction flow requiring browser"
  - test: "Public /manage-subscription/:token page loads with valid token"
    expected: "Navigating to /manage-subscription/<valid-uuid> shows service name, frequency, status, and action buttons"
    why_human: "Requires live database row with a manage_token to test end-to-end"
  - test: "Self-serve page handles invalid token gracefully"
    expected: "Navigating to /manage-subscription/bad-token shows the 'Link Not Found' error screen, not a blank page or unhandled error"
    why_human: "Requires browser navigation"
---

# Phase 29: Recurring Bookings Admin and Self-Serve Verification Report

**Phase Goal:** Admins can oversee all recurring subscriptions from the dashboard and customers can pause or cancel their own subscription via a self-serve link.
**Verified:** 2026-05-11
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | recurring_bookings rows have a unique manage_token UUID column | VERIFIED | Migration file exists with correct ALTER TABLE + UNIQUE INDEX; schema.ts line 221 adds `manageToken: uuid("manage_token").notNull().default(sql\`gen_random_uuid()\`)` |
| 2 | getRecurringBookingByToken resolves a subscription by its UUID token | VERIFIED | storage.ts lines 2069–2075: Drizzle `.select().from(recurringBookings).where(eq(recurringBookings.manageToken, token))` |
| 3 | getRecurringBookingsWithDetails returns contact name and service name alongside each subscription | VERIFIED | storage.ts lines 2077–2113: LEFT JOIN contacts + services, returns contactName/serviceName/customerEmail |
| 4 | GET /api/admin/recurring-bookings returns subscription list with contact name and service name | VERIFIED | recurring-bookings.ts line 80: `adminRecurringRouter.get("/", requireAdmin, ...)` calls `storage.getRecurringBookingsWithDetails()` and returns result |
| 5 | PATCH /api/admin/recurring-bookings/:id applies pause/unpause/cancel state transitions | VERIFIED | recurring-bookings.ts line 95: `adminRecurringRouter.patch("/:id", requireAdmin, ...)` enforces state machine; 409 on cancelled terminal state |
| 6 | GET /api/subscriptions/manage/:token returns subscription status for valid token | VERIFIED | recurring-bookings.ts line 136: `publicRecurringRouter.get("/:token", ...)` calls `getRecurringBookingByToken` and returns `{status, frequencyName, nextBookingDate, serviceName}` |
| 7 | POST /api/subscriptions/manage/:token/action applies pause/unpause/cancel for valid token | VERIFIED | recurring-bookings.ts line 159: `publicRecurringRouter.post("/:token/action", ...)` enforces same state machine |
| 8 | Subscription creation in POST /api/bookings triggers a manage-link email to the customer | VERIFIED | bookings.ts line 168–185: dynamic import of `buildManageEmail` + `sendEmail`; uses `sub.manageToken` to build URL; non-fatal try/catch |
| 9 | Admin Bookings section has a tab bar with 'All Bookings' and 'Recurring Subscriptions' | VERIFIED | BookingsSection.tsx line 419: `useState<'bookings' \| 'subscriptions'>('bookings')`; lines 491–507: two Button variants + conditional `<RecurringSubscriptionsPanel>` |
| 10 | Public /manage-subscription route exists and reads :token from the URL | VERIFIED | App.tsx line 206: `<Route path="/manage-subscription/:token" component={ManageSubscription} />`; ManageSubscription.tsx line 61: `useRoute('/manage-subscription/:token')` |
| 11 | Self-serve page handles 404 (invalid token) gracefully | VERIFIED | ManageSubscription.tsx: `isError` branch renders `<ErrorScreen>` component with user-friendly message |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260511000005_add_manage_token_to_recurring_bookings.sql` | ALTER TABLE + UNIQUE INDEX + backfill | VERIFIED | All three SQL statements present; exact content matches plan |
| `shared/schema.ts` | manageToken column + omit + RecurringBookingWithDetails | VERIFIED | Line 221 (column), line 232 (omit), lines 238–242 (interface) |
| `server/storage.ts` | IStorage + DatabaseStorage for both new methods | VERIFIED | IStorage: lines 391, 394. DatabaseStorage: lines 2069, 2077 — both with real Drizzle queries |
| `server/lib/email-templates.ts` | buildManageEmail + ManageEmailData with brand HTML | VERIFIED | Lines 99 (interface), 111 (function); HTML includes #FFFF01 CTA and #1C53A3 heading |
| `server/routes/recurring-bookings.ts` | adminRecurringRouter + publicRecurringRouter with 4 handlers | VERIFIED | 2 admin (GET/PATCH at /, /:id) + 2 public (GET/POST at /:token, /:token/action) |
| `server/routes.ts` | Both routers mounted at correct paths | VERIFIED | Line 83: `/api/admin/recurring-bookings`; line 84: `/api/subscriptions/manage` |
| `server/routes/bookings.ts` | sendEmail(buildManageEmail(...)) after createRecurringBooking | VERIFIED | Lines 168–185: dynamic imports + `sub.manageToken` usage + `sendEmail` call |
| `client/src/components/admin/RecurringSubscriptionsPanel.tsx` | React Query fetch, table, AlertDialog actions | VERIFIED | Fetches from `/api/admin/recurring-bookings`; table with Pause/Resume/Cancel + AlertDialog confirmation |
| `client/src/components/admin/BookingsSection.tsx` | Tab bar wired to RecurringSubscriptionsPanel | VERIFIED | Import line 73; `activeTab` state line 419; tab buttons + conditional render lines 491–507 |
| `client/src/pages/ManageSubscription.tsx` | Public self-serve page with token, fetch, actions | VERIFIED | useRoute for token; GET + POST to `/api/subscriptions/manage`; pause/unpause/cancel + 404 error handling |
| `client/src/App.tsx` | /manage-subscription/:token route registered | VERIFIED | Lazy import line 90; Route line 206 in public router branch |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/routes/recurring-bookings.ts` | `server/storage.ts` | `storage.getRecurringBookingsWithDetails()` | WIRED | Line 82 calls method; result returned as JSON |
| `server/routes/recurring-bookings.ts` | `server/storage.ts` | `storage.getRecurringBookingByToken()` | WIRED | Lines 138, 166 call method |
| `server/routes/bookings.ts` | `server/lib/email-templates.ts` | `buildManageEmail` dynamic import | WIRED | Line 168: `await import("../lib/email-templates")`; line 174 builds manageUrl with `sub.manageToken` |
| `client/src/components/admin/RecurringSubscriptionsPanel.tsx` | `/api/admin/recurring-bookings` | `authenticatedRequest('GET', ...)` | WIRED | Line 58: fetch + `res.json()` assigned to `subscriptions` query data |
| `client/src/pages/ManageSubscription.tsx` | `/api/subscriptions/manage/:token` | `apiRequest('GET', ...)` + `apiRequest('POST', ...)` | WIRED | Lines 73 (GET status), 86 (POST action); both use token from URL |
| `client/src/App.tsx` | `client/src/pages/ManageSubscription.tsx` | `lazy()` import + Route | WIRED | Line 90 lazy import; line 206 Route with `/manage-subscription/:token` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `RecurringSubscriptionsPanel.tsx` | `subscriptions` | GET `/api/admin/recurring-bookings` → `storage.getRecurringBookingsWithDetails()` | Drizzle SELECT with LEFT JOIN contacts + services | FLOWING |
| `ManageSubscription.tsx` | `sub` (SubscriptionInfo) | GET `/api/subscriptions/manage/:token` → `storage.getRecurringBookingByToken()` | Drizzle SELECT with WHERE on manageToken | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — API routes require a running server and live database. Key wiring verified programmatically via grep.

Note on `getRecurringBookingsWithDetails` implementation: The plan specified `innerJoin` for services but the implementation uses `leftJoin`. This is a benign deviation — it makes the query more resilient (subscriptions pointing to soft-deleted services still appear rather than vanishing), and the `serviceName` null case is handled by `?? "Unknown Service"` on line 2110.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RECUR-04 | 29-01, 29-02, 29-03 | Admin can view and manage all recurring subscriptions | SATISFIED | `adminRecurringRouter` (GET list, PATCH status) + `RecurringSubscriptionsPanel` + `BookingsSection` tab bar |
| RECUR-05 | 29-01, 29-02, 29-03 | Customer can pause/cancel own subscription via self-serve link | SATISFIED | `manage_token` migration + `publicRecurringRouter` (GET/POST) + `ManageSubscription` page + manage-link email on booking creation |

### Anti-Patterns Found

No blockers detected.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `server/routes/bookings.ts` | Double `buildManageEmail()` call (builds email twice — first draft ignored) | Info | Wasteful but non-breaking; second call with `svc?.name` is the one actually sent |

The double-call pattern in bookings.ts (an unused `emailContent` variable followed by `emailContentWithService` with the actual service name) is cosmetically redundant but functionally correct — the correct email is sent.

### Human Verification Required

#### 1. Admin Recurring Subscriptions Tab Renders Correctly

**Test:** Log into admin dashboard, navigate to Bookings section, click "Recurring Subscriptions" tab
**Expected:** Panel renders (either subscription table rows, or empty-state "No subscriptions yet" message with RefreshCw icon)
**Why human:** React Query data fetching and conditional render cannot be driven without a browser

#### 2. Pause/Cancel AlertDialog Flow

**Test:** In the admin Recurring Subscriptions tab, click "Pause" on an active subscription
**Expected:** AlertDialog confirmation modal appears; clicking "Pause" fires PATCH request and updates row status to "paused"; clicking "Keep active" dismisses without change
**Why human:** UI interaction sequence requiring browser

#### 3. Public Self-Serve Page — Valid Token

**Test:** Copy a `manage_token` UUID from the `recurring_bookings` table, navigate to `/manage-subscription/<token>`
**Expected:** Page loads showing service name, frequency, current status badge, and action buttons (Pause/Cancel for active; Resume/Cancel for paused; terminal message for cancelled)
**Why human:** Requires live database row and browser navigation

#### 4. Public Self-Serve Page — Invalid Token

**Test:** Navigate to `/manage-subscription/not-a-real-token`
**Expected:** "Link Not Found" error screen with XCircle icon and helpful message — no blank page, no unhandled error
**Why human:** Requires browser navigation

### Gaps Summary

No gaps. All 11 observable truths are verified at all four levels (existence, substantive implementation, wiring, data flow). TypeScript check (`npm run check`) passes cleanly.

The only items outstanding are the four browser-side verifications above, which are behavioral UI concerns that cannot be checked programmatically.

---

_Verified: 2026-05-11_
_Verifier: Claude (gsd-verifier)_
