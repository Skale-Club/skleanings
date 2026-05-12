# Phase 30: Multiple Durations per Service - Research

**Researched:** 2026-05-11
**Domain:** Full-stack feature completion — database schema gaps, booking flow wiring, recurring instance fix
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

Phase 30 completes a partially-wired feature. The `service_durations` table, all four storage methods, and the admin ServiceForm UI already exist. The Supabase migration (`20260510000002_add_service_durations.sql`) has been applied. The `BookingPage.tsx` already renders a duration selector card UI and calls `updateItem` to override `durationMinutes` on the cart item when the customer confirms a choice.

What is **missing** is the data plumbing that carries the customer's duration choice through to the database records and the recurring booking generator. Specifically: (1) `cartItemSchema` silently strips `selectedDurationId` because the field is absent from the Zod schema; (2) `getCartItemsForBooking()` in `CartContext` never includes `selectedDurationId` in the payload it sends to the server; (3) `bookingItems` has no `durationLabel` or `durationMinutes` snapshot columns — chosen duration is never persisted; (4) `recurringBookings` has no `durationMinutes` snapshot column — the generator reads `service.durationMinutes` at runtime instead of the customer's chosen duration.

**Primary recommendation:** Add the two missing DB columns, add `selectedDurationId` to `cartItemSchema`, pass it through `getCartItemsForBooking`, resolve the chosen duration on the server during booking creation, and fix the recurring generator to read the snapshot.

---

## Project Constraints (from CLAUDE.md)

- **Migrations:** Always use Supabase CLI (`supabase migration new` + `supabase db push`). Never use `drizzle-kit push`.
- **Frontend routing:** Wouter (not React Router).
- **Server state:** React Query (no Redux).
- **ORM:** Drizzle ORM — schema changes require both a migration file and a `shared/schema.ts` update.
- **CTA style:** Brand Yellow `#FFFF01` with black bold text, pill-shaped (`rounded-full`).
- **Fonts:** Outfit (headings), Inter (body).
- **Admin pattern:** Lean admin UIs; do not replicate customer-side flows in admin modals.
- **Storage layer:** All DB operations go through `server/storage.ts` implementing `IStorage`. Routes never call raw SQL.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DUR-01 | Admin can add, remove, and reorder duration options (label, minutes, price) on the service edit screen | ServiceForm.tsx already has a working duration management UI — admin CRUD routes and storage methods already exist. No new admin UI work needed for basic CRUD. Reorder is handled by the `order` column. |
| DUR-02 | Customer sees duration cards and can select one before choosing a time slot | BookingPage.tsx already renders duration cards (lines 397–447) and calls `updateItem`. The UI is complete. The bug is that the selection is not sent to the server. |
| DUR-03 | Available time slots reflect the selected duration, not the catalog default | `totalDuration` in CartContext (line 222–225) reads `item.durationMinutes * item.quantity`. The BookingPage `updateItem` call at line 435 overrides `durationMinutes` on the cart item with `chosen.durationMinutes`. So if `updateItem` is called correctly, the availability API already receives the right duration via `totalDuration`. The fix is ensuring `updateItem` is called and the "Continue to Schedule" button navigates to step 3 properly. |
| DUR-04 | Booking record stores chosen duration label and minutes as a snapshot | `bookingItems` table lacks `durationLabel` (text) and `durationMinutes` (integer) snapshot columns. These must be added via migration + schema + storage write path. |
| DUR-05 | `cartItemSchema` must include `selectedDurationId` | Currently absent from `cartItemSchema` in `shared/schema.ts` — Zod strips it silently. Must add `selectedDurationId: z.number().optional()`. Server-side booking route must then resolve the chosen `ServiceDuration` record and use its `label` and `durationMinutes` for the snapshot. |
| DUR-06 | Recurring booking instances use duration chosen at original booking time | `recurringBookings` table has no `durationMinutes` column. Generator (`recurring-booking-generator.ts` line 78) reads `service.durationMinutes` directly. Need: add `durationMinutes` column to `recurringBookings`, set it at subscription creation time from the chosen duration, read it in the generator. |
</phase_requirements>

---

## Standard Stack

This phase is a feature-completion task within the existing stack. No new libraries are needed.

### Core (already in project)
| Library | Version | Purpose | Role in This Phase |
|---------|---------|---------|-------------------|
| Drizzle ORM | existing | Schema + queries | Add columns to `bookingItems` and `recurringBookings` |
| Zod | existing | Validation schemas | Add `selectedDurationId` to `cartItemSchema` |
| React Query | existing | Server state | Duration query already uses `useQueries` in BookingPage |
| shadcn/ui | existing | Admin UI components | Duration rows in ServiceForm already use Input, Button |
| Supabase CLI | existing | Migrations only | Two new migrations required |

### No New Dependencies
All functionality is implemented using existing project libraries.

---

## Architecture Patterns

### What Already Exists (Do Not Rebuild)

**DB table:** `service_durations` — exists, migrated, storage methods all implemented.

**Admin UI:** `client/src/components/admin/services/ServiceForm.tsx` — has a complete duration management section (add row, edit label/hours/minutes/price, delete, save). Already calls all four API endpoints.

**API routes:** `GET/POST /api/services/:id/durations`, `PATCH/DELETE /api/services/:id/durations/:durationId` — all exist in `server/routes/catalog.ts`.

**Customer UI:** Duration selector in `BookingPage.tsx` (lines 396–447) — renders duration cards, sets `selectedDurations` state, calls `updateItem` to override `durationMinutes` and `calculatedPrice` on the cart item.

**`totalDuration` computation:** `CartContext` line 222–225 sums `item.durationMinutes * item.quantity`. Once `updateItem` overrides `durationMinutes`, the availability API automatically receives the correct duration.

### What Is Missing (Must Build)

**Gap 1 — `cartItemSchema` missing `selectedDurationId`**
- File: `shared/schema.ts`, `cartItemSchema` (line 525)
- Fix: Add `selectedDurationId: z.number().optional()` inside `cartItemSchema`.
- Impact: Without this, Zod strips the field before it reaches the server.

**Gap 2 — `getCartItemsForBooking()` does not include `selectedDurationId`**
- File: `client/src/context/CartContext.tsx`, line 228–241
- Current code maps items but never includes `selectedDurationId` or `selectedDuration*` fields in the payload.
- Fix: Include `selectedDurationId: item.selectedDurationId` in the returned object.

**Gap 3 — Server booking creation ignores `selectedDurationId`**
- File: `server/routes/bookings.ts`, line 70–93
- The booking creation loop builds `bookingItemsData` but never looks up the chosen `ServiceDuration` to read its `label` and `durationMinutes`.
- Fix: When `cartItem.selectedDurationId` is present, call `storage.getServiceDuration(cartItem.selectedDurationId)` (need to add this method) or `storage.getServiceDurations(service.id)` and filter, then store `durationLabel` and `durationMinutes` on the `bookingItem`.

**Gap 4 — `bookingItems` lacks snapshot columns**
- File: `shared/schema.ts` (`bookingItems` table, line 487) and Supabase migration
- Missing columns: `durationLabel text` (nullable), `durationMinutes integer` (nullable)
- Fix: New migration + add columns to Drizzle table definition + update `bookingItemsData` construction to write these fields.

**Gap 5 — `recurringBookings` lacks `durationMinutes` snapshot column**
- File: `shared/schema.ts` (`recurringBookings` table, line 200) and Supabase migration
- Missing column: `durationMinutes integer` (nullable — null means use `service.durationMinutes`)
- Fix: New migration + add column to Drizzle table definition.

**Gap 6 — Recurring booking generator reads live catalog instead of snapshot**
- File: `server/services/recurring-booking-generator.ts`, line 78
- Current: `const durationMinutes = service.durationMinutes;`
- Fix: `const durationMinutes = sub.durationMinutes ?? service.durationMinutes;` — prefer the subscription snapshot, fall back to catalog.

**Gap 7 — Subscription creation does not capture `durationMinutes`**
- File: `server/routes/bookings.ts`, line 148–162
- When creating the `recurringBooking` row, `durationMinutes` is not set.
- Fix: Resolve chosen `durationMinutes` from the cart item (from `cartItemSchema.selectedDurationId` lookup or from the already-resolved `bookingItemsData`) and pass it to `storage.createRecurringBooking`.

### Data Flow Diagram (End-to-End)

```
[Customer selects duration card]
  → setSelectedDurations({serviceId: duration})
  → updateItem({ service: {...svc, durationMinutes: chosen.durationMinutes},
                 calculatedPrice: chosen.price,
                 selectedDurationId: chosen.id })
  → CartContext item.durationMinutes = chosen.durationMinutes (overridden)
  → totalDuration = sum(item.durationMinutes * qty) — NOW CORRECT

[Availability API call] — already works once totalDuration is correct

[Booking form submit]
  → getCartItemsForBooking() → includes selectedDurationId (after fix)
  → POST /api/bookings with cartItems[].selectedDurationId

[Server: booking creation]
  → Lookup ServiceDuration by selectedDurationId
  → Build bookingItemsData with durationLabel, durationMinutes
  → storage.createBooking → inserts bookingItems rows with snapshot

[Recurring subscription creation]
  → Resolve durationMinutes from chosen duration
  → storage.createRecurringBooking with durationMinutes snapshot

[Recurring generator — future runs]
  → Reads sub.durationMinutes ?? service.durationMinutes
  → Uses correct duration for end time and totalDurationMinutes
```

### BookingPage Flow (Existing Step Structure)

The step machine is: `2` (staff, if multi-staff) → `3` (duration selector + calendar/slots) → `4` (contact) → `5` (address + payment).

The duration selector renders **before** the calendar within step 3, gated by `!allDurationsSelected`. When all durations are chosen the calendar appears in the same step. The "Continue to Schedule" button on the duration panel calls `updateItem` and does NOT advance the step — the calendar becomes visible within the same step 3 panel once `allDurationsSelected` becomes true. This is the existing design; do not change the step flow.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Duration CRUD endpoints | Custom Express handlers | Already exist in `catalog.ts` |
| Duration storage methods | Direct `db.query` calls | `storage.getServiceDurations`, `createServiceDuration`, `updateServiceDuration`, `deleteServiceDuration` — all implemented |
| Duration admin UI | New admin page or modal | ServiceForm.tsx duration section already complete |
| Duration selector customer UI | New component | BookingPage.tsx duration card UI already complete |
| Duration validation | Custom parser | Extend `insertServiceDurationSchema` (Drizzle-Zod) |

---

## Common Pitfalls

### Pitfall 1: Zod silently strips `selectedDurationId`
**What goes wrong:** The field exists on `CartItem` and `AddToCartData` in TypeScript, and `getCartItemsForBooking` sends it, but `cartItemSchema` in `shared/schema.ts` does not declare it. Zod's `parse` (not `passthrough`) strips unknown fields silently. The server receives the booking payload with no `selectedDurationId`, so it cannot resolve the chosen duration.
**How to avoid:** Add `selectedDurationId: z.number().optional()` to `cartItemSchema` before any other change. This is the root cause of the entire server-side gap.
**Warning signs:** Server logs show `selectedDurationId` absent from `cartItem`; `bookingItems` rows have null `durationLabel`.

### Pitfall 2: `updateItem` is called but step does not advance
**What goes wrong:** The "Continue to Schedule" button in the duration selector (BookingPage line 427–446) calls `updateItem` for each service but does NOT call `handleNextStep`. The calendar shows within step 3 once `allDurationsSelected` is true (line 450). If `updateItem` incorrectly fails to override `durationMinutes`, `allDurationsSelected` may remain true but the cart still has the catalog default duration.
**How to avoid:** Verify `updateItem` spreads the `service` object correctly (it does via `...(data.service ? data.service : {})` at line 199). The real risk is if `selectedDurations[svc.id]` is undefined — the button is `disabled` when `!allDurationsSelected`, preventing this.

### Pitfall 3: Migration applied but `shared/schema.ts` not updated
**What goes wrong:** Supabase migration adds the column but Drizzle schema is not updated. Queries work at SQL level but TypeScript types are wrong; Drizzle `.returning()` does not include the new column in typed results.
**How to avoid:** Always update `shared/schema.ts` table definition and run `npm run check` after adding migration.

### Pitfall 4: `recurringBookings.durationMinutes` is nullable vs. NOT NULL
**What goes wrong:** If the column is `NOT NULL` with no default, existing subscription rows will fail to insert (pre-Phase 30 bookings have no selected duration). If it has a default of 0, the generator sees 0 and breaks time calculation.
**How to avoid:** Make the column `INTEGER NULL DEFAULT NULL`. The generator uses `sub.durationMinutes ?? service.durationMinutes` — null means use catalog default, which is the correct fallback for existing subscriptions.

### Pitfall 5: `getCartItemsForBooking` does not include `selectedDurationId`
**What goes wrong:** Even after fixing `cartItemSchema`, if `CartContext.getCartItemsForBooking()` does not include `selectedDurationId` in its returned objects, the server never sees it.
**How to avoid:** The function at line 228–241 manually constructs the payload — add `selectedDurationId: item.selectedDurationId` explicitly.

### Pitfall 6: Storage `getServiceDuration` (single record) does not exist
**What goes wrong:** The server needs to look up one `ServiceDuration` by `id` to get its `label` and `durationMinutes`. The existing storage methods are `getServiceDurations(serviceId)` (returns array) — there is no single-record getter.
**How to avoid:** Add `getServiceDuration(id: number): Promise<ServiceDuration | undefined>` to `IStorage` interface and `DatabaseStorage` implementation, OR resolve inline by fetching the array and finding the matching ID.

### Pitfall 7: `bookingItems` snapshot write path is in `storage.createBooking`, not the route
**What goes wrong:** The route builds `bookingItemsData` and passes it to `storage.createBooking`. The storage method `createBooking` inserts `bookingItems` rows. The new `durationLabel`/`durationMinutes` fields must flow through the `bookingItemsData` array objects and be written in `storage.createBooking`'s insert statement.
**How to avoid:** After resolving the chosen duration in the route, include `durationLabel` and `durationMinutes` in the `bookingItemsData` objects. Then update the `storage.createBooking` insert to write these fields.

---

## Code Examples

### Add `selectedDurationId` to `cartItemSchema` (shared/schema.ts)
```typescript
// In cartItemSchema, add after selectedFrequencyId:
selectedDurationId: z.number().optional(), // Phase 30 DUR-05
```

### Add snapshot columns to `bookingItems` (shared/schema.ts)
```typescript
// Add to bookingItems table definition:
durationLabel: text("duration_label"),       // snapshot of chosen ServiceDuration.label
durationMinutes: integer("duration_minutes"), // snapshot of chosen ServiceDuration.durationMinutes
```

### Add `durationMinutes` to `recurringBookings` (shared/schema.ts)
```typescript
// Add to recurringBookings table definition:
durationMinutes: integer("duration_minutes"), // snapshot of chosen duration (null = use catalog default)
```

### Add `getServiceDuration` to IStorage interface + implementation (server/storage.ts)
```typescript
// Interface (around line 169):
getServiceDuration(id: number): Promise<ServiceDuration | undefined>;

// Implementation:
async getServiceDuration(id: number): Promise<ServiceDuration | undefined> {
  const [row] = await db.select().from(serviceDurations).where(eq(serviceDurations.id, id));
  return row;
}
```

### Server: resolve chosen duration in booking creation (server/routes/bookings.ts)
```typescript
// Inside the cartItems loop, after calculateCartItemPrice:
let durationLabel: string | undefined;
let resolvedDurationMinutes: number | undefined;
if (cartItem.selectedDurationId) {
  const chosenDuration = await storage.getServiceDuration(cartItem.selectedDurationId);
  if (chosenDuration) {
    durationLabel = chosenDuration.label;
    resolvedDurationMinutes = chosenDuration.durationMinutes;
  }
}
bookingItemsData.push({
  // ...existing fields...
  durationLabel: durationLabel ?? null,
  durationMinutes: resolvedDurationMinutes ?? null,
});
```

### Recurring generator fix (server/services/recurring-booking-generator.ts)
```typescript
// Replace line 78:
// const durationMinutes = service.durationMinutes;
// With:
const durationMinutes = sub.durationMinutes ?? service.durationMinutes;
```

### Subscription creation — capture durationMinutes (server/routes/bookings.ts)
```typescript
// When building the createRecurringBooking call, resolve from bookingItemsData or cartItem:
const chosenDurationMinutes = bookingItemsData[0]?.durationMinutes ?? null;
await storage.createRecurringBooking({
  // ...existing fields...
  durationMinutes: chosenDurationMinutes,
});
```

### Migration: add columns to `booking_items` and `recurring_bookings`
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_duration_snapshot_columns.sql
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS duration_label    TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER;

ALTER TABLE public.recurring_bookings
  ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER;
```

### `getCartItemsForBooking` fix (client/src/context/CartContext.tsx)
```typescript
const getCartItemsForBooking = () => {
  return items.map((item) => ({
    serviceId: item.id,
    quantity: item.quantity,
    areaSize: item.areaSize,
    areaValue: item.areaValue,
    selectedOptions: item.selectedOptions?.map((opt) => ({
      optionId: opt.optionId,
      quantity: opt.quantity,
    })),
    selectedFrequencyId: item.selectedFrequency?.id,
    customerNotes: item.customerNotes,
    selectedDurationId: item.selectedDurationId, // Phase 30 DUR-05
  }));
};
```

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| Duration selector not wired to server | `selectedDurationId` in `cartItemSchema` + snapshot columns | This phase implements it |
| Recurring generator reads live catalog | Generator reads `sub.durationMinutes` with catalog fallback | This phase implements it |

---

## Runtime State Inventory

> Phase 30 is a feature-completion phase, not a rename/refactor. Runtime state inventory below is included because it involves a DB schema migration.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing `booking_items` rows have no `duration_label`/`duration_minutes` — these are new nullable columns, existing rows remain valid with NULL | Migration uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — no data migration needed |
| Stored data | Existing `recurring_bookings` rows have no `duration_minutes` — nullable, NULL = use catalog default | Migration adds nullable column — no data migration needed; generator falls back gracefully via `?? service.durationMinutes` |
| Live service config | None — no external service stores duration data | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

---

## Environment Availability

> Phase is purely code/config changes plus two Supabase migrations. All required tools are the standard project stack.

| Dependency | Required By | Available | Notes |
|------------|------------|-----------|-------|
| Supabase CLI | DB migrations | Confirmed (used by all prior phases) | Use `supabase migration new` + `supabase db push` |
| PostgreSQL (Supabase) | DB | Confirmed | Connected via `DATABASE_URL` |
| Node.js / npm | Build + type check | Confirmed | `npm run check` for TypeScript verification |

---

## Validation Architecture

### Test Framework
No automated test framework is configured in this project (no `jest.config.*`, `vitest.config.*`, or `pytest.ini` found). All validation is manual smoke testing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Validation Method |
|--------|----------|-----------|-------------------|
| DUR-01 | Admin can add/remove/reorder duration options | Manual | Open admin → Services → edit a service → add 2+ durations with label, hours, price → save → reload → verify persisted |
| DUR-02 | Customer sees duration cards | Manual smoke | Add a service with durations to cart → go to /booking → Step 3 shows duration cards before calendar |
| DUR-03 | Time slots reflect selected duration | Manual smoke | Select a 2-hour duration → verify slot grid changes compared to 1-hour default |
| DUR-04 | Booking record stores duration snapshot | Manual smoke | Complete a booking after selecting a duration → check `booking_items` row in DB for non-null `duration_label` and `duration_minutes` |
| DUR-05 | `selectedDurationId` flows through Zod | Code verification | `npm run check` passes; add console.log in booking route to confirm `cartItem.selectedDurationId` is present |
| DUR-06 | Recurring instances use chosen duration | Manual smoke | Create a recurring booking with non-default duration → manually trigger generator → verify generated booking `total_duration_minutes` matches chosen duration |

### Wave 0 Gaps
None — no test infrastructure to set up. Validation is all manual smoke testing against the running dev server.

---

## Open Questions

1. **Is `insertRecurringBookingSchema` autogenerated?**
   - What we know: It uses `createInsertSchema(recurringBookings).omit({...})`. When `durationMinutes` is added to the table, it will appear in the insert schema automatically.
   - What's unclear: Whether any call site passes a typed `InsertRecurringBooking` object that TypeScript would complain about after adding the new column.
   - Recommendation: After updating the schema, run `npm run check` to surface any type errors at call sites.

2. **Should Phase 31 email templates read `durationLabel` from `bookingItems`?**
   - What we know: The additional context says "Duration label snapshot must be stored on `bookingItems` for use by SEED-019 email templates (Phase 31)."
   - What's unclear: Phase 31 scope.
   - Recommendation: Store `durationLabel` on `bookingItems` in this phase as specified; Phase 31 can read it without any further schema changes.

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `shared/schema.ts` — `serviceDurations` table definition, `bookingItems` columns, `recurringBookings` columns, `cartItemSchema`
- Direct inspection of `server/storage.ts` — all four `serviceDuration` CRUD methods confirmed implemented
- Direct inspection of `server/routes/catalog.ts` — all four duration API routes confirmed
- Direct inspection of `client/src/pages/BookingPage.tsx` — duration selector UI confirmed, step flow understood
- Direct inspection of `client/src/context/CartContext.tsx` — `totalDuration` bug (line 222–225 reads `item.durationMinutes`) and `getCartItemsForBooking` gap confirmed
- Direct inspection of `server/routes/bookings.ts` — booking creation loop confirmed; `selectedDurationId` never resolved
- Direct inspection of `server/services/recurring-booking-generator.ts` — line 78 confirmed reads `service.durationMinutes` directly
- Direct inspection of `supabase/migrations/20260510000002_add_service_durations.sql` — migration confirmed applied

### Secondary (MEDIUM confidence)
- N/A

### Tertiary (LOW confidence)
- N/A

---

## Metadata

**Confidence breakdown:**
- Schema gaps: HIGH — confirmed by direct table inspection
- Booking route gaps: HIGH — confirmed by reading full booking creation handler
- CartContext bugs: HIGH — confirmed by reading full context implementation
- Recurring generator bug: HIGH — confirmed by reading generator source
- Migration status: HIGH — migration file exists in supabase/migrations, dated before latest migrations

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable codebase)
