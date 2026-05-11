# Phase 25: Multiple Time Slots Per Day - Research

**Researched:** 2026-05-11
**Domain:** Staff availability schema, slot generation algorithm, admin UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SLOTS-01 | Staff availability supports multiple time ranges per day (e.g., 8am-12pm AND 2pm-7pm on Monday) | Schema change: drop unique constraint, add `rangeOrder` column; storage method returns all ranges sorted by dayOfWeek + rangeOrder |
| SLOTS-02 | Admin can add, remove, and reorder time ranges per day in the availability editor | AvailabilityTab in StaffManageDialog.tsx becomes a multi-range editor; state changes from `AvailabilityRow[]` (one per day) to `DayRanges` map (array of ranges per day) |
| SLOTS-03 | Booking slot generation respects all configured ranges — no slots offered during gaps | `_generateSlots` in staff-availability.ts is called once per range; results merged and de-duplicated |
| SLOTS-04 | Migration preserves existing single-range availability data without data loss or behavioral change | Migration adds `range_order` column DEFAULT 0, existing rows remain valid as order=0 ranges |
</phase_requirements>

---

## Summary

The `staff_availability` table currently enforces one time range per `(staffMemberId, dayOfWeek)` pair via its structure (no explicit UNIQUE constraint in the migration, but the application reads with `.find()` which takes only the first match). Phase 25 lifts this restriction by adding a `range_order` integer column and treating multiple rows per `(staffMemberId, dayOfWeek)` as an ordered list of non-overlapping windows.

The slot generation algorithm in `server/lib/staff-availability.ts` generates slots within a single `[dayStartMins, dayEndMins]` window. With multiple ranges, the pattern changes to: for each range in the day, call `_generateSlots` with that range's bounds, then union all results. The existing booking-conflict and Google Calendar conflict checks inside `_generateSlots` are not affected — they operate on the specific slot regardless of which range produced it.

The admin UI in `StaffManageDialog.tsx → AvailabilityTab` renders one row per day. It needs to become a multi-range editor: each day shows its list of ranges with add (+) and remove (trash) buttons, matching the Cal.com pattern described in SEED-021.

**Primary recommendation:** Add `range_order INTEGER NOT NULL DEFAULT 0` to `staff_availability`; remove the implicit single-row assumption in the storage and slot algorithm; rebuild AvailabilityTab state from `AvailabilityRow[]` to `Record<dayOfWeek, RangeEntry[]>`. All changes are backward-safe for existing data.

---

## Project Constraints (from CLAUDE.md)

- Use Supabase CLI for migrations — NEVER `drizzle-kit push` (TTY prompt issues per MEMORY.md)
- Migration filename: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Tech stack: React 18, TypeScript, Vite, Wouter, React Query, shadcn/ui, Tailwind CSS (frontend); Express.js, Drizzle ORM, PostgreSQL (backend)
- All DB operations go through `server/storage.ts` implementing `IStorage` interface
- Shared schema in `shared/schema.ts` is the source of truth for types and Zod validators
- Use `insertXSchema` for inserts, `typeof table.$inferSelect` for selects

---

## Current Implementation Audit

### 1. Database — `staff_availability` table

**Defined at:** `shared/schema.ts` lines 923–930

```typescript
export const staffAvailability = pgTable("staff_availability", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(() => staffMembers.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday ... 6=Saturday
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(),     // HH:MM
  isAvailable: boolean("is_available").default(true).notNull(),
});
```

**Original migration:** `supabase/migrations/20260402000000_add_staff_tables.sql` lines 28–35

Key observation: There is **no explicit UNIQUE constraint** on `(staff_member_id, day_of_week)` in the SQL migration. The uniqueness assumption is only enforced by the application code (`.find(a => a.dayOfWeek === dayOfWeek)` in `AvailabilityTab` useEffect and `getStaffAvailableSlots`). This simplifies the migration — no constraint to drop, just add `range_order`.

### 2. Storage layer — `server/storage.ts`

**`getStaffAvailability`** (lines 1736–1740): Returns all rows for a staff member ordered by `dayOfWeek`. After the change, must also order by `rangeOrder`.

**`setStaffAvailability`** (lines 1742–1751): Delete-all-then-insert pattern. Works correctly for multi-range — just needs the caller to send multiple rows per day.

```typescript
async getStaffAvailability(staffMemberId: number): Promise<StaffAvailability[]> {
  return await db.select().from(staffAvailability)
    .where(eq(staffAvailability.staffMemberId, staffMemberId))
    .orderBy(asc(staffAvailability.dayOfWeek)); // also needs .orderBy(asc(rangeOrder))
}
```

### 3. API routes — `server/routes/staff.ts`

**`availabilityItemSchema`** (lines 11–16):

```typescript
const availabilityItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean(),
});
```

Must add `rangeOrder: z.number().int().min(0)` to accept multiple rows per day.

**GET `/api/staff/:id/availability`** (lines 207–214): No change needed — returns all rows.

**PUT `/api/staff/:id/availability`** (lines 217–228): Accepts `z.array(availabilityItemSchema)`. After schema change, array may contain multiple entries per dayOfWeek (one per range). The delete-then-insert logic in `setStaffAvailability` handles this correctly.

### 4. Slot generation — `server/lib/staff-availability.ts`

**`getStaffAvailableSlots`** (lines 101–142): The critical change point.

Current logic (lines 128–142):
```typescript
const availability = await storage.getStaffAvailability(staffMemberId);
const dayRecord = availability.find((a) => a.dayOfWeek === dayOfWeek);  // takes FIRST match only

if (!dayRecord || !dayRecord.isAvailable) return [];

const [startHr, startMn] = dayRecord.startTime.split(":").map(Number);
const [endHr, endMn] = dayRecord.endTime.split(":").map(Number);

return _generateSlots({
  date, durationMinutes, limits, options,
  dayStartMins: startHr * 60 + startMn,
  dayEndMins: endHr * 60 + endMn,
  staffMemberId,
});
```

After change: filter all records for the day (`.filter` instead of `.find`), then iterate each range calling `_generateSlots`, and union the results.

**`_generateSlots`** (lines 34–93): No internal changes required. It already handles one range correctly. The outer function will call it multiple times.

### 5. Frontend — `client/src/components/admin/StaffManageDialog.tsx`

**`AvailabilityTab`** (lines 324–424):

Current state type:
```typescript
interface AvailabilityRow {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}
const [rows, setRows] = useState<AvailabilityRow[]>(...)
```

The `useEffect` (lines 340–351) maps server data to one row per day using `.find()`. With multi-range, it must map to arrays per day.

The save mutation (lines 353–364) sends `rows` (flat array) to `PUT /api/staff/:id/availability`. This remains correct — the API accepts a flat array of items.

The render (lines 386–409) shows one `grid` row per day. This becomes: one section per day with its list of ranges, each having its own time inputs and a trash button, plus an add-range button.

---

## Standard Stack

### Core (no new dependencies needed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Drizzle ORM | existing | Schema + query builder | Already used |
| React Query | existing | Server state, invalidation | Already used |
| shadcn/ui (Button, Input, Label) | existing | UI primitives | Already used |
| Lucide React (Plus, Trash2) | existing | Icons | Trash2 already imported; Plus already in project |
| Zod | existing | API validation | Already used |

**No new npm packages required.**

---

## Architecture Patterns

### Migration Pattern (from Phase 22)
```sql
-- Non-destructive: add column with DEFAULT so existing rows remain valid
ALTER TABLE public.staff_availability
  ADD COLUMN IF NOT EXISTS range_order INTEGER NOT NULL DEFAULT 0;

-- Add index for ordered lookups (staff, day, range)
CREATE INDEX IF NOT EXISTS staff_availability_staff_day_order_idx
  ON public.staff_availability (staff_member_id, day_of_week, range_order);
```

**Why no UNIQUE constraint drop needed:** The original migration had no `UNIQUE (staff_member_id, day_of_week)` constraint in SQL — confirmed in `supabase/migrations/20260402000000_add_staff_tables.sql`. The single-row constraint was application-enforced only. After adding `range_order`, multiple rows per `(staff_member_id, day_of_week)` are valid immediately.

### Schema Change Pattern
In `shared/schema.ts`, add `rangeOrder` to the table definition:

```typescript
export const staffAvailability = pgTable("staff_availability", {
  id: serial("id").primaryKey(),
  staffMemberId: integer("staff_member_id").references(...).notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  rangeOrder: integer("range_order").notNull().default(0), // NEW
});
```

### Storage Pattern — Multi-range ordering
```typescript
async getStaffAvailability(staffMemberId: number): Promise<StaffAvailability[]> {
  return await db.select().from(staffAvailability)
    .where(eq(staffAvailability.staffMemberId, staffMemberId))
    .orderBy(asc(staffAvailability.dayOfWeek), asc(staffAvailability.rangeOrder)); // CHANGED
}
```

`setStaffAvailability` is unchanged in structure — delete-all + insert-new correctly handles variable number of rows.

### Slot Generation Pattern — Multiple ranges per day

```typescript
// In getStaffAvailableSlots, replace .find() with .filter():
const availability = await storage.getStaffAvailability(staffMemberId);
const dayRecords = availability.filter(
  (a) => a.dayOfWeek === dayOfWeek && a.isAvailable
);

if (dayRecords.length === 0) return [];

// Generate slots for each range, union results
const allSlots = new Set<string>();
for (const record of dayRecords) {
  const [startHr, startMn] = record.startTime.split(":").map(Number);
  const [endHr, endMn] = record.endTime.split(":").map(Number);
  const rangeSlots = await _generateSlots({
    date, durationMinutes, limits, options,
    dayStartMins: startHr * 60 + startMn,
    dayEndMins: endHr * 60 + endMn,
    staffMemberId,
  });
  for (const slot of rangeSlots) allSlots.add(slot);
}
return [...allSlots].sort();
```

Note: `_generateSlots` already fetches `existingBookings` and `busyTimes` on each call. With multiple ranges per day, this means N calls to the same DB query. To avoid N redundant fetches, extract booking fetch into `getStaffAvailableSlots` and pass pre-fetched data into `_generateSlots` via a new parameter. See Pitfalls section.

### Frontend State Pattern — Multi-range per day

New state structure:

```typescript
interface RangeEntry {
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
}

interface DayState {
  isAvailable: boolean;
  ranges: RangeEntry[];  // ordered by index = rangeOrder
}

// State: one DayState per day of week (index 0–6)
const [days, setDays] = useState<DayState[]>(...)
```

On save, flatten to the API's flat array format:
```typescript
const payload = days.flatMap((day, dayOfWeek) =>
  day.isAvailable
    ? day.ranges.map((r, rangeOrder) => ({
        dayOfWeek,
        isAvailable: true,
        startTime: r.startTime,
        endTime: r.endTime,
        rangeOrder,
      }))
    : [{ dayOfWeek, isAvailable: false, startTime: '09:00', endTime: '17:00', rangeOrder: 0 }]
);
```

The API and storage already accept any flat array — this works without further API changes.

### Anti-Patterns to Avoid
- **Sending only "changed" days:** The `setStaffAvailability` does a full delete+insert for the staff member. Always send all days.
- **Skipping unavailable days from payload:** The storage delete-insert replaces everything. Send all 7 days' data (with `isAvailable: false` for off days) to preserve a consistent record.
- **Storing gaps as explicit rows:** Gaps between ranges are NOT stored — they are the absence of rows. Only actual working windows are stored.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ordered range list in UI | Custom DnD from scratch | Simple index-based up/down buttons | REQUIREMENTS.md Future section explicitly defers drag-and-drop to after SLOTS-02 |
| Overlap validation | Complex interval tree | Sort + sequential pair check | Simple: after sorting by startTime, check `ranges[i].endTime <= ranges[i+1].startTime` |
| Time input | Custom time picker | `<Input type="time">` | Already used throughout the codebase; consistent with DateOverridesTab |

---

## Files to Touch (with location references)

### Plan 01 — Schema + Migration
| File | Change | Line Reference |
|------|--------|----------------|
| `supabase/migrations/YYYYMMDD_add_range_order_to_staff_availability.sql` | New file: `ALTER TABLE staff_availability ADD COLUMN IF NOT EXISTS range_order INTEGER NOT NULL DEFAULT 0` + index | New file |
| `shared/schema.ts` | Add `rangeOrder: integer("range_order").notNull().default(0)` to `staffAvailability` table | After line 929 (endTime field) |
| `shared/schema.ts` | Update `insertStaffAvailabilitySchema` — drizzle-zod auto-picks up new column | Lines 972–974 (auto) |

### Plan 02 — Backend: Storage + Route + Algorithm
| File | Change | Line Reference |
|------|--------|----------------|
| `server/storage.ts` | `getStaffAvailability`: add `asc(staffAvailability.rangeOrder)` to orderBy | Line 1739 |
| `server/routes/staff.ts` | `availabilityItemSchema`: add `rangeOrder: z.number().int().min(0).default(0)` | Lines 11–16 |
| `server/lib/staff-availability.ts` | `getStaffAvailableSlots`: replace `.find()` with `.filter()`, loop over ranges, union slots | Lines 128–142 |
| `server/lib/staff-availability.ts` | `_generateSlots`: refactor to accept pre-fetched bookings/busyTimes to avoid N DB calls per day | Lines 34–42 |

### Plan 03 — Frontend: AvailabilityTab
| File | Change | Line Reference |
|------|--------|----------------|
| `client/src/components/admin/StaffManageDialog.tsx` | Replace `AvailabilityRow[]` state with `DayState[]` (per-day ranges array) | Lines 324–424 |
| `client/src/components/admin/StaffManageDialog.tsx` | Add `rangeOrder` to payload before PUT request | Lines 353–364 |
| `client/src/components/admin/StaffManageDialog.tsx` | New render: per-day section with range list, add button, trash per range | Lines 380–424 |

---

## Common Pitfalls

### Pitfall 1: N Redundant DB Calls for Bookings/GCal per Range
**What goes wrong:** `_generateSlots` calls `storage.getBookingsByDateAndStaff` and `getStaffBusyTimes` internally. With 2 ranges, it runs these queries twice for the same date+staff.
**Why it happens:** `_generateSlots` was designed to be self-contained for one range.
**How to avoid:** Hoist the booking and busyTimes fetches into `getStaffAvailableSlots` (which already loops per range), pass pre-fetched arrays into `_generateSlots` via new parameters. Alternative: keep current structure and accept 2 identical DB queries (acceptable for typical 2-range case but not elegant).
**Warning signs:** Slow slot responses when a staff member has 3+ ranges.

### Pitfall 2: Overlapping Ranges Producing Duplicate Slots
**What goes wrong:** If ranges overlap (e.g., 8am–12pm and 10am–2pm), `_generateSlots` produces overlapping slot sets. The union de-duplicates times but the booking conflict check may miss that a slot overlaps both ranges.
**Why it happens:** Booking conflict check is per-range call.
**How to avoid:** Validate at save time (API layer) that ranges within a day do not overlap. Sort ranges by startTime, then assert `ranges[i].endTime <= ranges[i+1].startTime` for all consecutive pairs. Return 400 if invalid.
**Warning signs:** A slot at 10:30am appears even though there is a booking from 10am-11am in one of the ranges.

### Pitfall 3: isAvailable=false Rows with No Data Corruption
**What goes wrong:** When a day is toggled off (`isAvailable: false`) and back on, the ranges are reset to defaults instead of restoring the previously saved ranges.
**Why it happens:** The frontend clears the ranges array when `isAvailable` is toggled off.
**How to avoid:** When toggling off, keep the `ranges` in state but render them disabled/hidden. On save, send a single `isAvailable: false` row for that day (the delete+insert will clear old multi-range rows). On re-enable, start fresh with one default range.

### Pitfall 4: Migration Timestamp Collision
**What goes wrong:** Using a timestamp already used by another migration file.
**Why it happens:** Multiple migrations created on the same day.
**How to avoid:** Check `supabase/migrations/` directory before choosing timestamp. Latest existing is `20260510000003`. Use `20260511000000` for this phase.

### Pitfall 5: `getStaffAvailability` Called Inside Override Branch
**What goes wrong:** The override branch in `getStaffAvailableSlots` (lines 112–126) exits early with a single range if override has times set. This is correct — overrides remain single-range by design (the `staffAvailabilityOverrides` table has one row per date). No change needed here.
**Warning signs:** Assuming overrides need multi-range support — they don't for this phase.

### Pitfall 6: API Schema Missing `rangeOrder` Breaks Existing Clients
**What goes wrong:** If `rangeOrder` is added as required, any client that was already sending requests without it (e.g., tests or other code) breaks.
**How to avoid:** Add `rangeOrder` with `.default(0)` in the Zod schema so it is optional from the caller's perspective but always present after parsing.

---

## Code Examples

### Migration (Supabase CLI pattern — from Phase 22)
```sql
-- Phase 25: Multiple time slots per day (SEED-021)
-- Add range_order column to staff_availability to support multiple windows per day.
-- DEFAULT 0 means existing single-range rows remain valid without any data update.

ALTER TABLE public.staff_availability
  ADD COLUMN IF NOT EXISTS range_order INTEGER NOT NULL DEFAULT 0;

-- Composite index: staff + day + order for ordered range lookups
CREATE INDEX IF NOT EXISTS staff_availability_staff_day_order_idx
  ON public.staff_availability (staff_member_id, day_of_week, range_order);
```

### Storage orderBy (verified pattern from Phase 22 that uses `asc`)
```typescript
// server/storage.ts — getStaffAvailability
return await db.select().from(staffAvailability)
  .where(eq(staffAvailability.staffMemberId, staffMemberId))
  .orderBy(asc(staffAvailability.dayOfWeek), asc(staffAvailability.rangeOrder));
```

### Route schema (consistent with existing availabilityItemSchema pattern)
```typescript
const availabilityItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isAvailable: z.boolean(),
  rangeOrder: z.number().int().min(0).default(0), // NEW
});
```

### Slot generation — multi-range loop
```typescript
// server/lib/staff-availability.ts — getStaffAvailableSlots (weekly schedule path)
const dayRecords = availability
  .filter((a) => a.dayOfWeek === dayOfWeek && a.isAvailable)
  .sort((a, b) => a.rangeOrder - b.rangeOrder);

if (dayRecords.length === 0) return [];

// Pre-fetch to avoid N identical DB calls
const [existingBookings, busyTimes] = await Promise.all([
  storage.getBookingsByDateAndStaff(date, staffMemberId),
  getStaffBusyTimes(staffMemberId, date, options?.timeZone),
]);

const allSlots = new Set<string>();
for (const record of dayRecords) {
  const [startHr, startMn] = record.startTime.split(":").map(Number);
  const [endHr, endMn] = record.endTime.split(":").map(Number);
  const rangeSlots = await _generateSlots({
    date, durationMinutes, limits, options,
    dayStartMins: startHr * 60 + startMn,
    dayEndMins: endHr * 60 + endMn,
    staffMemberId,
    prefetchedBookings: existingBookings,
    prefetchedBusyTimes: busyTimes,
  });
  for (const slot of rangeSlots) allSlots.add(slot);
}
return [...allSlots].sort();
```

### Frontend — DayState initialization from server data
```typescript
// client/src/components/admin/StaffManageDialog.tsx
useEffect(() => {
  if (!availability) return;
  const next: DayState[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const dayRows = availability
      .filter((a) => a.dayOfWeek === dayOfWeek)
      .sort((a, b) => (a.rangeOrder ?? 0) - (b.rangeOrder ?? 0));
    if (dayRows.length === 0 || !dayRows[0].isAvailable) {
      return {
        isAvailable: dayRows[0]?.isAvailable ?? (dayOfWeek >= 1 && dayOfWeek <= 5),
        ranges: [{ startTime: '09:00', endTime: '17:00' }],
      };
    }
    return {
      isAvailable: true,
      ranges: dayRows.map((r) => ({ startTime: r.startTime, endTime: r.endTime })),
    };
  });
  setDays(next);
}, [availability]);
```

---

## Runtime State Inventory

No runtime state inventory required. This is not a rename/refactor/migration of stored string keys or service names. The schema change adds a new column with DEFAULT 0 — existing rows are not renamed or relocated.

**Stored data:** Existing `staff_availability` rows get `range_order = 0` via column DEFAULT — no data migration script required, no existing records need updating.
**Live service config:** None affected.
**OS-registered state:** None.
**Secrets/env vars:** None.
**Build artifacts:** None.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond the project's existing stack — Supabase CLI already used in prior phases, no new tools required).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no test config files in repo) |
| Config file | None |
| Quick run command | Manual browser check against dev server (`npm run dev`) |
| Full suite command | Manual UAT per HUMAN-UAT.md |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLOTS-01 | Admin saves two ranges for Monday; DB has two rows for staff+day=1 | manual-only | — (no test framework) | ❌ |
| SLOTS-02 | Add range button appends a row; trash button removes it; UI updates immediately | manual-only | — | ❌ |
| SLOTS-03 | Customer sees no slots between 12pm-2pm when ranges are 8am-12pm and 2pm-7pm | manual-only | — | ❌ |
| SLOTS-04 | After migration, existing staff with one range loads correctly; slots unchanged | manual-only | — | ❌ |

No automated test framework is present in this project. Validation is manual browser UAT.

### Wave 0 Gaps
None — no test infrastructure to scaffold.

---

## Open Questions

1. **Should `isAvailable=false` days send one row or zero rows to the API?**
   - What we know: `setStaffAvailability` does a full delete+insert; sending zero rows leaves no record for the day.
   - What's unclear: Whether "no record" (zero rows) vs "one row with isAvailable=false" has different downstream effects.
   - Recommendation: Keep existing convention — send one row per day with `isAvailable: false` for off days, to preserve the same behavior as before. The slot algorithm already handles `isAvailable=false` rows correctly.

2. **Should the date override (`staffAvailabilityOverrides`) also support multiple ranges?**
   - What we know: SLOTS-01 through SLOTS-04 only mention weekly availability. The override table is not in scope.
   - What's unclear: Whether a business that uses split days will also want split overrides.
   - Recommendation: Out of scope for Phase 25. Single-range overrides remain. Captured in REQUIREMENTS.md "Future" section if needed later.

---

## Sources

### Primary (HIGH confidence)
- Direct source code read: `shared/schema.ts` — staffAvailability table definition (lines 923–930), insertStaffAvailabilitySchema (lines 972–974), StaffAvailability type (line 990)
- Direct source code read: `server/storage.ts` — getStaffAvailability (lines 1736–1740), setStaffAvailability (lines 1742–1751)
- Direct source code read: `server/lib/staff-availability.ts` — `_generateSlots` (lines 34–93), `getStaffAvailableSlots` (lines 101–142)
- Direct source code read: `server/routes/staff.ts` — availabilityItemSchema (lines 11–16), PUT endpoint (lines 217–228)
- Direct source code read: `client/src/components/admin/StaffManageDialog.tsx` — AvailabilityTab (lines 324–424)
- Direct source code read: `supabase/migrations/20260402000000_add_staff_tables.sql` — confirms NO existing UNIQUE constraint on (staff_member_id, day_of_week)
- Direct source code read: `supabase/migrations/20260510000001_add_staff_availability_overrides.sql` — migration style/pattern reference
- `.planning/seeds/SEED-021-multiple-time-slots-per-day.md` — scope and breadcrumb analysis

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — confirmed no unique index was added in any subsequent phase for staff_availability

---

## Metadata

**Confidence breakdown:**
- Current schema and constraints: HIGH — read directly from SQL migration and schema.ts
- Algorithm change needed: HIGH — read directly from staff-availability.ts
- Frontend component structure: HIGH — read directly from StaffManageDialog.tsx
- Migration safety: HIGH — no UNIQUE constraint to drop (confirmed in original migration SQL)
- N+1 query issue: HIGH — _generateSlots fetches bookings/busyTimes internally, confirmed by reading code

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable codebase — no fast-moving external dependencies)
