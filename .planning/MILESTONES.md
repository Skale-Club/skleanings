# Milestones

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
