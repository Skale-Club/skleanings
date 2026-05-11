# Phase 26: Custom Booking Questions — Research

**Researched:** 2026-05-11
**Domain:** Full-stack feature: PostgreSQL schema, Express REST API, React form + admin UI
**Confidence:** HIGH — entire codebase read directly; no external library research needed

---

## Summary

Phase 26 adds a `serviceBookingQuestions` table (one-to-many off `services`) and a
`questionAnswers` JSONB column on `booking_items`. Admins attach typed questions
(text / textarea / select) to a service inside the existing ServiceForm collapsible
pattern. Customers see the questions in a new step or in the existing step 4
(Contact Details) of the BookingPage. Answers flow through `cartItems` on the
booking payload and are persisted alongside the booking item record.

The precedent set by `serviceDurations` (Phase 23) and the Booking Rules collapsible
(Phase 21 + 24) gives a direct blueprint: new child table, CRUD storage methods,
sub-routes on `/api/services/:id/questions`, and a collapsed UI section in
`ServiceForm.tsx`. The customer side mirrors how duration selection was grafted onto
`BookingPage.tsx` — a conditional block rendered before or inside an existing step.

**Primary recommendation:** Add a `questionAnswers` JSONB column to `booking_items`
(not a separate table). Answers are a per-item snapshot — they belong alongside the
other per-item snapshots already there (`selectedOptions`, `priceBreakdown`, etc.).
A separate answers table would require an extra JOIN on every booking detail view
for no structural benefit at this scale.

---

## Project Constraints (from CLAUDE.md)

- Migrations: Supabase CLI only. Never `drizzle-kit push`. Write raw SQL in
  `supabase/migrations/`.
- State management: React Query for server state; no Redux.
- UI: shadcn/ui + Tailwind. Brand yellow `#FFFF01` for CTAs, primary blue `#1C53A3`.
- Routing: Wouter (not React Router).
- Type safety: Shared schema in `shared/schema.ts` via Drizzle + `drizzle-zod`.
  `insertXSchema` for inserts, `typeof table.$inferSelect` for select types.
- Storage pattern: All DB access through `server/storage.ts` implementing `IStorage`.
  Routes call storage methods, never raw SQL.
- Auth: `requireAdmin` middleware guards all admin-only routes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUEST-01 | Admin adds question (text/textarea/select), marks required/optional, sets order | `serviceBookingQuestions` table + ServiceForm "Booking Questions" collapsible section, identical pattern to Durations |
| QUEST-02 | Admin deletes question; change applies only to future bookings | Hard-delete from `service_booking_questions`; past answers are in `booking_items.question_answers` JSONB snapshot and are unaffected |
| QUEST-03 | Customer sees service-specific questions in Customer Details step | Fetch questions via `GET /api/services/:id` (already fetched per-item in BookingPage); render dynamic fields in step 4 |
| QUEST-04 | Answers stored with booking record and visible to admin | `questionAnswers` JSONB column on `booking_items`; displayed in SharedBookingCard expanded view |
</phase_requirements>

---

## Current Schema — Relevant Tables

### `services` table (shared/schema.ts lines 55–80)

Standard service row. Has `requiresConfirmation` (Phase 24), `bufferTimeBefore/After`,
`minimumNoticeHours`, `timeSlotInterval` (Phase 21). No question-related columns.
Questions will live in a new child table, not columns here.

### `bookingItems` table (shared/schema.ts lines 415–430)

```typescript
export const bookingItems = pgTable("booking_items", {
  id:                serial("id").primaryKey(),
  bookingId:         integer("booking_id").references(() => bookings.id).notNull(),
  serviceId:         integer("service_id").references(() => services.id).notNull(),
  serviceName:       text("service_name").notNull(),       // snapshot
  price:             numeric("price", ...),
  quantity:          integer("quantity").default(1),
  pricingType:       text("pricing_type").default("fixed_item"),
  areaSize:          text("area_size"),
  areaValue:         numeric("area_value", ...),
  selectedOptions:   jsonb("selected_options").$type<BookingItemOption[]>(),
  selectedFrequency: jsonb("selected_frequency").$type<BookingItemFrequency>(),
  customerNotes:     text("customer_notes"),               // free-text for custom_quote
  priceBreakdown:    jsonb("price_breakdown").$type<PriceBreakdown>(),
});
```

**Key insight:** `customerNotes` is a plain text column used only for
`custom_quote` services ("describe your project"). It is NOT suitable for
structured question answers. A new `questionAnswers` JSONB column is required.

### `serviceDurations` table — blueprint precedent (lines 110–117)

```typescript
export const serviceDurations = pgTable("service_durations", {
  id:              serial("id").primaryKey(),
  serviceId:       integer("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
  label:           text("label").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  price:           numeric("price", ...),
  order:           integer("order").notNull().default(0),
});
```

This is the exact structural precedent for `serviceBookingQuestions`.

---

## Proposed New Table: `serviceBookingQuestions`

### SQL Migration

```sql
-- Phase 26: Custom booking questions per service (QUEST-01)
CREATE TABLE IF NOT EXISTS public.service_booking_questions (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL
                REFERENCES public.services(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'textarea' | 'select'
  options     JSONB,          -- only for type='select'; array of strings e.g. ["Cat","Dog","None"]
  required    BOOLEAN NOT NULL DEFAULT false,
  "order"     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS service_booking_questions_service_id_idx
  ON public.service_booking_questions (service_id);
```

File name: `supabase/migrations/20260511000001_add_service_booking_questions.sql`

### Drizzle Schema Addition (shared/schema.ts)

```typescript
// Service booking questions (Phase 26 QUEST-01)
export const serviceBookingQuestions = pgTable("service_booking_questions", {
  id:        serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
  label:     text("label").notNull(),
  type:      text("type").notNull().default("text"),  // 'text' | 'textarea' | 'select'
  options:   jsonb("options").$type<string[]>(),
  required:  boolean("required").notNull().default(false),
  order:     integer("order").notNull().default(0),
});

export const insertServiceBookingQuestionSchema = createInsertSchema(serviceBookingQuestions).omit({ id: true });
export type ServiceBookingQuestion = typeof serviceBookingQuestions.$inferSelect;
export type InsertServiceBookingQuestion = z.infer<typeof insertServiceBookingQuestionSchema>;
```

### `questionAnswers` Column on `bookingItems`

#### SQL

```sql
-- Phase 26: Store customer answers alongside booking item (QUEST-04)
ALTER TABLE public.booking_items
  ADD COLUMN IF NOT EXISTS question_answers JSONB;
```

File: `supabase/migrations/20260511000002_add_booking_item_question_answers.sql`

#### Drizzle (shared/schema.ts — add to bookingItems table)

```typescript
questionAnswers: jsonb("question_answers").$type<QuestionAnswer[]>(),
```

#### TypeScript interface

```typescript
// Snapshot of one customer answer at booking time (Phase 26)
export interface QuestionAnswer {
  questionId: number;
  label: string;      // snapshot of question label (survives question deletion)
  type: string;       // snapshot of type
  answer: string;     // always a string; select answers store the chosen option text
}
```

Storing `label` and `type` in the answer snapshot means admin can read past answers
even after the question is deleted — no orphan data problem.

---

## Architecture Patterns

### Pattern: Child Table + Sub-Routes (Service Durations Precedent)

Phase 23 established this pattern. Phase 26 follows it exactly:

| Layer | Durations (Phase 23) | Questions (Phase 26) |
|-------|---------------------|---------------------|
| Table | `service_durations` | `service_booking_questions` |
| IStorage methods | `getServiceDurations`, `createServiceDuration`, `updateServiceDuration`, `deleteServiceDuration` | `getServiceBookingQuestions`, `createServiceBookingQuestion`, `updateServiceBookingQuestion`, `deleteServiceBookingQuestion` |
| Routes | `/api/services/:id/durations` | `/api/services/:id/questions` |
| GET /api/services/:id | includes `durations` array | must also include `questions` array |
| Admin UI | "Available Durations" section in ServiceForm | "Booking Questions" collapsible section in ServiceForm |
| Customer UI | Duration selector in BookingPage step 3 | Dynamic questions in BookingPage step 4 |

### Pattern: Collapsible Admin Section

Booking Rules (Phase 21/24) uses `showBookingRules` + `setShowBookingRules` useState toggle
inside `ServiceForm.tsx`. Questions section follows this same approach:

```tsx
const [showBookingQuestions, setShowBookingQuestions] = useState(false);
// ...
<button type="button" onClick={() => setShowBookingQuestions(v => !v)}>
  Booking Questions {count > 0 && <span className="badge">{count}</span>}
</button>
{showBookingQuestions && (
  <div className="mt-3 space-y-4 p-4 border rounded-lg bg-muted/30">
    {/* question rows + Add Question button */}
  </div>
)}
```

However, unlike Booking Rules which only saves on main form submit, questions are
saved individually (same as durations: "Save" button per row). Questions require
the service to already exist (`service?.id` guard), same as the durations block.

### Pattern: Dynamic Questions in BookingPage

`serviceDetailsQueries` (BookingPage lines 122–134) already fetches `GET /api/services/:id`
for every cart item to get durations. Once questions are included in that response,
they are available without any new fetches.

Customer answers live in local state: `Record<number, Record<number, string>>`
(serviceId → questionId → answer string).

Validation: before advancing from step 4 to step 5, check that all `required` questions
for all cart items have non-empty answers. Block submission otherwise — mirror of
how `allDurationsSelected` gates the "Continue to Schedule" button.

Answers are appended to `cartItems` in the booking payload. The `cartItemSchema` in
`shared/schema.ts` must be extended to accept `questionAnswers`.

---

## Files That Need Changes

### Plan 01 — Schema + Migration

| File | Change |
|------|--------|
| `supabase/migrations/20260511000001_add_service_booking_questions.sql` | CREATE TABLE `service_booking_questions` |
| `supabase/migrations/20260511000002_add_booking_item_question_answers.sql` | ALTER TABLE `booking_items` ADD COLUMN `question_answers` JSONB |
| `shared/schema.ts` | Add `serviceBookingQuestions` table, `QuestionAnswer` interface, extend `bookingItems` with `questionAnswers`, add insert schema and types, add `questionAnswers` to `cartItemSchema` |

### Plan 02 — Backend (Storage + Routes)

| File | Change |
|------|--------|
| `server/storage.ts` | Add 4 `IStorage` interface methods + implementations for `serviceBookingQuestions`; extend `createBooking` to persist `questionAnswers` from `bookingItemsData` |
| `server/routes/catalog.ts` | Add `GET/POST/PATCH/DELETE /api/services/:id/questions` routes; extend `GET /api/services/:id` handler to include `questions` array alongside `durations` |
| `server/routes/bookings.ts` | In cartItem loop (lines 79–92): pass `questionAnswers` from `cartItem.questionAnswers` into `bookingItemsData` |

### Plan 03 — Frontend (Admin UI + Customer Flow)

| File | Change |
|------|--------|
| `client/src/components/admin/services/ServiceForm.tsx` | Add "Booking Questions" collapsible section after Booking Rules; per-question row with label/type/options/required/order; Save/Delete buttons per row (same pattern as Durations) |
| `client/src/pages/BookingPage.tsx` | Extend step 4 to render dynamic question fields; add `questionAnswers` state; validate required questions before advancing; include answers in `getCartItemsForBooking()` payload |
| `client/src/components/admin/shared/SharedBookingCard.tsx` | In the expanded booking items list (line 417–425), render `item.questionAnswers` if present, showing label + answer pairs |

---

## BookingPage.tsx — Current Step 4 Flow (Contact Details)

Steps: `2 | 3 | 4 | 5`

- Step 2: Staff selection (skipped for single-operator deployments)
- Step 3: Calendar + time slot + optional duration selector
- Step 4: Contact Details — name, email, phone, then "Continue to Address"
- Step 5: Address + payment method + submit

Step 4 (lines 581–656) renders inside `{step === 4 && ...}`. It validates
`customerName`, `customerEmail`, `customerPhone` before advancing with
`form.trigger(["customerName", "customerEmail", "customerPhone"])`.

**Where to inject questions:** At the bottom of the step 4 content div, after the
phone field and before the "Continue to Address" button. Questions are service-specific,
so render a section per service-in-cart that has questions. Guard the "Continue"
button with a required-answers check.

Questions data is available because `serviceDetailsQueries` already fetches each
service's full detail (line 122-134). After adding `questions` to the
`GET /api/services/:id` response, `q.data.questions` will be populated.

**Answer state pattern:**
```typescript
// In BookingPage component state
const [questionAnswers, setQuestionAnswers] =
  useState<Record<number, Record<number, string>>>({});
// key: serviceId → questionId → answer string

// Before advancing step 4 → 5
const allRequiredAnswered = serviceDetailsQueries.every(q => {
  if (!q.data?.questions) return true;
  return q.data.questions
    .filter((question: any) => question.required)
    .every((question: any) => (questionAnswers[q.data.id]?.[question.id] ?? '').trim() !== '');
});
```

**Answers into booking payload:** Extend `getCartItemsForBooking()` in CartContext
(or build the payload inline in `onSubmit`) to include `questionAnswers` per service.
The simpler approach is to assemble answers inline in `onSubmit` since `questionAnswers`
state is local to `BookingPage`.

---

## ServiceForm.tsx — Where to Add Questions Section

The "Available Durations" section starts at line 517 with `{service?.id && (`.
The Booking Questions section should be placed just before or just after it,
also gated on `service?.id` (questions can only exist once the service is saved).

Per-question row UI (modeled on durations grid):
- Label input (text)
- Type select: "Short Answer" (text) / "Long Answer" (textarea) / "Multiple Choice" (select)
- Options input: visible only when type = 'select'; comma-separated or tag-style input
- Required checkbox
- Order number
- Save / Delete buttons per row

Add Question button creates a new blank row (not persisted until Save is clicked).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONB type-safety for `options: string[]` and `QuestionAnswer[]` | Custom serializer | Drizzle `.$type<T>()` | Already used for `selectedOptions`, `priceBreakdown` — same pattern |
| Required field validation for dynamic fields | Custom validation logic | `react-hook-form` register + validate OR simple `useState` check with button guard | BookingPage step 3 already uses a button-guard pattern (`allDurationsSelected`); use same for answers |
| Question row UI | Custom drag-and-drop | Plain array + up/down buttons (or no reorder, just `order` integer editable) | Consistent with Phase 25 range_order decision — start simple |
| Select options input | Autocomplete widget | Simple comma-separated text input parsed on save | No shadcn combobox needed; select options are short strings |

---

## Common Pitfalls

### Pitfall 1: Answer snapshot must include question label

**What goes wrong:** Storing only `questionId` in `questionAnswers`. When admin
later deletes the question, the booking detail view has a `questionId` but no label
to display.

**How to avoid:** Always snapshot `{ questionId, label, type, answer }` at booking
time. The `QuestionAnswer` interface includes `label` and `type` for this reason.

### Pitfall 2: Questions included in GET /api/services/:id but not GET /api/services (list)

**What goes wrong:** The list endpoint returns all services without questions.
Admin list page works, but if any component uses the list response expecting questions,
it gets undefined.

**How to avoid:** Questions only belong on the single-service detail response
(`GET /api/services/:id`). BookingPage already fetches individual service details.
Do NOT add questions to the list response — it would add N queries to every page load.

### Pitfall 3: Validation error message is unclear for dynamic fields

**What goes wrong:** Using a single generic "Please fill in all required fields"
toast. Customer doesn't know which question is missing.

**How to avoid:** Show inline error per question field (same pattern as the
form field errors in step 4 — `{form.formState.errors.customerName && <p>...`).
Use local state `answersErrors: Record<number, string>` keyed by questionId.

### Pitfall 4: cartItemSchema not extended — question answers silently dropped

**What goes wrong:** `cartItemSchema` in `shared/schema.ts` is parsed by Zod in
`insertBookingSchemaBase`. If `questionAnswers` is not added to `cartItemSchema`,
Zod strips it and it never reaches the server.

**How to avoid:** In Plan 01, extend `cartItemSchema`:

```typescript
export const cartItemSchema = z.object({
  serviceId: z.number(),
  quantity: z.number().default(1),
  // ... existing fields ...
  questionAnswers: z.array(z.object({
    questionId: z.number(),
    label: z.string(),
    type: z.string(),
    answer: z.string(),
  })).optional(),
});
```

### Pitfall 5: Migration file naming collision

**What goes wrong:** Two migrations with the same timestamp prefix cause Supabase
CLI to reject the second or apply them in wrong order.

**How to avoid:** Use sequential suffixes. Last migration is `20260511000000_add_staff_availability_range_order.sql`. Use `20260511000001` and `20260511000002`.

### Pitfall 6: select type options stored as JSONB — null vs empty array

**What goes wrong:** A question of type 'text' or 'textarea' has `options: null`.
Frontend must guard against `question.options?.map(...)`.

**How to avoid:** Default `options` to `null` (not `[]`) in schema. Frontend
renders options input only when `question.type === 'select'`. Always optional-chain
when reading options.

---

## Code Examples

### Storage methods (following serviceDurations pattern)

```typescript
// IStorage interface additions
getServiceBookingQuestions(serviceId: number): Promise<ServiceBookingQuestion[]>;
createServiceBookingQuestion(q: InsertServiceBookingQuestion): Promise<ServiceBookingQuestion>;
updateServiceBookingQuestion(id: number, data: Partial<InsertServiceBookingQuestion>): Promise<ServiceBookingQuestion>;
deleteServiceBookingQuestion(id: number): Promise<void>;

// Implementation
async getServiceBookingQuestions(serviceId: number): Promise<ServiceBookingQuestion[]> {
  return db
    .select()
    .from(serviceBookingQuestions)
    .where(eq(serviceBookingQuestions.serviceId, serviceId))
    .orderBy(asc(serviceBookingQuestions.order));
}
```

### Extended GET /api/services/:id route

```typescript
router.get('/api/services/:id', async (req, res) => {
  try {
    const service = await storage.getService(Number(req.params.id));
    if (!service) return res.status(404).json({ message: "Service not found" });
    const [durations, questions] = await Promise.all([
      storage.getServiceDurations(Number(req.params.id)),
      storage.getServiceBookingQuestions(Number(req.params.id)),
    ]);
    res.json({ ...service, durations, questions });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});
```

### Booking creation — persisting answers (server/routes/bookings.ts)

```typescript
bookingItemsData.push({
  // ... existing fields ...
  customerNotes: cartItem.customerNotes,
  questionAnswers: cartItem.questionAnswers ?? [],  // NEW
  priceBreakdown: calculated.breakdown,
});
```

And in `storage.ts` `createBooking` transaction, add `questionAnswers` to the
`bookingItems` insert alongside `customerNotes`.

### Dynamic question rendering in BookingPage step 4

```tsx
{/* Dynamic service questions */}
{serviceDetailsQueries.map(q => {
  if (!q.data?.questions?.length) return null;
  return (
    <div key={q.data.id} className="space-y-4 pt-4 border-t border-gray-100">
      <p className="text-sm font-semibold text-slate-700">{q.data.name}</p>
      {q.data.questions.map((question: any) => (
        <div key={question.id} className="space-y-2">
          <label className="text-sm font-medium text-slate-700">
            {question.label}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {question.type === 'textarea' ? (
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-gray-200 ..."
              value={questionAnswers[q.data.id]?.[question.id] ?? ''}
              onChange={e => setQuestionAnswers(prev => ({
                ...prev,
                [q.data.id]: { ...prev[q.data.id], [question.id]: e.target.value }
              }))}
            />
          ) : question.type === 'select' ? (
            <select ...>
              {question.options?.map((opt: string) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input type="text" ... />
          )}
          {/* inline error if required and empty on submit attempt */}
        </div>
      ))}
    </div>
  );
})}
```

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. All changes are code + SQL migrations
within the existing stack (PostgreSQL via Supabase, Express, React).

---

## Validation Architecture

No automated test infrastructure detected in this project. Phase follows the same
manual UAT pattern used by previous phases.

### Phase Gate: Manual UAT Checklist

| ID | Scenario | Pass Condition |
|----|----------|---------------|
| QUEST-01-UAT | Admin opens service edit, opens "Booking Questions" section, adds a required "select" question with 3 options, saves | Question appears in list with type badge |
| QUEST-01-UAT-2 | Admin changes question order, saves | Order is reflected on next page load |
| QUEST-02-UAT | Admin deletes a question | Question disappears from service edit; existing booking detail still shows old answer |
| QUEST-03-UAT | Customer adds that service to cart, reaches step 4 | Question field is visible with label and asterisk for required |
| QUEST-03-UAT-2 | Customer tries to continue with required field empty | Button is disabled OR inline error appears; cannot proceed |
| QUEST-04-UAT | Customer completes booking with answers | Admin opens booking detail, expands services, sees question label + customer answer |

---

## Open Questions

1. **Step or same-step for questions?**
   - What we know: Current steps are 2 (staff) / 3 (calendar) / 4 (contact) / 5 (address+pay). Step 4 is "Contact Details" with 3 fields today.
   - What's unclear: Should questions be appended to step 4 or get their own step 4.5?
   - Recommendation: Append to step 4 below the phone field. Adding a new step number would require renumbering and more state management. Questions are "intake details" alongside contact details — same mental model. Only add a step if the question list is expected to be long (5+ questions), which is unlikely for v1.

2. **Multi-service cart with questions from multiple services**
   - What we know: A cart can have multiple services. Each may have different questions.
   - What's unclear: UX when service A has 3 questions and service B has 2 — how to group?
   - Recommendation: Group by service name (sub-heading per service). Already done for durations.

3. **Select options UX in admin**
   - What we know: Options are stored as `string[]` JSONB.
   - What's unclear: How does admin enter multiple options? Comma-separated? Tag input?
   - Recommendation: Simple comma-separated text input (`options.split(',').map(s => s.trim())`). Avoids a new UI component dependency.

---

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` — bookingItems table, serviceDurations table, cartItemSchema (lines 415–466)
- `server/storage.ts` — getService, getServiceDurations, createBooking transaction (lines 657–743)
- `server/routes/catalog.ts` — GET /api/services/:id, service durations sub-routes (lines 249–423)
- `client/src/pages/BookingPage.tsx` — all steps, serviceDetailsQueries, form submit (full file)
- `client/src/components/admin/services/ServiceForm.tsx` — Booking Rules collapsible, Durations section (lines 422–576)
- `client/src/components/admin/shared/SharedBookingCard.tsx` — booking items display (lines 410–430)
- `supabase/migrations/20260510000002_add_service_durations.sql` — migration file pattern

### Secondary (MEDIUM confidence)
- `.planning/seeds/SEED-027-custom-booking-questions-per-service.md` — original design intent, breadcrumbs

---

## Metadata

**Confidence breakdown:**
- Schema design: HIGH — directly modeled on `serviceDurations` with full file reads
- File change list: HIGH — every affected file read; changes are additive (no refactoring)
- Customer UI placement: HIGH — step 4 injection confirmed via full BookingPage read
- Pitfalls: HIGH — derived from actual code, not assumptions

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable stack; no external library churn)
