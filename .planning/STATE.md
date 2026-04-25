# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-25 — Milestone v1.0 Marketing Attribution started

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-25)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Marketing Attribution — v1.0

## Accumulated Context

- DB connection was stabilized via postgres.js (SCRAM/pgBouncer fix, phase 09) — database layer is reliable
- Large server files were split into domain modules in recent refactor — follow this pattern for new server code
- Admin panel uses shadcn/ui + Tailwind + React Query — all new admin views must match these patterns
- Supabase CLI required for all DB migrations (drizzle-kit push triggers TTY prompt issues)
- GA4 + GTM in use externally — first-party marketing data complements, does not replace
