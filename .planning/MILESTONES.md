# Milestones

## v6.0 Platform Quality (Shipped: 2026-05-13)

**Phases completed:** 3 phases, 7 plans, 2 tasks

**Key accomplishments:**

- express-rate-limit corrected on 3 public endpoints (analytics/session, analytics/events, chat/message) — max values fixed (10/10/20) and standardHeaders enabled for Retry-After on 429
- BookingPage.tsx (948→~120 lines) and AppointmentsCalendarSection.tsx (~49KB→thin shell) split into focused sub-components: StepStaffSelector, StepTimeSlot, StepCustomerDetails, StepPaymentMethod, BookingSummary, CreateBookingModal, useDragToReschedule
- blog-autopost.yml (hourly) replaced by blog-cron.yml (daily 09:00 UTC) with BLOG_CRON_TOKEN bearer auth; systemHeartbeats table removed from schema and Supabase migration queued

---

## v5.0 Booking Experience (Shipped: 2026-05-13)

**Phases completed:** 3 phases, 9 plans, 6 tasks

**Key accomplishments:**

- Multiple durations per service — selectedDurationId flows CartContext → Zod → booking route → durationLabel/durationMinutes snapshot in bookingItems; recurring generator uses snapshot with catalog fallback
- emailSettings singleton table + Resend SDK + sendResendEmail() module with enabled flag check and notificationLogs logging
- Three branded HTML email templates (confirmation, 24h reminder, cancellation) + fire-and-forget triggers on booking create/cancel/reject routes
- 24h email reminder cron service (run24hEmailReminders) + admin EmailTab UI + GH Actions daily workflow
- calendarSyncQueue table with atomic FOR UPDATE SKIP LOCKED dequeue, 6-attempt exponential backoff [1,5,30,120,720,1440 min], stale-row reaper
- Admin CalendarSyncTab with per-target health cards, failure table, retry-per-job button, and 10+ failure reconnect banner; GH Actions calendar-sync cron every 5min

---

## v4.0 Booking Intelligence (Shipped: 2026-05-11)

**Phases completed:** 5 phases, 15 plans, 23 tasks

**Key accomplishments:**

- range_order INTEGER column added to staff_availability via idempotent migration + Drizzle schema updated so StaffAvailability type includes rangeOrder: number
- Storage, route schema, and slot-generation algorithm updated to support multiple ordered time-range rows per (staffMemberId, dayOfWeek) with N+1-free DB access
- AvailabilityTab replaced with a per-day card editor where admins can add multiple time windows, remove individual ranges, and save rangeOrder-indexed payloads to the backend
- Admin ServiceForm "Booking Questions" collapsible with full CRUD; BookingPage step 4 dynamic question fields with required validation; SharedBookingCard question answer display
- Nodemailer SMTP transporter with graceful no-op + typed reminder email template (subject/text/HTML) using brand colors and 12h time formatting

---

## v3.0 Calendar Polish (Shipped: 2026-05-11)

**Phases completed:** 1 phases, 4 plans, 6 tasks

**Key accomplishments:**

- 20-HUMAN-UAT.md (4 UAT entries) and 20-DIAGNOSIS.md skeleton (3 nine-row tables + DevTools snippet) created; Task 3 baseline measurement awaiting human browser session

---

## v2.0 White Label (Shipped: 2026-05-05)

**Phases completed:** 5 phases, 15 plans, 19 tasks

**Key accomplishments:**

- Schema Foundation & Detokenization — 3 new white-label columns in companySettings, all hardcoded "Skleanings" literals removed from frontend/server, ThemeContext + OpenRouter read brand identity from DB at runtime
- SEO Meta Injection — Express middleware injects tenant-specific title, canonical, OG, Twitter Card, and LocalBusiness JSON-LD into every HTML response; vercel.json routes all HTML through Express; index.html fully retemplated with {{TOKEN}} markers
- Favicon, Legal & Company Type Admin UI — faviconUrl upload + {{FAVICON_URL}} injector token, service delivery model selector, Privacy Policy and Terms of Service DB-driven with graceful empty states at /privacy-policy and /terms-of-service
- Admin Calendar Improvements — widened Create Booking modal, multi-service useFieldArray rows, always-editable end time, conditional address field gated by serviceDeliveryModel, brand yellow submit button
- Receptionist Booking Flow & Multi-Staff View — "By Staff" parallel-column calendar via RBC resources prop, DnDCalendar drag-to-reassign between staff with undo toast, QuickBookModal for walk-in booking in under 30 seconds, 30s polling, per-staff availability badges on customer booking step 3

---

## v1.0 Marketing Attribution (Shipped: 2026-05-05)

**Phases completed:** 5 phases, 15 plans, 19 tasks

**Key accomplishments:**

- UTM session capture (all 6 params + referrer + landing page), server-side traffic classification, first/last-touch attribution model with first-touch immutability enforced at storage layer
- Booking flow attribution wired end-to-end — visitorId survives direct and Stripe redirect paths; booking_started and chat_initiated events recorded fire-and-forget
- Marketing Dashboard UI — Overview KPIs, Sources and Campaigns performance tables, Conversions tab, Visitor Journey slide-over, date range filter with 7 presets, polished empty states
- GoHighLevel CRM UTM sync — first-touch and last-touch source/campaign written to GHL contact custom fields fire-and-forget on booking completion
- Admin calendar create-booking-from-slot — pre-filled form with customer type-ahead, computed end time + estimated price, full submit mutation with status confirmation and calendar refresh

---
