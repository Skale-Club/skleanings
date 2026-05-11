# Phase 29: Recurring Bookings — Admin & Self-Serve Management — Research

**Researched:** 2026-05-11
**Domain:** React/Express admin UI, stateless self-serve token flow, Drizzle schema migration, transactional email
**Confidence:** HIGH — all findings drawn from direct codebase inspection

---

## Summary

Phase 29 closes the final two RECUR requirements. It has two parallel delivery tracks:

1. **Admin panel (RECUR-04):** A new "Recurring Subscriptions" sub-section inside the existing `bookings` admin section, showing all subscriptions with pause/cancel actions. No new sidebar item is needed; it fits naturally as a tab or inline card-list beneath the existing BookingsSection component.

2. **Self-serve link (RECUR-05):** An unauthenticated page at `/manage-subscription/:token` that lets customers pause or cancel without logging in. The token is a UUID stored as a `manageToken` column on `recurringBookings`. The token is permanent (not time-limited), matching the pattern of Confirmation page (which uses no token at all) and keeping the email template simple. A permanent UUID is acceptable because it only allows pause/cancel on that specific subscription — it cannot read other data or create anything.

Phase 27/28 did all the hard work. The schema (`recurringBookings`), storage methods (`getRecurringBookings`, `updateRecurringBooking`), and existing services (`recurring-booking-generator`, `recurring-booking-reminder`) are all in place. Phase 29 adds surface area: UI, new routes, one schema column, and one email template.

**Primary recommendation:** Add `manageToken uuid DEFAULT gen_random_uuid() NOT NULL` to `recurringBookings`, add admin API routes (`GET /api/admin/recurring-bookings`, `PATCH /api/admin/recurring-bookings/:id/status`) and self-serve public routes (`GET /api/subscriptions/manage/:token`, `POST /api/subscriptions/manage/:token/action`), build the admin panel as a tab inside BookingsSection, and build the self-serve page as a new lazy-loaded route in App.tsx.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECUR-04 | Admin can view all recurring subscriptions, see next booking date, pause, and cancel | `getRecurringBookings(statusFilter?)` exists in IStorage and DatabaseStorage. Needs admin API route + RecurringSubscriptionsTab component inside BookingsSection. |
| RECUR-05 | Customer can pause (temporary) and cancel (permanent) their recurring subscription from a self-serve page | Requires `manageToken` UUID column (migration + schema), a public Express route, a new page in App.tsx, and a `buildManageEmail` template in email-templates.ts. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **DB migrations:** Always use Supabase CLI (`supabase migration new`), NEVER `drizzle-kit push` (TTY prompt issues — enforced by memory note).
- **Frontend stack:** React 18 + Wouter + React Query + shadcn/ui + Tailwind. No Redux. New pages must be lazy-loaded via `lazy(() => import(...))` pattern in App.tsx.
- **Backend stack:** Express + Drizzle ORM + PostgreSQL. All DB calls go through `IStorage` interface in `server/storage.ts`.
- **Auth:** Admin routes secured with Replit Auth session. Self-serve route must be unauthenticated (no session check).
- **Brand:** CTA buttons use Brand Yellow `#FFFF01` with black bold text, `rounded-full`. Primary blue `#1C53A3` for headings.
- **Fonts:** Outfit (headings), Inter (body) — already used in email-templates.ts.

---

## Existing Infrastructure Audit

### Schema: `recurringBookings` table (shared/schema.ts lines 200–232)

Columns already present:
- `id` (serial PK)
- `contactId` (FK → contacts, set null on delete)
- `serviceId` (FK → services)
- `serviceFrequencyId` (FK → serviceFrequencies)
- `discountPercent`, `intervalDays`, `frequencyName` (snapshots)
- `startDate`, `endDate`, `nextBookingDate` (date strings YYYY-MM-DD)
- `preferredStartTime`, `preferredStaffMemberId`
- `status` text — `'active' | 'paused' | 'cancelled'`
- `cancelledAt`, `pausedAt` (timestamps, nullable)
- `originBookingId` (plain integer, no Drizzle FK to avoid circular reference)
- `createdAt`, `updatedAt`

**Missing for Phase 29:** `manageToken uuid` column (self-serve access token).

### IStorage interface methods already defined (storage.ts lines 373–378)

```typescript
createRecurringBooking(data: InsertRecurringBooking): Promise<RecurringBooking>;
getRecurringBooking(id: number): Promise<RecurringBooking | undefined>;
getRecurringBookings(statusFilter?: string): Promise<RecurringBooking[]>;
getActiveRecurringBookingsDueForGeneration(asOfDate: string): Promise<RecurringBooking[]>;
updateRecurringBooking(
  id: number,
  data: Partial<Pick<RecurringBooking, 'status' | 'nextBookingDate' | 'cancelledAt' | 'pausedAt' | 'updatedAt'>>
): Promise<RecurringBooking>;
```

**Note:** `getRecurringBookings` returns bare `RecurringBooking[]` rows. The admin panel also needs `contact.name` and `service.name`. A new storage method `getRecurringBookingsWithDetails()` will be needed that JOINs contacts and services, or the admin route can make secondary calls.

**Also missing from IStorage:** `getRecurringBookingByToken(token: string): Promise<RecurringBooking | undefined>` — needed for the self-serve public route to look up a subscription by its UUID token without exposing the integer ID in the URL.

### Existing routes file: server/routes/recurring-bookings.ts

Contains only two cron endpoints:
- `POST /api/recurring-bookings/cron/generate` — CRON_SECRET auth
- `POST /api/recurring-bookings/cron/send-reminders` — CRON_SECRET auth

No admin or public customer routes exist yet. Both need to be added to this file or a new route file.

### Email infrastructure (server/lib/email.ts + email-templates.ts)

- `sendEmail(to, subject, text, html)` — nodemailer, gracefully no-ops when SMTP env vars absent.
- `buildReminderEmail(data)` — returns `{ subject, text, html }`. Inline CSS, matches brand (Outfit/Inter, `#1C53A3`).
- **No self-serve manage template exists yet.** A `buildManageEmail(data)` function must be added to `email-templates.ts`.

### Admin UI structure

- `Admin.tsx` maps sidebar `id: 'bookings'` → `<BookingsSection getAccessToken={getAccessToken} />`.
- `BookingsSection` is a single component at `client/src/components/admin/BookingsSection.tsx`. It renders a filter bar (upcoming/past/all) and a list of booking cards.
- There is **no existing tab infrastructure** inside BookingsSection — it uses a simple `useState<'upcoming' | 'past' | 'all'>` toggle. Adding a "Recurring Subscriptions" tab is straightforward: add a second toggle group or a shadcn `Tabs` wrapper.
- `AdminSection` type in `shared/types.ts` does NOT need a new value — recurring lives inside the existing `'bookings'` section.

### App.tsx routing

Self-serve page requires a new public route. The pattern is clear:
```tsx
const ManageSubscription = lazy(() => import("@/pages/ManageSubscription").then(...));
// Inside the public Router branch:
<Route path="/manage-subscription/:token" component={ManageSubscription} />
```
This route must live in the public (non-admin, non-staff, non-account) branch of the `if` chain in `Router()`.

---

## Architecture Patterns

### Recommended file changes

| File | Change |
|------|--------|
| `shared/schema.ts` | Add `manageToken uuid DEFAULT gen_random_uuid() NOT NULL` to `recurringBookings` table; update `insertRecurringBookingSchema` omit list |
| `supabase/migrations/YYYYMMDD_add_manage_token.sql` | Add column with `gen_random_uuid()` default; backfill existing rows |
| `server/storage.ts` | Add `getRecurringBookingByToken`, `getRecurringBookingsWithDetails` to IStorage + DatabaseStorage |
| `server/routes/recurring-bookings.ts` | Add admin REST routes + self-serve public routes |
| `server/lib/email-templates.ts` | Add `buildManageEmail` function |
| `client/src/components/admin/BookingsSection.tsx` | Add Recurring Subscriptions tab/panel |
| `client/src/pages/ManageSubscription.tsx` | New self-serve page (lazy loaded) |
| `client/src/App.tsx` | Register `/manage-subscription/:token` route |

### Admin API routes to add (in server/routes/recurring-bookings.ts)

```typescript
// RECUR-04: Admin list — requires session auth (existing admin middleware)
GET  /api/admin/recurring-bookings             // list all, optional ?status=active|paused|cancelled
PATCH /api/admin/recurring-bookings/:id/status // { action: 'pause' | 'unpause' | 'cancel' }
```

Admin routes must be protected with the existing admin auth middleware used throughout `server/routes.ts`. Look at how other admin routes validate the session (typically `requireAuth` or equivalent).

### Self-serve public routes to add

```typescript
// RECUR-05: Public, no auth — token is the auth
GET  /api/subscriptions/manage/:token   // returns { status, frequencyName, nextBookingDate, serviceName }
POST /api/subscriptions/manage/:token/action  // { action: 'pause' | 'unpause' | 'cancel' }
```

Rate limiting is NOT in scope for v4.0. The UUID token is 128-bit random, making brute force practically impossible. No CSRF protection needed on these routes because there is no cookie session — each request must carry the token in the URL path.

### Self-serve token approach: permanent UUID column (RECOMMENDED)

**Decision: `manageToken uuid DEFAULT gen_random_uuid() NOT NULL` column on `recurringBookings`.**

Rationale:
- Simple: no separate token table, no expiry management, no refresh logic.
- Adequate security: UUID is a 128-bit opaque value, no integer ID exposed in URL.
- Precedent: this codebase has no JWT infrastructure; adding one for a single use case would be disproportionate.
- Tradeoffs accepted: token never expires — acceptable because it only allows pause/cancel on that one subscription, not read of account data or creation of new bookings.

Alternative considered: **signed JWT with expiry**. Rejected because (a) no existing JWT library in the project, (b) customer use case is "I received an email, I want to pause" not "recurring access to a management portal", (c) REQUIREMENTS.md explicitly rules out a full login portal for v4.0.

### State transition rules for pause/cancel

```
active  → pause   → status = 'paused',  pausedAt = now()
paused  → unpause → status = 'active',  pausedAt = null
active  → cancel  → status = 'cancelled', cancelledAt = now()
paused  → cancel  → status = 'cancelled', cancelledAt = now()
cancelled → * → BLOCKED (no transitions out of cancelled)
```

**Effect on already-generated bookings:** The recurring-booking-generator re-checks subscription status inside a transaction (see `recurring-booking-generator.ts` lines 56–63). Paused/cancelled subscriptions are skipped at generation time. Already-generated future bookings remain in place — they are normal bookings and should NOT be auto-cancelled when a subscription is paused. Cancelling a subscription does not cascade to future bookings. The admin can manually cancel individual future bookings via the existing bookings panel if needed. This matches the minimal v4.0 scope.

### Admin panel placement: Tab inside BookingsSection (RECOMMENDED)

Rationale: The sidebar already has a "Bookings" item. Adding a separate "Subscriptions" menu item clutters navigation for a secondary feature. A tab group inside BookingsSection (`All Bookings | Recurring Subscriptions`) keeps it discoverable without noise.

Implementation: Add `activeBookingTab: 'bookings' | 'subscriptions'` state to BookingsSection. When `activeBookingTab === 'subscriptions'`, render a new `<RecurringSubscriptionsPanel>` sub-component.

The `<RecurringSubscriptionsPanel>` should show:
- Customer name (from contacts JOIN — or fallback to booking customerName)
- Service name
- Frequency (frequencyName snapshot)
- Next booking date
- Status badge (active/paused/cancelled)
- Pause / Cancel / Unpause action buttons

### Email for self-serve link delivery

**When to send:** The self-serve link email should be sent when a recurring subscription is first created. In Phase 27/28, the subscription is created inside `POST /api/bookings` after the customer completes checkout. That route is in `server/routes/bookings.ts`. After subscription creation, call `sendEmail` with the manage link.

**Template: `buildManageEmail(data)`** to add to `server/lib/email-templates.ts`:

```typescript
export interface ManageEmailData {
  customerName: string;
  serviceName: string;
  frequencyName: string;
  manageUrl: string;     // https://yourdomain.com/manage-subscription/<token>
  companyName: string;
}
```

The `manageUrl` base must be derived from `process.env.APP_URL` or `process.env.VITE_APP_URL` (check which env var the codebase uses for absolute URL construction). If none exists, add `APP_URL` to `.env.example`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation | Custom UUID gen | PostgreSQL `gen_random_uuid()` as column default | Already used elsewhere in schema (visitorSessions.id, conversations.id) |
| Admin auth on new routes | Custom middleware | Existing admin auth pattern from server/routes.ts | Consistent, already tested |
| Email sending | Direct SMTP calls | `sendEmail()` from server/lib/email.ts | Already non-throwing, configured |
| HTML email layout | New CSS | Copy/extend the `buildReminderEmail` HTML pattern | Brand-consistent Outfit/Inter/#1C53A3 already established |
| UI action buttons | Custom confirm dialogs | shadcn `AlertDialog` — already imported in BookingsSection.tsx | Already used for booking cancel confirmation |

---

## Common Pitfalls

### Pitfall 1: Token replay / sharing
**What goes wrong:** Customer forwards the self-serve email; someone else clicks it and cancels the subscription.
**Why it happens:** Permanent tokens don't expire.
**How to avoid:** This is accepted risk for v4.0. The token only allows pause/cancel — it cannot read payment info, create bookings, or access other subscriptions. REQUIREMENTS.md already ruled out a login system.
**Warning signs:** N/A — not a bug to defend against in v4.0.

### Pitfall 2: Cancelled subscription still generates bookings
**What goes wrong:** Admin cancels subscription but tomorrow's cron still creates a booking.
**Why it happens:** Forgetting that the generator re-checks status inside the transaction (it does — line 61 of recurring-booking-generator.ts).
**How to avoid:** No code change needed in the generator. The existing status re-check already handles this. Verify the PATCH route sets `status = 'cancelled'` in the DB before the cron runs.

### Pitfall 3: `updateRecurringBooking` type-picks not including `manageToken`
**What goes wrong:** If someone tries to update `manageToken` via `updateRecurringBooking`, TypeScript blocks it because the `Partial<Pick<...>>` type doesn't include `manageToken`.
**How to avoid:** `manageToken` is set once by the DB default and never updated. Do not add it to the `updateRecurringBooking` pick. The column is write-once (generated at insert time).

### Pitfall 4: Self-serve page shows blank on token mismatch
**What goes wrong:** Customer types URL manually or token is truncated; GET returns 404 or 500; React page crashes.
**How to avoid:** `getRecurringBookingByToken` returns `undefined` on miss. The server route must return `404 { message: "Subscription not found" }`. The ManageSubscription page must handle the 404 gracefully (show "Link not found or expired" message, not a blank screen).

### Pitfall 5: `gen_random_uuid()` requires pgcrypto extension on older Postgres
**What goes wrong:** Migration fails with "function gen_random_uuid() does not exist".
**Why it happens:** Supabase projects use Postgres 15+ which has `gen_random_uuid()` built-in without pgcrypto. But if the dev local DB is older, it might not have the extension.
**How to avoid:** Supabase always has it. For local dev, note in `.env.example` comment. Not a blocker.

### Pitfall 6: Missing APP_URL env var breaks manage link in email
**What goes wrong:** The `manageUrl` in the email is `undefined/manage-subscription/abc123`.
**Why it happens:** `process.env.APP_URL` is not set in `.env.example`.
**How to avoid:** Add `APP_URL=http://localhost:5000` to `.env.example`. Server code should gracefully fall back to a relative URL or log a warning if `APP_URL` is missing (matching the `sendEmail` graceful-skip pattern).

### Pitfall 7: Admin route returns bare `RecurringBooking[]` without contact/service names
**What goes wrong:** Admin panel shows "N/A" or numeric IDs instead of customer name and service name.
**Why it happens:** `getRecurringBookings()` only returns the subscription row; contactId and serviceId are just integers.
**How to avoid:** The admin GET route or a new `getRecurringBookingsWithDetails()` storage method must JOIN contacts and services. Plan this in the backend plan — do not leave it as a frontend lookup.

---

## Standard Stack

All libraries below are already installed in the project. No new npm dependencies needed for Phase 29.

| Library | Purpose | Already Used |
|---------|---------|--------------|
| drizzle-orm | Schema definition, DB queries | Yes — all queries |
| zod | Input validation on routes | Yes — all routes |
| nodemailer | SMTP email sending | Yes — Phase 28 |
| @tanstack/react-query | Server state in admin UI | Yes — BookingsSection |
| shadcn/ui (Tabs, Badge, AlertDialog, Button) | Admin panel UI | Yes — BookingsSection already imports AlertDialog |
| wouter | Frontend routing for self-serve page | Yes — App.tsx |
| lucide-react | Icons | Yes — BookingsSection imports Calendar, ChevronDown, etc. |

**No new dependencies required.**

---

## Code Examples

### Schema addition (shared/schema.ts)

```typescript
export const recurringBookings = pgTable("recurring_bookings", {
  // ... existing columns ...
  manageToken: uuid("manage_token").notNull().default(sql`gen_random_uuid()`), // Phase 29 RECUR-05
  // ... createdAt, updatedAt ...
});
```

Update the `insertRecurringBookingSchema` omit list to include `manageToken` (it's DB-generated):
```typescript
export const insertRecurringBookingSchema = createInsertSchema(recurringBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  pausedAt: true,
  manageToken: true,  // <- add this
});
```

### Migration SQL (Supabase CLI)

```sql
-- supabase/migrations/YYYYMMDD_add_recurring_manage_token.sql
ALTER TABLE recurring_bookings
  ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid();

-- Backfill existing rows (already handled by DEFAULT above, but be explicit)
UPDATE recurring_bookings SET manage_token = gen_random_uuid() WHERE manage_token IS NULL;
```

### New IStorage methods

```typescript
// In IStorage interface:
getRecurringBookingByToken(token: string): Promise<RecurringBooking | undefined>;
getRecurringBookingsWithDetails(): Promise<RecurringBookingWithDetails[]>;

// Supporting type:
export interface RecurringBookingWithDetails extends RecurringBooking {
  contactName: string | null;
  serviceName: string;
}
```

### Self-serve public route pattern

```typescript
// GET /api/subscriptions/manage/:token
router.get("/manage/:token", async (req, res) => {
  const sub = await storage.getRecurringBookingByToken(req.params.token);
  if (!sub) return res.status(404).json({ message: "Subscription not found" });
  const service = await storage.getService(sub.serviceId);
  return res.json({
    status: sub.status,
    frequencyName: sub.frequencyName,
    nextBookingDate: sub.nextBookingDate,
    serviceName: service?.name ?? "Service",
  });
});

// POST /api/subscriptions/manage/:token/action
router.post("/manage/:token/action", async (req, res) => {
  const { action } = req.body as { action: string };
  const sub = await storage.getRecurringBookingByToken(req.params.token);
  if (!sub) return res.status(404).json({ message: "Subscription not found" });
  if (sub.status === "cancelled") {
    return res.status(409).json({ message: "Subscription is already cancelled" });
  }
  // validate action
  if (!["pause", "unpause", "cancel"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }
  // state machine guard
  if (action === "unpause" && sub.status !== "paused") {
    return res.status(409).json({ message: "Subscription is not paused" });
  }
  const newStatus = action === "pause" ? "paused" : action === "cancel" ? "cancelled" : "active";
  const updated = await storage.updateRecurringBooking(sub.id, {
    status: newStatus,
    pausedAt: action === "pause" ? new Date() : action === "unpause" ? null : sub.pausedAt,
    cancelledAt: action === "cancel" ? new Date() : null,
    updatedAt: new Date(),
  });
  return res.json({ status: updated.status });
});
```

Note: `updateRecurringBooking` Pick type currently does not include `pausedAt: null` (only `pausedAt` timestamp). This will need to accommodate `null` for the unpause case — verify the Drizzle `.set()` accepts `null` for nullable timestamp columns.

### Admin status PATCH pattern

```typescript
// PATCH /api/admin/recurring-bookings/:id/status
// Protected by admin session middleware (same as /api/bookings/:id PATCH)
router.patch("/:id/status", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { action } = req.body as { action: 'pause' | 'unpause' | 'cancel' };
  const sub = await storage.getRecurringBooking(id);
  if (!sub) return res.status(404).json({ message: "Not found" });
  // ... same state machine as public route ...
});
```

### Email template pattern

```typescript
// In server/lib/email-templates.ts
export interface ManageEmailData {
  customerName: string;
  serviceName: string;
  frequencyName: string;
  manageUrl: string;
  companyName: string;
}

export function buildManageEmail(data: ManageEmailData): { subject: string; text: string; html: string } {
  // Follow same HTML skeleton as buildReminderEmail
  // Key CTA: <a href="${manageUrl}">Manage Your Subscription</a>
  // Brand: #1C53A3 heading, #FFFF01 CTA button with black bold text, rounded-full
}
```

### Admin panel tab integration (BookingsSection.tsx)

```tsx
// Add second tab group above existing filter
const [activeTab, setActiveTab] = useState<'bookings' | 'subscriptions'>('bookings');

// In JSX:
<div className="flex gap-2 mb-4">
  <Button variant={activeTab === 'bookings' ? 'default' : 'outline'} onClick={() => setActiveTab('bookings')}>
    All Bookings
  </Button>
  <Button variant={activeTab === 'subscriptions' ? 'default' : 'outline'} onClick={() => setActiveTab('subscriptions')}>
    Recurring Subscriptions
  </Button>
</div>
{activeTab === 'subscriptions' && <RecurringSubscriptionsPanel getAccessToken={getAccessToken} />}
```

`RecurringSubscriptionsPanel` is a new component at `client/src/components/admin/RecurringSubscriptionsPanel.tsx` — keeping it separate from the already-large BookingsSection is recommended.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond SMTP which already exists from Phase 28; no new CLI tools, databases, or services required for Phase 29)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — project has no test config files (no jest.config, vitest.config, pytest.ini) |
| Config file | None — Wave 0 would need to establish if automated tests are required |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECUR-04 | Admin panel lists subscriptions | manual-only | N/A | N/A — no test framework |
| RECUR-04 | Admin pause/cancel mutations update status | manual-only | N/A | N/A |
| RECUR-05 | Self-serve token resolves correct subscription | manual-only | N/A | N/A |
| RECUR-05 | Self-serve pause/cancel changes status | manual-only | N/A | N/A |
| RECUR-05 | Cancelled subscription cannot be transitioned | manual-only | N/A | N/A |

No test infrastructure exists in this project. All verification is via browser UAT. Phase 29 should include a `29-HUMAN-UAT.md` with browser verification steps.

---

## Open Questions

1. **Which existing admin auth middleware to use on the new admin routes?**
   - What we know: `server/routes.ts` handles auth for all existing admin routes. The recurring-bookings router is mounted in `server/routes.ts` or `server/index.ts` — check the mount point.
   - What's unclear: Whether the existing middleware is applied at the router mount level (covering all routes in the file) or per-route.
   - Recommendation: During plan writing, grep `requireAuth` or the session check pattern in `server/routes.ts` to confirm how to protect the new admin routes. If the cron router is already wrapped in auth middleware, the admin routes in the same file would need NO-auth exemptions (or better: split into two routers — one for cron, one for admin).

2. **Where does `POST /api/bookings` create the subscription, and does it currently send the manage email?**
   - What we know: Phase 28 added subscription creation to the booking POST handler. The manage email should be sent there immediately after `createRecurringBooking()`.
   - What's unclear: The exact file/line where the recurring subscription insert happens in `server/routes/bookings.ts` (not read in full — a large file).
   - Recommendation: The planner should read `server/routes/bookings.ts` to locate the `createRecurringBooking` call and identify where to inject the `sendEmail(buildManageEmail(...))` call. This is one surgical addition.

3. **Does `updateRecurringBooking` accept `null` for `pausedAt` (the unpause case)?**
   - What we know: The current Partial Pick type is `Partial<Pick<RecurringBooking, 'status' | 'nextBookingDate' | 'cancelledAt' | 'pausedAt' | 'updatedAt'>>`. `pausedAt` is a nullable timestamp column in the schema. Setting it to `null` on unpause should work with Drizzle `.set()`.
   - What's unclear: Whether the TypeScript signature resolves correctly (nullable vs undefined).
   - Recommendation: The implementation plan should explicitly handle this — use `pausedAt: null as any` or widen the Pick to `pausedAt: Date | null`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| JWT tokens for self-serve flows | Permanent UUID column (database token) | Simpler, no library needed, sufficient security for pause/cancel-only operations |
| Separate admin section for subscriptions | Tab inside existing Bookings section | Less nav clutter, faster to implement |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `shared/schema.ts` — confirmed `recurringBookings` columns, no `manageToken` present
- Direct codebase inspection: `server/storage.ts` — confirmed IStorage methods, `updateRecurringBooking` Pick signature
- Direct codebase inspection: `server/routes/recurring-bookings.ts` — confirmed only cron routes exist
- Direct codebase inspection: `server/lib/email.ts`, `email-templates.ts` — confirmed `sendEmail` + `buildReminderEmail` patterns
- Direct codebase inspection: `client/src/components/admin/BookingsSection.tsx` — confirmed no tab infrastructure, shadcn AlertDialog already imported
- Direct codebase inspection: `client/src/pages/Admin.tsx` — confirmed section→component mapping
- Direct codebase inspection: `client/src/App.tsx` — confirmed lazy-load pattern and route structure
- Direct codebase inspection: `server/services/recurring-booking-generator.ts` — confirmed status re-check inside transaction (lines 56–63)

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md + ROADMAP.md: confirmed RECUR-04/05 scope, confirmed "self-serve cancel/pause via email link token" decision, confirmed "no customer login portal" is out of scope

---

## Metadata

**Confidence breakdown:**
- Schema / storage layer: HIGH — read directly from source files
- Route patterns: HIGH — modeled on existing patterns in same codebase
- Admin UI placement: HIGH — confirmed BookingsSection structure, no existing tab infrastructure
- Self-serve token approach: HIGH — UUID column matches existing pattern (`visitorSessions.id`, `conversations.id`), aligns with REQUIREMENTS.md explicit constraint against login portal
- Email template: HIGH — `buildReminderEmail` pattern confirmed, extension is straightforward

**Research date:** 2026-05-11
**Valid until:** This research is based on the current codebase state. Valid as long as Phase 28 code is not reverted and `shared/schema.ts` is not independently modified.
