---
phase: 06-03-contacts-page
plan: 02
subsystem: ui
tags: [contacts, list, search, sidebar]

requires:
  - phase: 06-03-01
    provides: GET /api/contacts endpoint
provides:
  - 'contacts' added to AdminSection union type
  - Contacts nav item in admin sidebar (BookUser icon)
  - ContactsSection list component with search, stats table, GHL badge

key-files:
  modified:
    - client/src/components/admin/shared/types.ts
    - client/src/pages/Admin.tsx
  created:
    - client/src/components/admin/ContactsSection.tsx

key-decisions:
  - "List-only in this plan — detail Sheet added in Plan 03"
  - "Search debounced 500ms, sent as ?search= query param to server-side filter"

duration: ~5min
started: 2026-04-09T00:00:00Z
completed: 2026-04-09T00:00:00Z
---

# Phase 3 Plan 02: ContactsSection List UI

**Contacts nav item wired, searchable stats table renders.**

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Contacts nav item | Pass | BookUser icon, between Calendar and Company |
| AC-2: Contacts list table | Pass | All 7 columns including aggregated stats |
| AC-3: Search filter | Pass | 500ms debounce → ?search= param |
| AC-4: GHL badge | Pass | Green outline badge or gray dash |
| AC-5: Row click | Pass | onClick handler ready for Plan 03 detail |

---
*Phase: 06-03-contacts-page, Plan: 02 — Completed: 2026-04-09*
