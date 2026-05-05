# Retrospective

Living retrospective across all milestones.

---

## Milestone: v1.0 — Marketing Attribution

**Shipped:** 2026-05-05 (built 2026-04-25 → 2026-04-28)
**Phases:** 5 (Phases 10–14) | **Plans:** 15

### What Was Built

- Two-table UTM attribution schema (visitor_sessions + conversion_events) with partial unique index for ATTR-03 idempotency
- Server-side traffic classifier mapping referrers + UTM params to human-readable channels
- Booking flow attribution end-to-end — visitorId survives direct checkout and Stripe redirect via localStorage UUID
- Dual first/last-touch write pattern: two rows per conversion_event, onConflictDoNothing for idempotency
- Marketing Dashboard: Overview KPIs, Sources table, Campaigns table, Conversions list, Visitor Journey slide-over
- GoHighLevel UTM field sync — fire-and-forget on booking completion
- Admin calendar create-booking-from-slot: pre-filled form, debounced customer type-ahead, computed end time

### What Worked

- **Fire-and-forget attribution pattern** — analytics writes never blocked the booking flow; this decision was made upfront and paid off throughout
- **Drizzle schema as source of truth** — collocating types with table definitions (contacts pattern) kept imports clean across 5 phases
- **Phase 10 first** — enforcing the schema phase before any downstream code prevented integration gaps
- **Empty-state-first discipline** — coding empty states before data paths meant the dashboard looked correct on day one

### What Was Inefficient

- **Supabase migration TTY issue** — migration files were written in Phase 10 and Phase 15 but could not be auto-applied; each needed a manual `supabase db push` step with a direct connection URL
- **ATTR-03 partial index workaround** — Drizzle 0.39.3 can't express partial unique indexes; hand-written SQL migration + placeholder in schema added friction

### Patterns Established

- Analytics routes always return 200 and never surface errors to clients
- `linkBookingToAttribution` silently no-ops when visitorId is absent — booking is never blocked
- Server is authoritative for traffic classification — client sends raw params only
- Double-row writes (first_touch + last_touch) on booking_completed with onConflictDoNothing

### Key Lessons

- Dual-row attribution model is elegant but requires the partial unique index to be correct — verify the WHERE clause in the SQL migration matches the application write pattern
- Phase 14 (admin calendar create booking) was added mid-milestone as a standalone feature; numbering it 14 rather than a decimal phase worked cleanly because it slotted after Phase 13 with no dependency conflicts

---

## Milestone: v2.0 — White Label

**Shipped:** 2026-05-05 (built 2026-04-28 → 2026-04-30)
**Phases:** 5 (Phases 15–19) | **Plans:** 15

### What Was Built

- 3 new white-label columns in companySettings (serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent)
- All "Skleanings" literals removed from frontend and server — ThemeContext, OpenRouter, localStorage key all read from DB
- SEO injector Express middleware: 14-token replacement, escapeJsonLd, shared buildLocalBusinessSchema, vercel.json catch-all
- Favicon: faviconUrl DB column, {{FAVICON_URL}} injector token, admin upload via authenticated request
- Legal pages: /privacy-policy and /terms-of-service served from DB with graceful empty states
- Admin Calendar: widened modal, multi-service useFieldArray, always-editable end time, conditional address field, brand yellow submit
- "By Staff" parallel-column calendar via RBC resources prop + DnDCalendar withDragAndDrop HOC
- Drag-to-reassign appointments between staff columns with 5-second undo toast
- QuickBookModal: two required fields (name + service), More options collapsible, < 30 second walk-in flow
- Per-staff availability badges on customer BookingPage step 3 via useQueries

### What Worked

- **Token replacement pattern** — the 14-token SEO injector is generic and extensible; adding new tokens in future requires only one entry in the tokenMap
- **replaceAll function replacer** — using `() => v` instead of a string value for replacement prevented $ special character corruption in JSON-LD; caught before it became a production bug
- **DnDCalendar at module scope** — placing the withDragAndDrop HOC outside any function definition prevented re-creation on re-render; the rule is now documented in STATE.md
- **resourceProps empty spread** — spreading `{}` for non-By-Staff views cleanly avoided contaminating Month/Week/Day views with resource props
- **Phase 18 before Phase 19** — calendar improvements were complete before the receptionist flow was built on top; the dependencies were respected

### What Was Inefficient

- **16-02-PLAN.md partial completion** — the ROADMAP marks 16-02 as incomplete (`[ ]`) while 16-01 and 16-03 are complete; the vercel.json routing task was likely done but not formally closed. Worth a cleanup pass before v3.

### Patterns Established

- SEO token map as a single-source replacement table — all server-side brand injection goes through one function
- `isGcalBusy` early-return guard in handleEventDrop + draggableAccessor returning false — two-layer DnD protection for external calendar events
- useQueries parallel per-staff availability with staffCount > 1 guard — single-staff sites skip all per-staff queries with zero code changes

### Key Lessons

- **White-label work is a multiplier** — removing hardcoded strings uncovered 8+ call sites across client/src, server, and test fixtures; a full-text search at the start of Phase 15 before planning saved rework
- **serviceDeliveryModel as plain TEXT** — choosing TEXT over pgEnum or CHECK constraint followed existing precedent and made the migration simpler; no regrets
- Receptionist UX requirements (QuickBook under 30s, drag-to-reassign) were concrete and testable; this made phase planning and verification straightforward

---

## Cross-Milestone Trends

| Metric | v1.0 | v2.0 |
|--------|------|------|
| Phases | 5 | 5 |
| Plans | 15 | 15 |
| Avg plans/phase | 3 | 3 |
| Calendar days | 4 (Apr 25–28) | 3 (Apr 28–30) |
| Feat commits | ~35 | ~34 |
| Migrations added | 1 (UTM tables) | 1 (white-label columns) |
| Migrations applied | pending | pending |

**Recurring theme:** Supabase migrations are consistently written but not applied during execution — requires a separate manual `supabase db push` step with the direct connection URL. This is a workflow constraint, not a code issue.
