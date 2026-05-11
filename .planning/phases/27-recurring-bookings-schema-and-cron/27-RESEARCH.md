# Phase 27: Recurring Bookings — Schema & Cron Foundation — Research

**Researched:** 2026-05-11
**Domain:** PostgreSQL schema design, cron job architecture, Express.js background jobs on Vercel/serverless
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECUR-01 | Customer can select a recurring frequency (weekly, biweekly, monthly) with discount preview when booking | Schema must store frequency enum and discountPercent; `serviceFrequencies` table already holds discounts |
| RECUR-02 | System automatically generates the next booking 7 days before the scheduled date (one-ahead generation) | GitHub Actions → POST `/api/recurring-bookings/cron/generate` pattern, same as blog autopost; cron reads `nextBookingDate` and creates booking via storage layer |

</phase_requirements>

---

## Summary

Phase 27 lays the database and job-scheduling foundation for recurring cleaning subscriptions. It does not ship any customer-facing UI (that is Phase 28) — it only proves that a subscription record can live in the database and the system can auto-generate the next occurrence on schedule.

The project already has `serviceFrequencies` (id, serviceId, name, discountPercent, order) which represents discount tiers for recurring frequencies like "Weekly" or "Biweekly". This table is the **source of discount truth** for recurring bookings. Phase 27 introduces a separate `recurringBookings` table that references a `serviceFrequency` row (to snapshot the discount) and drives the generation schedule.

The project runs on Vercel (serverless) in production. The existing blog autopost feature established the canonical cron pattern for this stack: a **GitHub Actions schedule** fires a POST to a secured API endpoint (`Bearer CRON_SECRET`) instead of using `node-cron` in-process. The `startCronJobs()` in `server/services/cron.ts` already skips scheduling when `VERCEL` env is set and falls back to GitHub Actions. Phase 27 follows the identical pattern.

**Primary recommendation:** Add `recurringBookings` table + `recurringBookingId` FK on `bookings`, implement storage methods, and add a `/api/recurring-bookings/cron/generate` endpoint secured by `CRON_SECRET`. Wire a new GitHub Actions workflow to call it daily.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | already installed | Schema definition + DB queries | Project ORM; all tables use it |
| drizzle-zod | already installed | Auto-generate insert schemas | Pattern used throughout shared/schema.ts |
| node-cron | ^4.2.1 (already in package.json) | Local dev cron only | Skip in serverless; already used by blog cron |
| GitHub Actions schedule | N/A | Production cron trigger | Same mechanism as blog-autopost.yml |

No new npm packages required. Everything needed is already installed.

**Version verification:** node-cron 4.2.1 confirmed from registry (matches package.json ^4.2.1 pin).

---

## Architecture Patterns

### Existing `serviceFrequencies` table (do NOT rename)

```typescript
// Already in shared/schema.ts — lines 100-106
export const serviceFrequencies = pgTable("service_frequencies", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  name: text("name").notNull(),          // e.g. "Weekly", "Biweekly", "Monthly"
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  order: integer("order").default(0),
});
```

This table is already used in `bookingItems.selectedFrequency` (JSONB snapshot). Phase 27 links `recurringBookings` to a `serviceFrequencyId` FK so the discount is traceable.

### Existing `bookings` table — key fields for cron generation

```typescript
// Relevant columns from shared/schema.ts bookings table:
//   bookingDate   date      YYYY-MM-DD
//   startTime     text      HH:MM
//   endTime       text      HH:MM
//   totalDurationMinutes integer
//   totalPrice    numeric
//   status        text      pending | confirmed | cancelled | completed | awaiting_approval
//   contactId     integer   FK → contacts.id (nullable, set by auto-link logic)
//   staffMemberId integer   FK → staffMembers.id (nullable)
// No recurringBookingId column yet — must be added in migration
```

### Proposed `recurringBookings` table

```typescript
export const recurringBookings = pgTable("recurring_bookings", {
  id: serial("id").primaryKey(),

  // Ownership — who is this subscription for
  contactId: integer("contact_id")
    .references(() => contacts.id, { onDelete: "set null" }),  // nullable; populated at creation from booking
  
  // What service, which frequency
  serviceId: integer("service_id")
    .references(() => services.id, { onDelete: "restrict" })
    .notNull(),
  serviceFrequencyId: integer("service_frequency_id")
    .references(() => serviceFrequencies.id, { onDelete: "restrict" })
    .notNull(),

  // Snapshot of discount at subscription creation time
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),

  // Scheduling fields
  startDate: date("start_date").notNull(),         // YYYY-MM-DD — date of first booking
  endDate: date("end_date"),                       // nullable — open-ended subscriptions
  nextBookingDate: date("next_booking_date").notNull(),  // YYYY-MM-DD — cron checks this
  preferredStartTime: text("preferred_start_time").notNull(), // HH:MM
  preferredStaffMemberId: integer("preferred_staff_member_id")
    .references(() => staffMembers.id, { onDelete: "set null" }),  // nullable

  // Lifecycle
  status: text("status").notNull().default("active"),  // active | paused | cancelled
  cancelledAt: timestamp("cancelled_at"),
  pausedAt: timestamp("paused_at"),

  // Audit trail — first booking that originated this subscription
  originBookingId: integer("origin_booking_id")
    .references(() => bookings.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### `bookings` table FK addition

Add one nullable column to `bookings`:

```sql
ALTER TABLE bookings
  ADD COLUMN recurring_booking_id integer
  REFERENCES recurring_bookings(id) ON DELETE SET NULL;
```

Drizzle equivalent (in schema.ts):

```typescript
recurringBookingId: integer("recurring_booking_id")
  .references(() => recurringBookings.id, { onDelete: "set null" }),
```

Generated bookings from the cron job will have this set; one-time bookings will have it NULL.

### One-Ahead Generation Pattern

The cron runs daily. The query selects active subscriptions where `nextBookingDate <= today + 7 days`. For each match:

1. Compute the target booking date (`nextBookingDate`).
2. Call `storage.createBooking(...)` with the subscription's service, contact, staff, time, and discounted price.
3. Set `recurringBookingId` on the new booking row.
4. Advance `nextBookingDate` on the subscription by `frequency`:
   - weekly → add 7 days
   - biweekly → add 14 days
   - monthly → add 1 calendar month (use `date-fns/addMonths` or raw SQL `+ INTERVAL '1 month'`)
5. Log the result.

**CRITICAL:** Steps 3 and 4 must be atomic (DB transaction) to prevent duplicate generation on retry. If the cron fires twice (GitHub Actions retry), the subscription's `nextBookingDate` will already be advanced, so the second run skips it.

### Cron Endpoint Pattern (same as blog autopost)

```
POST /api/recurring-bookings/cron/generate
Authorization: Bearer <CRON_SECRET>
```

```typescript
router.post("/cron/generate", async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace("Bearer ", "") ?? req.body?.secret;
  if (!cronSecret || provided !== cronSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  // run generation
  const result = await runRecurringBookingGeneration();
  res.json(result);
});
```

GitHub Actions workflow fires this daily at a configured time (e.g., `0 6 * * *` = 6 AM UTC). The endpoint logs: subscriptions checked, bookings created, errors per subscription.

### Frequency → Interval Calculation

```typescript
// Canonical mapping (stored in the serviceFrequencies.name or derived from a separate field)
// For Phase 27, frequency is resolved from serviceFrequencyId.name at generation time.
// The cron service needs a deterministic mapping:
function advanceDate(current: string, frequencyName: string): string {
  const d = new Date(current + "T00:00:00Z");
  switch (frequencyName.toLowerCase()) {
    case "weekly":    d.setUTCDate(d.getUTCDate() + 7);  break;
    case "biweekly":  d.setUTCDate(d.getUTCDate() + 14); break;
    case "monthly":   d.setUTCMonth(d.getUTCMonth() + 1); break;
    default: throw new Error(`Unknown frequency: ${frequencyName}`);
  }
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
```

No extra library needed — native `Date` with UTC methods is sufficient for YYYY-MM-DD arithmetic.

### Recommended Project Structure

```
server/
├── routes/
│   └── recurring-bookings.ts    # NEW — cron endpoint + admin CRUD (Phases 28-29 extend)
├── services/
│   ├── cron.ts                  # EXTEND — add runRecurringBookingGeneration call
│   └── recurring-booking-generator.ts  # NEW — generation logic, testable in isolation
shared/
└── schema.ts                    # EXTEND — recurringBookings table + bookings FK column

supabase/migrations/
└── 20260511000003_add_recurring_bookings.sql  # NEW

.github/workflows/
└── recurring-bookings-cron.yml  # NEW — daily schedule → POST /api/recurring-bookings/cron/generate
```

### Anti-Patterns to Avoid

- **Generating all future bookings upfront:** Calendar pollution, no flexibility to adjust schedule. Use one-ahead pattern only.
- **Using `node-cron` for production scheduling:** Vercel is serverless — processes don't persist. GitHub Actions is the correct mechanism (already proven by blog autopost).
- **Advancing `nextBookingDate` before the booking insert succeeds:** If the insert fails, the subscription gets stuck with an advanced date. Wrap both in a transaction.
- **Hardcoding frequency interval in `recurringBookings`:** The source of truth is `serviceFrequencies.name`. Derive the interval from the name at generation time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CRON_SECRET auth | Custom token system | Existing `CRON_SECRET` env var pattern | Already wired for blog cron |
| Frequency advance | Manual date math library | Native UTC `Date` methods | No edge cases at this scale; date-fns is not in project dependencies |
| Booking creation | Custom INSERT | `storage.createBooking()` | Reuses all existing GHL sync, notification, and contact-link side effects |
| Duplicate guard | Custom lock table | Transaction: advance date + insert booking atomically | The advanced `nextBookingDate` IS the idempotency key |

**Key insight:** The project's existing `storage.createBooking()` fires GHL sync, Twilio/Telegram notifications, and contact linking as side effects. The cron job should call this method so generated bookings receive the same treatment as manually-booked ones — but with `recurringBookingId` set.

---

## Migration Filename

The latest existing migration is:

```
supabase/migrations/20260511000002_add_booking_item_question_answers.sql
```

Next migration filename:

```
supabase/migrations/20260511000003_add_recurring_bookings.sql
```

---

## Files to Change and What Specifically

| File | Change | Notes |
|------|--------|-------|
| `shared/schema.ts` | Add `recurringBookings` table definition, `insertRecurringBookingSchema`, type exports; add `recurringBookingId` nullable FK column to `bookings` table | Follow existing patterns exactly: `serial` PK, `createInsertSchema`, export both schema and type |
| `server/storage.ts` | Add `IStorage` methods: `createRecurringBooking`, `getRecurringBookings`, `getActiveRecurringBookingsDueForGeneration`, `updateRecurringBooking` (advance `nextBookingDate`, set status), `getRecurringBooking`; import new types | `getActiveRecurringBookingsDueForGeneration` takes `asOfDate` param — returns subscriptions where `status='active'` and `nextBookingDate <= asOfDate + 7 days` |
| `server/services/recurring-booking-generator.ts` | NEW — `runRecurringBookingGeneration()`: query due subscriptions, for each: compute target booking row, call `storage.createBooking` in transaction that also advances `nextBookingDate`, collect per-subscription error without crashing whole run | Isolated service, easy to unit test |
| `server/routes/recurring-bookings.ts` | NEW — `POST /cron/generate` (CRON_SECRET auth, calls generator, returns JSON summary) | Start minimal; Phases 28-29 will add more routes to this file |
| `server/routes.ts` | Register new router: `app.use('/api/recurring-bookings', recurringBookingsRouter)` | Same pattern as bookings, blog routes |
| `server/services/cron.ts` | In non-serverless branch, add daily schedule `0 6 * * *` calling `runRecurringBookingGeneration` directly | Already uses lazy `import("node-cron")` pattern |
| `.github/workflows/recurring-bookings-cron.yml` | NEW — daily GitHub Actions schedule → POST `/api/recurring-bookings/cron/generate` | Mirror `blog-autopost.yml` structure; use same `CRON_SECRET` + `APP_URL` secrets |
| `supabase/migrations/20260511000003_add_recurring_bookings.sql` | CREATE TABLE recurring_bookings + ALTER TABLE bookings ADD COLUMN recurring_booking_id | Use Supabase CLI for migration (NEVER drizzle-kit push — see project memory) |

---

## Common Pitfalls

### Pitfall 1: Duplicate Booking Generation on Cron Retry

**What goes wrong:** GitHub Actions can retry a failed workflow. If the workflow is retried after the booking insert succeeds but before `nextBookingDate` is advanced (or if both run in the same second), two bookings are generated for the same date.

**Why it happens:** Non-atomic update sequence — insert booking first, then advance date in a separate query.

**How to avoid:** Wrap the booking insert AND the `nextBookingDate` advance in a single DB transaction. After the transaction commits, the subscription's `nextBookingDate` is in the future, so any retry will skip this subscription.

**Warning signs:** Duplicate bookings with the same `recurringBookingId` and `bookingDate`. Add a unique index: `UNIQUE (recurring_booking_id, booking_date)` on `bookings` for generated rows — or check for existing booking in the generation query.

### Pitfall 2: Paused Subscription Still Generates

**What goes wrong:** A subscription is paused mid-day. The cron already loaded it in its query batch and generates a booking.

**Why it happens:** Status check at query time vs. generation time race condition.

**How to avoid:** Re-check `status` inside the transaction before inserting. If status is not `active` at commit time, abort the transaction for that subscription.

### Pitfall 3: `nextBookingDate` Drift for Monthly Frequency

**What goes wrong:** Monthly bookings on Jan 31 → Feb 28 → Mar 28 (drifted from original day-of-month). The customer expects every last day of the month.

**Why it happens:** Adding 1 month to Feb 28 gives Mar 28, not Mar 31.

**How to avoid:** For Phase 27 (schema + cron foundation), document this as a known limitation. Store `preferredDayOfMonth` (nullable integer) on the subscription and clamp on each advance. Only relevant when serviceFrequency name is "monthly". Implement clamping in `advanceDate()` from day one.

### Pitfall 4: `createBooking` Side Effects on Cron-Generated Bookings

**What goes wrong:** The cron calls `storage.createBooking()`, which triggers GHL sync and Twilio notifications. Customer gets a Twilio "new booking" text for every auto-generated future booking, which feels spammy.

**Why it happens:** `createBooking` always fires notifications.

**How to avoid:** Pass an `options: { suppressNotifications?: boolean }` flag to `createBooking`, or use a lower-level DB insert in the cron path. For Phase 27 (cron foundation only, no customer flow yet), use a raw insert with `recurringBookingId` set, bypassing the route handler. Phase 28 decides final notification strategy.

### Pitfall 5: `endDate` Check Missing

**What goes wrong:** A subscription with `endDate` set continues generating bookings past the end date because the query only checks `nextBookingDate <= today+7` and `status='active'`.

**Why it happens:** Missing `endDate` filter in the generation query.

**How to avoid:** In `getActiveRecurringBookingsDueForGeneration`, add: `AND (end_date IS NULL OR end_date > nextBookingDate)`.

---

## Code Examples

### Migration SQL

```sql
-- supabase/migrations/20260511000003_add_recurring_bookings.sql

CREATE TABLE recurring_bookings (
  id                       serial PRIMARY KEY,
  contact_id               integer REFERENCES contacts(id) ON DELETE SET NULL,
  service_id               integer NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  service_frequency_id     integer NOT NULL REFERENCES service_frequencies(id) ON DELETE RESTRICT,
  discount_percent         numeric(5,2) NOT NULL DEFAULT 0,
  start_date               date NOT NULL,
  end_date                 date,
  next_booking_date        date NOT NULL,
  preferred_start_time     text NOT NULL,
  preferred_staff_member_id integer REFERENCES staff_members(id) ON DELETE SET NULL,
  status                   text NOT NULL DEFAULT 'active',  -- active | paused | cancelled
  cancelled_at             timestamptz,
  paused_at                timestamptz,
  origin_booking_id        integer REFERENCES bookings(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_bookings_status_next_date
  ON recurring_bookings (status, next_booking_date);

ALTER TABLE bookings
  ADD COLUMN recurring_booking_id integer
  REFERENCES recurring_bookings(id) ON DELETE SET NULL;

-- Prevent duplicate auto-generation for same subscription + date
CREATE UNIQUE INDEX idx_bookings_recurring_date_unique
  ON bookings (recurring_booking_id, booking_date)
  WHERE recurring_booking_id IS NOT NULL;
```

### Drizzle Schema Additions (shared/schema.ts)

```typescript
// Place BEFORE bookings table (bookings references recurringBookings)
export const recurringBookings = pgTable("recurring_bookings", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "restrict" }).notNull(),
  serviceFrequencyId: integer("service_frequency_id").references(() => serviceFrequencies.id, { onDelete: "restrict" }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  nextBookingDate: date("next_booking_date").notNull(),
  preferredStartTime: text("preferred_start_time").notNull(),
  preferredStaffMemberId: integer("preferred_staff_member_id").references(() => staffMembers.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  cancelledAt: timestamp("cancelled_at"),
  pausedAt: timestamp("paused_at"),
  originBookingId: integer("origin_booking_id").references(() => bookings.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRecurringBookingSchema = createInsertSchema(recurringBookings).omit({
  id: true, createdAt: true, updatedAt: true, cancelledAt: true, pausedAt: true,
});
export type RecurringBooking = typeof recurringBookings.$inferSelect;
export type InsertRecurringBooking = z.infer<typeof insertRecurringBookingSchema>;
```

Then in `bookings` table definition, add:
```typescript
  recurringBookingId: integer("recurring_booking_id")
    .references(() => recurringBookings.id, { onDelete: "set null" }),
```

**IMPORTANT:** `recurringBookings` table definition must appear BEFORE `bookings` in schema.ts because `bookings` references it. This is a forward-reference issue — move the definition above the `bookings` pgTable call.

### Storage Methods Signature

```typescript
// In IStorage interface
createRecurringBooking(data: InsertRecurringBooking): Promise<RecurringBooking>;
getRecurringBooking(id: number): Promise<RecurringBooking | undefined>;
getRecurringBookings(statusFilter?: string): Promise<RecurringBooking[]>;
getActiveRecurringBookingsDueForGeneration(asOfDate: string): Promise<RecurringBooking[]>;
// asOfDate = YYYY-MM-DD; returns status='active' where next_booking_date <= asOfDate + 7 days AND (end_date IS NULL OR end_date > next_booking_date)
updateRecurringBooking(id: number, data: Partial<RecurringBooking>): Promise<RecurringBooking>;
```

### Generator Service Skeleton

```typescript
// server/services/recurring-booking-generator.ts
export async function runRecurringBookingGeneration(asOfDateOverride?: string): Promise<GenerationResult> {
  const today = asOfDateOverride ?? new Date().toISOString().slice(0, 10);
  const due = await storage.getActiveRecurringBookingsDueForGeneration(today);

  let created = 0;
  const errors: { subscriptionId: number; error: string }[] = [];

  for (const sub of due) {
    try {
      await db.transaction(async (tx) => {
        // Re-check status inside transaction (guard against race)
        const fresh = await tx.select().from(recurringBookings)
          .where(eq(recurringBookings.id, sub.id)).limit(1);
        if (!fresh[0] || fresh[0].status !== 'active') return;

        // Insert booking row (lower-level to bypass notification side-effects in Phase 27)
        const [newBooking] = await tx.insert(bookings).values({
          // ... fields derived from sub
          recurringBookingId: sub.id,
        }).returning();

        // Advance nextBookingDate
        const nextDate = advanceDate(sub.nextBookingDate, sub.frequencyName);
        await tx.update(recurringBookings)
          .set({ nextBookingDate: nextDate, updatedAt: new Date() })
          .where(eq(recurringBookings.id, sub.id));

        created++;
      });
    } catch (err) {
      // Partial failure: log and continue
      errors.push({ subscriptionId: sub.id, error: String(err) });
      console.error(`[RecurringCron] Failed for subscription ${sub.id}:`, err);
    }
  }

  return { checked: due.length, created, errors };
}
```

### GitHub Actions Workflow

```yaml
# .github/workflows/recurring-bookings-cron.yml
name: Recurring Bookings Generation

on:
  schedule:
    - cron: '0 6 * * *'   # 6 AM UTC daily (adjust to match business timezone)
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Generate recurring bookings
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          APP_URL: ${{ vars.APP_URL }}
        run: |
          set -euo pipefail
          APP_URL="${APP_URL%/}"
          RESPONSE=$(curl -L -s -w "\n%{http_code}" -X POST \
            "${APP_URL}/api/recurring-bookings/cron/generate" \
            -H "Authorization: Bearer ${CRON_SECRET}" \
            -H "Content-Type: application/json" \
            --max-time 60)
          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | sed '$d')
          echo "Response: $BODY"
          echo "HTTP Status: $HTTP_CODE"
          if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
            echo "Cron endpoint failed"
            exit 1
          fi
```

Reuses the same `CRON_SECRET` and `APP_URL` secrets already configured in the repository for blog autopost — no new secrets required.

---

## Environment Availability

Step 2.6: SKIPPED for external services — this phase adds no new external dependencies. All tools (Drizzle ORM, node-cron, Supabase CLI for migrations, GitHub Actions) are already in place.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node-cron | Local dev scheduling | ✓ | 4.2.1 | GitHub Actions (production) |
| Supabase CLI | Migration apply | ✓ (project memory confirms) | — | None |
| CRON_SECRET env var | Cron endpoint auth | ✓ (already used by blog) | — | — |
| APP_URL GH Actions var | Workflow URL target | ✓ (already used by blog) | — | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, no vitest.config, no test/ directory) |
| Config file | None — Wave 0 gap |
| Quick run command | Manual: `curl -X POST /api/recurring-bookings/cron/generate -H "Authorization: Bearer <secret>"` |
| Full suite command | End-to-end manual verification |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECUR-01 (schema part) | `recurringBookings` table exists with all columns | smoke | `npm run db:push` (no error) + `psql \d recurring_bookings` | ❌ Wave 0 — manual SQL check |
| RECUR-02 | Cron generates booking for due subscription, advances `nextBookingDate` | integration | `curl -X POST .../api/recurring-bookings/cron/generate` returns `{ created: 1 }` | ❌ Wave 0 — needs test subscription seed |

### Sampling Rate

- **Per task:** Run migration, verify table structure with `psql \d recurring_bookings`
- **Per wave:** Hit the cron endpoint with a known-due test subscription, verify booking row created and `nextBookingDate` advanced
- **Phase gate:** All columns present, cron returns `{ checked: N, created: M, errors: [] }` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] Seed script to insert a test `recurringBooking` row with `nextBookingDate = today - 1 day` for manual cron testing
- [ ] No automated test framework — manual verification via cron endpoint + DB check is the gate

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `serviceFrequencies` as UI-only discount | Link `recurringBookings.serviceFrequencyId` to same table | Phase 27 | Discount source of truth unified |
| `node-cron` in-process for all jobs | GitHub Actions → secured HTTP endpoint | Blog autopost pattern (pre-Phase 27) | Serverless-safe; no in-process scheduling in production |

---

## Open Questions

1. **Should `createBooking` side effects (GHL, Twilio) fire for cron-generated bookings?**
   - What we know: `storage.createBooking()` fires GHL sync, Twilio/Telegram notifications, and contact linking unconditionally
   - What's unclear: Customer expects reminders (Phase 28) but not a "new booking created" Twilio ping for every auto-generated future booking
   - Recommendation: For Phase 27 (foundation), bypass `storage.createBooking()` and do a raw DB insert. Phase 28 decides the full notification strategy when customer flow is designed.

2. **`serviceFrequencies.name` as interval driver vs. a separate `frequencyDays` integer column on `recurringBookings`**
   - What we know: `serviceFrequencies.name` is free text (admin-controlled). The cron needs a deterministic interval.
   - What's unclear: What if admin renames "Weekly" to "Every Week"? The `advanceDate()` switch would break.
   - Recommendation: Add an `intervalDays` integer column to `recurringBookings` at creation time (7/14/30) derived from the `serviceFrequency` at subscription creation. This is a snapshot and survives admin renames.

3. **Monthly frequency and day-of-month clamping**
   - What we know: Adding 1 month to Jan 31 in JS gives Feb 28/29, then Mar 28 (drift).
   - What's unclear: Business priority for exact-date fidelity on monthly subscriptions.
   - Recommendation: Store `preferredDayOfMonth` (nullable integer) on `recurringBookings`; use it to clamp after adding 1 month. Implement from the start to avoid a migration later.

---

## Project Constraints (from CLAUDE.md)

- **ORM**: Drizzle ORM + drizzle-zod — all DB operations go through `server/storage.ts` implementing `IStorage`
- **Shared Schema**: New tables in `shared/schema.ts` with `createInsertSchema`, exported types
- **Migration tool**: Supabase CLI (NEVER drizzle-kit push) — per project memory
- **No Redux**: React Query + Context API only (frontend, not relevant to Phase 27)
- **Colors/Fonts**: Not relevant to this phase (backend only)
- **Session auth**: Admin endpoints require `requireAdmin` middleware; cron endpoint uses `CRON_SECRET` Bearer token instead

---

## Sources

### Primary (HIGH confidence)

- `shared/schema.ts` (read directly) — confirmed: `serviceFrequencies`, `bookings`, `contacts`, `staffMembers`, `systemHeartbeats` (heartbeat cron log pattern) table structures
- `server/services/cron.ts` (read directly) — confirmed: serverless detection pattern, `node-cron` lazy import, GitHub Actions delegation for production
- `server/routes/blog.ts` (read directly) — confirmed: `POST /cron/generate` with `CRON_SECRET` Bearer auth pattern
- `.github/workflows/blog-autopost.yml` (read directly) — confirmed: GitHub Actions schedule → API endpoint, same `CRON_SECRET` + `APP_URL` secrets
- `vercel.json` (read directly) — confirmed: no Vercel `crons` config block; GitHub Actions is the sole cron mechanism
- `server/storage.ts` `createBooking` (read directly) — confirmed: transaction-based, `bookingItemsData` format, GHL/notification side effects
- `package.json` (grep) — confirmed: `node-cron` ^4.2.1, `@types/node-cron` ^3.0.11 already installed

### Secondary (MEDIUM confidence)

- Project memory note: "Always use Supabase CLI for DB migrations, never drizzle-kit push" — applied to migration filename and tooling recommendation
- `supabase/migrations/` (glob) — latest file `20260511000002_add_booking_item_question_answers.sql`, next filename derived as `20260511000003_add_recurring_bookings.sql`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already installed; confirmed from package.json
- Architecture: HIGH — cron pattern directly observed in blog-autopost.yml and cron.ts; schema follows established Drizzle patterns
- Pitfalls: HIGH — duplicate-generation, side-effects, and monthly drift are well-understood problems documented from direct code reading
- Migration filename: HIGH — derived from directory listing of existing migrations

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable stack, 30-day window)
