# Phase 28: Recurring Bookings — Customer Flow & Notifications - Research

**Researched:** 2026-05-11
**Domain:** React booking flow + Express POST handler + email notifications via nodemailer/third-party
**Confidence:** HIGH (all findings sourced directly from codebase)

---

## Summary

Phase 28 adds two things to a mature, modular codebase: (1) a frequency selector step in BookingPage.tsx and (2) a 48-hour email reminder cron job. Phase 27 delivered the full database schema (`recurringBookings` table), all five storage methods, the daily generation cron, and the GitHub Actions workflow. Phase 28 does NOT need to touch the schema or the cron infrastructure — it builds on top of them.

The biggest architectural finding: **there is zero email infrastructure in this codebase.** All customer-facing notifications today are SMS (Twilio) and Telegram, both directed at the business owner, not the customer. SEED-019 documents this gap explicitly. Phase 28 must build the first transactional email capability from scratch — choosing a provider, adding config, and writing a template.

The second key finding: `serviceFrequencies` already models per-service frequencies with discount percentages and maps cleanly to the `recurringBookings.serviceFrequencyId` FK. The frequency selector is NOT a generic "one-time / weekly / biweekly / monthly" picker — it shows whatever frequencies the admin has configured for the booked service(s), plus a "One-time" default option. The UI must handle carts with multiple services and decide which service the subscription attaches to (typically the first / primary service).

**Primary recommendation:** Build a three-plan phase: (1) frequency selector UI + cartItemSchema extension + `serviceFrequencyId` threading through POST /api/bookings + `createRecurringBooking` call inside the existing booking transaction; (2) email provider setup (nodemailer + SMTP env vars or Resend) + reminder template; (3) 48h reminder cron function + new GitHub Actions workflow (or extend existing one).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECUR-01 | Customer can select a recurring frequency (weekly, biweekly, monthly) with discount preview when booking | `serviceFrequencies` table holds discounts; `selectedFrequencyId` already in `cartItemSchema`; frequency selector goes in step 3 before time slot CTA |
| RECUR-03 | Customer receives an automatic 48h reminder notification before each recurring cleaning | No email infra exists — must add provider + template + new cron endpoint; query is bookings WHERE recurringBookingId IS NOT NULL AND bookingDate = today + 2 days |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Stack: React 18, TypeScript, Vite, Wouter, React Query, shadcn/ui, Tailwind CSS (frontend); Express.js, TypeScript, Drizzle ORM, PostgreSQL (backend)
- DB migrations: always via Supabase CLI (`supabase migration new`), never `drizzle-kit push` (per MEMORY.md)
- Brand: Primary Blue `#1C53A3`, Brand Yellow `#FFFF01` for CTAs, pill-shaped buttons (`rounded-full`)
- Fonts: Outfit (headings), Inter (body)
- No Redux — React Query for server state, Context for cart/auth

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^3.6.0 | Date arithmetic for "today + 2 days" check | Already in package.json; used across the project |
| node-cron | ^4.2.1 | Local-dev scheduling for reminder cron | Already in package.json; already used in cron.ts |
| nodemailer | listed in build.mjs externals | SMTP email send | In build externals, implying available or planned |
| drizzle-orm | ^0.39.3 | DB queries for reminder lookup | Project ORM |

### Email Provider Options (Phase 28 must pick one)
| Option | Notes | Recommendation |
|--------|-------|----------------|
| nodemailer + SMTP | Zero new dependency; uses any SMTP (Gmail, Mailgun, etc.); `nodemailer` already appears in `script/build.mjs` externals | Recommended for v4.0 — minimal setup |
| Resend + @react-email/components | SEED-019 recommendation; DX is excellent; requires new package install and domain verification | Better long-term; consider for SEED-019 phase |

**Decision for phase 28:** Use nodemailer with configurable SMTP env vars (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`). This matches what the build scripts already expect as an external. No new package needed for MVP.

### Installation
```bash
# nodemailer is already in build externals — ensure it is in dependencies if not already:
npm install nodemailer @types/nodemailer
```

---

## Architecture Patterns

### BookingPage.tsx Step Structure (CRITICAL)

The current step machine is:

```
step 2 → Staff selection (skipped if staffCount <= 1)
step 3 → Duration selector (shown inline before calendar when services have durations)
step 3 → Calendar + time slot picker (shown when allDurationsSelected)
step 4 → Contact details + service-specific questions (Phase 26)
step 5 → Address + payment method + submit
```

**Where does the frequency selector go?**

It belongs at **step 3, after the time slot is selected but before the "Continue to Contact" button**. Specifically:
- Render the frequency selector in the **sidebar summary panel** below the time slot, OR as a new card inserted between the calendar card and the step 3 CTA button in the sidebar.
- The sidebar already has a "Continue to Contact" button gated on `selectedDate && selectedTime`. The frequency selector should appear there, between time slot confirmation and that button.
- Alternatively, a new card in the main column after the calendar card (step 3) that says "How often would you like this service?" — consistent with how duration selection appears before the calendar.

**Recommended placement:** A new collapsible section inside the sidebar booking summary, appearing after a time slot is selected, above the "Continue to Contact" CTA. This mirrors patterns seen in tools like Calendly. Keep it lightweight — a simple radio group: "One-time" (default) + one button per configured frequency showing the discount.

**Frequency data flow:**
1. Fetch frequencies for the primary cart item's serviceId: `GET /api/services/:id` already returns the service; frequencies need a `GET /api/services/:id/frequencies` endpoint (or can be included in service detail response if it includes them already).
2. Show "One-time (no discount)" + each `serviceFrequency` row as a radio option labeled `"Weekly — 15% off"`.
3. Store selection in local state: `selectedFrequencyId: number | null`.

### serviceFrequencies Table

```typescript
// From shared/schema.ts
export const serviceFrequencies = pgTable("service_frequencies", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").references(() => services.id).notNull(),
  name: text("name").notNull(), // e.g., "Weekly", "Every 15 days"
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).default("0"),
  order: integer("order").default(0),
});
```

Key observation: `serviceFrequencies` is **per-service**, not a global enum. The discount preview is `name (X% off)` derived from `discountPercent`. The `intervalDays` for the `recurringBookings` table must be derived from the frequency name or stored separately — **but Phase 27 already stores `intervalDays` as a snapshot on `recurringBookings`**. The question is how to derive `intervalDays` from a `serviceFrequency` row.

**Current gap:** `serviceFrequencies` does NOT have an `intervalDays` column — it only has `name` and `discountPercent`. The generator uses `recurringBookings.intervalDays` (7 / 14 / 30) to advance dates. Phase 28 must decide `intervalDays` at subscription creation time based on the frequency name or add an `intervalDays` column to `serviceFrequencies`.

**Recommendation:** Add `intervalDays` column to `serviceFrequencies` table via migration. Admin sets it when creating frequencies (e.g., "Weekly" → 7, "Biweekly" → 14, "Monthly" → 30). This makes the data self-contained and avoids fragile name-parsing. Requires one new Supabase migration.

### POST /api/bookings Changes

Current flow in `server/routes/bookings.ts`:
1. Zod-parse body with `insertBookingSchema`
2. Check availability
3. Calculate cart item prices via `calculateCartItemPrice`
4. Call `storage.createBooking(...)` (transaction: insert booking + booking items)
5. Upsert contact, link contactId
6. Attribution wiring
7. GHL sync
8. Twilio/Telegram notifications
9. Return booking

**Changes needed:**

1. **`cartItemSchema`** (in `shared/schema.ts`) already has `selectedFrequencyId?: number`. No schema change needed here.

2. **`insertBookingSchema`** (in `shared/schema.ts`) does NOT have a `serviceFrequencyId` field at the top level. The frequency is per cart item. The route must extract `serviceFrequencyId` from `cartItems[0].selectedFrequencyId` (primary service's frequency choice).

3. **After `storage.createBooking` succeeds**, if `cartItems[0].selectedFrequencyId` is set, call `storage.createRecurringBooking(...)` with:
   - `contactId`: from the upserted contact
   - `serviceId`: from `cartItems[0].serviceId`
   - `serviceFrequencyId`: `cartItems[0].selectedFrequencyId`
   - `discountPercent`: looked up from `serviceFrequencies` table
   - `intervalDays`: from `serviceFrequencies.intervalDays` (new column)
   - `frequencyName`: snapshot of `serviceFrequencies.name`
   - `startDate`: `validatedData.bookingDate`
   - `nextBookingDate`: `startDate + intervalDays` (first auto-generated booking date)
   - `preferredStartTime`: `validatedData.startTime`
   - `preferredStaffMemberId`: `validatedData.staffMemberId ?? null`
   - `originBookingId`: `booking.id`
   - `status`: `"active"`

4. **After creating the recurring subscription**, update `booking.recurringBookingId` via `storage.updateBooking(booking.id, { recurringBookingId: sub.id })` — or do it inside a transaction.

5. **Update `recurring-booking-generator.ts`** to populate real customer data from the contact record when generating subsequent bookings (currently inserts placeholder strings "Recurring Booking", "N/A"). Phase 27 left a TODO comment for Phase 28 to fix this.

### 48h Reminder Architecture

**Query:** Find all bookings where:
- `recurringBookingId IS NOT NULL` (it's a recurring booking)
- `bookingDate = today + 2 days` (YYYY-MM-DD)
- `status NOT IN ('cancelled')` (don't remind for cancelled bookings)
- `customerEmail IS NOT NULL` (customer has an email address)
- Subscription status is still `active` (JOIN to recurringBookings)

**Double-send guard:** The reminder cron runs daily. A booking's `bookingDate` is a fixed date. If the cron runs once per day and checks `bookingDate = today + 2`, it will only ever fire once per booking. No extra "sent" flag needed on the booking row — the date equation is the natural idempotency key. However, if the cron could retry on the same day, add a `reminderSentAt` timestamp column to `bookings` table as a guard.

**Recommendation:** Start without `reminderSentAt` — the daily cron + date equality is sufficient. Document this assumption clearly. If production shows duplicate sends (e.g., two cron runs on the same day), add the column in Phase 29.

**Cron trigger options:**
- Extend `recurring-bookings-cron.yml` to also call the reminder endpoint in the same daily run
- Or add a separate `reminder-cron.yml` workflow

**Recommended:** Extend the existing workflow to call both endpoints sequentially. Keeps ops surface minimal.

**Endpoint:** `POST /api/recurring-bookings/cron/send-reminders` (same Bearer auth pattern as generate endpoint).

**Implementation file:** `server/services/recurring-booking-reminder.ts` (new file, parallel to `recurring-booking-generator.ts`).

### Email Infrastructure

**Current state:** Zero transactional email. `notificationLogs` supports `channel: 'email'` but nothing uses it. The SEED-019 seed documents this gap and recommends Resend. `nodemailer` appears in `script/build.mjs` externals (line 25), suggesting it was anticipated.

**Required env vars (new):**
```
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=no-reply@example.com
EMAIL_PASS=secretpassword
EMAIL_FROM="Skleanings <no-reply@skleanings.com>"
```

**Email template for 48h reminder** (plain text first, HTML optional):
```
Subject: Reminder: Your cleaning is tomorrow — [Service Name]

Hi [Customer Name],

Just a reminder that your [frequency] cleaning is scheduled for:

  Date: [Month Day, Year]
  Time: [12h formatted time]
  Service: [Service Name]

If you need to reschedule or have questions, reply to this email or call us.

See you soon!
[Company Name]
```

**New file:** `server/lib/email.ts` — exports `sendEmail(to, subject, text, html?)` using nodemailer transporter created from env vars.

**New file:** `server/lib/email-templates.ts` — exports `buildReminderEmail(booking, serviceName, companyName): { subject, text, html }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic for "48h from now" | Custom offset logic | `date-fns` addDays / format | Already in project; handles DST edge cases |
| SMTP transport | Raw net/tcp | nodemailer createTransport | Battle-tested; handles TLS, auth, retries |
| Idempotent cron guard | Custom locking table | Date equality as natural key | `bookingDate = today+2` fires exactly once per booking in a daily cron |
| Frequency-to-intervalDays mapping | Name parsing ("Weekly" → 7) | `serviceFrequencies.intervalDays` column | Fragile parsing breaks on any name change |

---

## Exact Files to Change

### New Files
| File | Purpose |
|------|---------|
| `server/lib/email.ts` | Nodemailer transporter factory + `sendEmail()` util |
| `server/lib/email-templates.ts` | `buildReminderEmail()` function returning subject + text + html |
| `server/services/recurring-booking-reminder.ts` | `runRecurringBookingReminders(asOfDateOverride?)` — finds due bookings and sends emails |

### Modified Files
| File | Change |
|------|--------|
| `shared/schema.ts` | Add `intervalDays` column to `serviceFrequencies` table; add `insertServiceFrequencySchema` update |
| `server/routes/bookings.ts` | After `storage.createBooking` succeeds, if `cartItems[0].selectedFrequencyId` is set, call `storage.createRecurringBooking(...)` and link originBookingId |
| `server/routes/recurring-bookings.ts` | Add `POST /cron/send-reminders` endpoint (same Bearer auth) |
| `server/services/recurring-booking-generator.ts` | Fix placeholder customer data — populate `customerName`, `customerEmail`, `customerPhone`, `customerAddress` from the contact record (contactId is already on the subscription) |
| `server/storage.ts` (IStorage interface) | Add `getServiceFrequency(id: number): Promise<ServiceFrequency | undefined>` for frequency lookup at booking time |
| `server/storage/catalog.ts` | Implement `getServiceFrequency(id)` |
| `.github/workflows/recurring-bookings-cron.yml` | Add second curl step to call `/api/recurring-bookings/cron/send-reminders` after the generation step |
| `client/src/pages/BookingPage.tsx` | Add frequency selector UI in step 3 (sidebar, after time slot selected); add `selectedFrequencyId` state; pass to booking payload |
| `client/src/context/CartContext.tsx` | Possibly store `selectedFrequencyId` in cart or pass directly through BookingPage state — investigate which approach fits the existing cart shape |
| `supabase/migrations/` | New migration file: add `interval_days integer` column to `service_frequencies` table |

### Possible File (verify existence)
| File | Change |
|------|--------|
| `client/src/hooks/use-booking.ts` | Confirm `useCreateBooking` passes full payload — may need to accept `selectedFrequencyId` in payload if not already |

---

## Common Pitfalls

### Pitfall 1: Double Reminder on Cron Retry
**What goes wrong:** GitHub Actions retries the job on failure. The same cron run fires twice. Two reminder emails sent to the same customer.
**Why it happens:** Date-equality query has no "sent" marker on the booking row.
**How to avoid:** Accept this risk for v4.0 (retries are rare). Document it. If it surfaces, add `reminderSentAt timestamp` to `bookings` and guard: `WHERE reminderSentAt IS NULL`.
**Warning signs:** Customer reports duplicate emails.

### Pitfall 2: Reminder Sent for Cancelled Subscription
**What goes wrong:** Customer cancels their subscription. Cron sends a reminder for the already-generated upcoming booking because that booking's `status` is still `pending`.
**Why it happens:** Cancelling the subscription doesn't automatically cancel already-generated bookings.
**How to avoid:** The reminder query must JOIN `recurring_bookings` and filter `recurring_bookings.status = 'active'`. This way, a cancelled subscription stops reminders even for pre-generated bookings.
**Warning signs:** Cancelled customers receiving reminder emails.

### Pitfall 3: Frequency Selector Applied to Wrong Service
**What goes wrong:** Cart has two services. Frequency is tied to `cartItems[0]` (primary service). The subscription only covers that one service's price, but customer expects all services to recur.
**Why it happens:** `recurringBookings` is one-row-per-service. Multi-service carts are an edge case.
**How to avoid:** For Phase 28, only show the frequency selector when the cart has exactly one service, or tie the subscription to the first/primary service and note the limitation. Document clearly.
**Warning signs:** Customer expects biweekly cleaning but only one of their two cart services shows up on repeat.

### Pitfall 4: intervalDays Missing from serviceFrequencies
**What goes wrong:** Admin creates a "Weekly" frequency but `intervalDays` column doesn't exist yet. Migration not applied. `createRecurringBooking` receives `undefined` for `intervalDays` and inserts 0 or throws.
**Why it happens:** Migration applied on dev but not production (or forgotten).
**How to avoid:** Add NOT NULL DEFAULT 7 to the column (so existing rows get a sensible default). Validate in the route before calling `createRecurringBooking`: if `frequency.intervalDays` is falsy, return 400.
**Warning signs:** Server error on recurring booking creation.

### Pitfall 5: Discount Applied Twice
**What goes wrong:** `calculateCartItemPrice` already applies the frequency discount via `selectedFrequencyId` in the cart item. The `bookingItem.price` is already the discounted price. If Phase 28 also applies the discount when generating future bookings in the generator, the customer gets a double discount.
**Why it happens:** Pricing logic exists in two places — `calculateCartItemPrice` and `recurring-booking-generator.ts`.
**How to avoid:** The generator already reads `discountPercent` from the subscription snapshot and applies it to `service.price`. As long as the initial booking's `totalPrice` also reflects the discount (which it does via `calculateCartItemPrice`), there is no double-dip. Verify the first booking's price matches the subscription's discounted price.
**Warning signs:** First booking price ≠ subsequent booking prices for the same subscription.

### Pitfall 6: Email Transport Not Configured in Production
**What goes wrong:** Env vars `EMAIL_HOST` etc. missing in Vercel/production. `nodemailer.createTransport` creates a transport that silently fails or throws uncaught.
**Why it happens:** Dev has vars set locally; production deployment forgets them.
**How to avoid:** Check for env vars at startup and log a warning (not an error — email is non-critical). In the reminder service, if transporter is not configured, log and skip rather than throwing.
**Warning signs:** Reminder cron returns success with 0 emails sent; no errors.

### Pitfall 7: Recurring Booking Generator Uses Placeholder Customer Data
**What goes wrong:** Phase 27 left `customerName: "Recurring Booking"`, `customerPhone: "N/A"`, `customerAddress: "N/A"` as placeholder values (with a TODO comment for Phase 28). Generated bookings appear in the admin calendar with garbage data.
**Why it happens:** Phase 27 deferred this to Phase 28 explicitly.
**How to avoid:** In `recurring-booking-generator.ts`, after fetching the service, also fetch the contact (`storage.getContact(sub.contactId)`) and use real name/phone/email/address for the inserted booking row.
**Warning signs:** Admin sees bookings with "Recurring Booking" as the customer name.

---

## Code Examples

### Frequency Selector State (BookingPage.tsx addition)
```typescript
// New state — null means "one-time"
const [selectedFrequencyId, setSelectedFrequencyId] = useState<number | null>(null);

// Fetch frequencies for primary cart item
const primaryServiceId = items[0]?.id;
const { data: frequencies } = useQuery<ServiceFrequency[]>({
  queryKey: ['/api/services', primaryServiceId, 'frequencies'],
  queryFn: () => fetch(`/api/services/${primaryServiceId}/frequencies`).then(r => r.json()),
  enabled: !!primaryServiceId,
});
```

### Frequency Selector UI (inside step 3 sidebar CTA area)
```tsx
{frequencies && frequencies.length > 0 && selectedDate && selectedTime && (
  <div className="mt-4 pt-4 border-t border-gray-100">
    <p className="text-sm font-semibold text-slate-700 mb-3">How often?</p>
    <div className="space-y-2">
      <button
        onClick={() => setSelectedFrequencyId(null)}
        className={clsx(
          "w-full px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
          selectedFrequencyId === null
            ? "border-primary bg-primary/5 font-semibold"
            : "border-slate-200 hover:border-slate-300"
        )}
      >
        One-time cleaning
      </button>
      {frequencies.map(f => (
        <button
          key={f.id}
          onClick={() => setSelectedFrequencyId(f.id)}
          className={clsx(
            "w-full px-4 py-3 rounded-xl border-2 text-left text-sm transition-all",
            selectedFrequencyId === f.id
              ? "border-primary bg-primary/5 font-semibold"
              : "border-slate-200 hover:border-slate-300"
          )}
        >
          <span>{f.name}</span>
          {Number(f.discountPercent) > 0 && (
            <span className="ml-2 text-green-600 font-bold">
              {Number(f.discountPercent)}% off
            </span>
          )}
        </button>
      ))}
    </div>
  </div>
)}
```

### Booking payload extension (BookingPage.tsx onSubmit)
```typescript
const bookingPayload = {
  ...data,
  // ... existing fields ...
  selectedFrequencyId: selectedFrequencyId ?? undefined,
};
```

### POST /api/bookings addition (after createBooking, before notifications)
```typescript
// Create recurring subscription if a frequency was selected
const rawFrequencyId = req.body.selectedFrequencyId as number | undefined;
if (rawFrequencyId) {
  try {
    const frequency = await storage.getServiceFrequency(rawFrequencyId);
    if (frequency && frequency.intervalDays) {
      const contact = await storage.getContact(booking.contactId!);
      const sub = await storage.createRecurringBooking({
        contactId: booking.contactId ?? null,
        serviceId: frequency.serviceId,
        serviceFrequencyId: frequency.id,
        discountPercent: frequency.discountPercent ?? "0",
        intervalDays: frequency.intervalDays,
        frequencyName: frequency.name,
        startDate: validatedData.bookingDate,
        nextBookingDate: advanceDate(validatedData.bookingDate, frequency.intervalDays),
        preferredStartTime: validatedData.startTime,
        preferredStaffMemberId: validatedData.staffMemberId ?? null,
        originBookingId: booking.id,
        status: "active",
      });
      // Link the booking back to the subscription
      await storage.updateBooking(booking.id, { recurringBookingId: sub.id } as any);
    }
  } catch (recurringErr) {
    console.error("Recurring booking creation error:", recurringErr);
    // Non-fatal: booking succeeds even if subscription creation fails
  }
}
```

### Reminder Query (server/services/recurring-booking-reminder.ts)
```typescript
import { db } from "../db";
import { bookings, recurringBookings, contacts } from "@shared/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { addDays, format } from "date-fns";

export async function runRecurringBookingReminders(asOfDateOverride?: string): Promise<ReminderResult> {
  const today = asOfDateOverride ?? new Date().toISOString().slice(0, 10);
  const reminderDate = format(addDays(new Date(today + "T00:00:00Z"), 2), "yyyy-MM-dd");

  // Find bookings where bookingDate = reminderDate, recurringBookingId set, subscription active
  const dueBookings = await db
    .select({ booking: bookings, sub: recurringBookings })
    .from(bookings)
    .innerJoin(recurringBookings, eq(bookings.recurringBookingId, recurringBookings.id))
    .where(
      and(
        eq(bookings.bookingDate, reminderDate),
        isNotNull(bookings.recurringBookingId),
        ne(bookings.status, "cancelled"),
        eq(recurringBookings.status, "active"),
        isNotNull(bookings.customerEmail),
      )
    );

  // For each due booking, send reminder email
  // ...
}
```

### nodemailer transporter (server/lib/email.ts)
```typescript
import nodemailer from "nodemailer";

function createTransporter() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? "587");
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Email] Transport not configured — skipping email to", to);
    return;
  }
  const from = process.env.EMAIL_FROM ?? process.env.EMAIL_USER;
  await transporter.sendMail({ from, to, subject, text, html });
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| SMS-only notifications (Twilio/Telegram) | Phase 28 adds email | Email is customer-facing; SMS was staff-facing |
| Placeholder customer data in generated bookings | Phase 28 fixes from contact record | Phase 27 TODO |
| No subscription at booking time | Phase 28 creates subscription post-checkout | Requires frequency selection in UI first |

---

## Open Questions

1. **Single-service constraint for frequency selector**
   - What we know: `recurringBookings` is per-service (one subscription per service per schedule)
   - What's unclear: What happens for multi-service carts? Should the frequency selector only show for single-service carts, or apply to the primary (first) service only?
   - Recommendation: For Phase 28, show the selector only when `items.length === 1`, or show it but explain "applies to [primary service name]" when there are multiple items.

2. **intervalDays column on serviceFrequencies — migration timing**
   - What we know: The column doesn't exist yet; the generator needs it
   - What's unclear: Are there existing frequency rows in production that need a backfill?
   - Recommendation: `intervalDays integer NOT NULL DEFAULT 7` — existing rows get 7 (weekly) as default, which is a sensible fallback. Admin should review after migration.

3. **Email delivery for reminder: what if customerEmail is null?**
   - What we know: `customerEmail` is nullable in both `bookings` and `contacts`
   - What's unclear: What's the skip policy — silent skip or log?
   - Recommendation: Log a warning with bookingId and subscription ID; skip silently. No retry.

4. **advanceDate helper — where to define it for shared use**
   - What we know: `advanceDate` is currently a private function inside `recurring-booking-generator.ts`
   - What's unclear: The booking creation route also needs to compute `nextBookingDate`
   - Recommendation: Move `advanceDate` to a shared `server/lib/date-utils.ts` module and import from both files.

---

## Environment Availability

Step 2.6: All dependencies verified in `package.json`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| nodemailer | Email sending | Listed in build externals | npm install needed | — |
| node-cron | Local-dev reminder cron | YES | ^4.2.1 | GitHub Actions for prod |
| date-fns | Date arithmetic | YES | ^3.6.0 | — |
| drizzle-orm | DB queries | YES | ^0.39.3 | — |
| GitHub Actions | Production cron | YES (recurring-bookings-cron.yml exists) | — | — |
| SMTP credentials | Email delivery | NOT YET — env vars must be added | — | Skip email gracefully |

**Missing dependencies with no fallback:**
- SMTP credentials (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`) — must be added to Vercel env vars and `.env` for local dev. Without them, reminders silently skip.

**Missing dependencies with fallback:**
- None.

---

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` — full table definitions for `recurringBookings`, `serviceFrequencies`, `bookings`, `bookingItems`, `cartItemSchema`
- `client/src/pages/BookingPage.tsx` — complete step machine, state, payload construction
- `server/routes/bookings.ts` — full POST /api/bookings handler
- `server/services/recurring-booking-generator.ts` — `advanceDate`, `runRecurringBookingGeneration`, placeholder data TODOs
- `server/services/cron.ts` — daily cron schedule at 06:00 UTC
- `server/storage.ts` — `IStorage` interface, all five Phase 27 recurring booking methods
- `server/lib/pricing.ts` — `calculateCartItemPrice` and how `selectedFrequencyId` applies discounts
- `server/lib/notification-templates.ts` — notification pattern (for email template design)
- `server/integrations/twilio.ts` — notification send pattern (for email sender design)
- `.github/workflows/recurring-bookings-cron.yml` — cron workflow to extend
- `.planning/seeds/SEED-019-branded-email-notifications.md` — authoritative statement that no email infra exists
- `package.json` — confirms nodemailer is in build externals; no resend/sendgrid installed

### Secondary (MEDIUM confidence)
- `script/build.mjs` externals list — nodemailer listed; implies it was anticipated as a dependency

---

## Metadata

**Confidence breakdown:**
- Booking flow step structure: HIGH — read full BookingPage.tsx
- serviceFrequencies schema: HIGH — read shared/schema.ts directly
- Email infrastructure gap: HIGH — SEED-019 documents it; grep confirms no email packages installed
- intervalDays gap in serviceFrequencies: HIGH — schema confirms column absent
- 48h reminder query design: HIGH — schema and generator code fully read
- Double-reminder guard: MEDIUM — standard pattern; no specific code reference for this codebase

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable domain; schema is versioned)
