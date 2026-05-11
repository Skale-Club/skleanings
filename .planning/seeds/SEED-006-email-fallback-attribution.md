---
id: SEED-006
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Marginal attribution gain
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: when the marketing dashboard starts showing attribution gaps, or when optimizing campaign ROAS
scope: Small
---

# SEED-006: Email-based attribution fallback when localStorage is cleared

## Why This Matters

The attribution system uses a UUID in `localStorage` (`skleanings_visitor_id_${companySlug}`) to connect visits across days with the final booking. If the user clears localStorage, switches devices, or uses private mode to complete the booking, attribution is lost — the booking appears as "direct" even though it came from a paid campaign.

The decision in STATE.md documents: "localStorage UUID — must survive multi-day booking journeys" but has no fallback.

**Why:** Google Ads and Meta Ads campaigns have 3-7 day journeys. Users who research on mobile and close on desktop lose all attribution. This underestimates upper-funnel campaign ROAS.

## When to Surface

**Trigger:** when starting to optimize paid campaigns based on marketing dashboard data, or when the attribution report shows >30% of conversions without source.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Marketing / attribution improvement milestone
- Post-White Label v2.0 milestone focused on analytics
- Ads platform integration milestone (Meta CAPI, Google Enhanced Conversions)

## Scope Estimate

**Small** — A few hours. Logic: after booking created with customer email, look up in `bookings` and `visitorSessions` by email to recover `utmSessionId` from a previous session. Apply post-hoc if the current booking has no `utmSessionId`.

## Breadcrumbs

- `server/routes.ts` — `POST /api/bookings`, where `linkBookingToAttribution` is called
- `server/storage.ts` — `getVisitorSessionByEmail()` would be a new query
- `shared/schema.ts` — `visitorSessions` table (has `convertedAt`, no email field)
- `shared/schema.ts` — `bookings` table (has `customerEmail`)
- Phase 11 decision: "linkBookingToAttribution silently no-ops when visitorId not found" — email fallback would be called in this case

## Notes

Consider adding `customerEmail` as optional field in `visitorSessions` during the first visit (captured if user fills a form). This would enable cross-device attribution beyond post-booking fallback.
