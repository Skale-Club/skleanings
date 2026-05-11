---
id: SEED-012
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cut — locale settings (SEED-011) cover the lower-intensity case; full i18n is too expensive for the return
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when the first non-English tenant needs the booking flow translated
scope: Large
---

# SEED-012: Booking flow internationalization (i18n — translatable strings)

## Why This Matters

The product is white-label but all booking flow strings are hardcoded in English: "Add to cart", "Select a time", "Customer Details", "Book Now". A Brazilian tenant can't offer the site in Portuguese without forking and manually translating — defeating the white-label purpose.

**Why:** i18n is a market multiplier. With pt-BR + es-MX + en-US support, the product can be sold to cleaning companies in any Portuguese- or Spanish-speaking country — which together represent ~750 million people.

## When to Surface

**Trigger:** when signing the first contract with a company outside the US, or when starting marketing for Latin American markets, or when SEED-011 (locale settings) is complete.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- International expansion milestone
- Post-SEED-011 milestone (locale settings)
- Advanced white-label milestone (v4.0+)

## Scope Estimate

**Large** — A complete milestone. Extract all booking flow strings to translation files (react-i18next or similar), create en.json + pt-BR.json + es.json files, frontend wiring, language selector in booking flow, default language config via `companySettings.language`.

## Breadcrumbs

- `client/src/pages/BookingPage.tsx` — hardcoded strings in booking flow
- `client/src/components/` — multiple components with hardcoded strings
- `client/src/context/` — CartContext, AuthContext — hardcoded error messages
- Recommended library: `react-i18next` (mature, tree-shakeable, supports namespaces per feature)
- `companySettings.language` (from SEED-011) — determines site default locale

## Notes

Start with only the public booking flow (not admin) — it's what end customers see. Admin can stay in English for the first version. Translation priority: pt-BR (immediate Brazilian market), then es-MX.
