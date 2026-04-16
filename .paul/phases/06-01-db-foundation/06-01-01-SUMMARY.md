---
phase: 06-01-db-foundation
plan: 01
subsystem: database
tags: [postgres, drizzle, contacts, schema, storage]

requires: []
provides:
  - contacts table with deduplication-ready schema
  - bookings.contactId FK linking bookings to contacts
  - 6 IStorage contact methods (upsertContact, getContact, getContactByEmailOrPhone, listContacts, getContactBookings, updateContact)
  - Supabase migration SQL with backfill logic
affects:
  - 06-01-02 (imports contacts types)
  - 06-02-appointments-calendar (contact detail on event click)
  - 06-03-contacts-page (entire phase depends on this foundation)

tech-stack:
  added: []
  patterns:
    - upsertContact: email-first lookup, phone fallback, insert if not found

key-files:
  created:
    - supabase/migrations/20260409000000_add_contacts.sql
  modified:
    - shared/schema.ts
    - server/storage.ts

key-decisions:
  - "UserRole type added here (early) rather than plan 02 — colocated with schema exports"
  - "upsertContact: no-op if contact already exists — caller manages updates separately"
  - "ilike used for listContacts search — case-insensitive, works with Postgres"

patterns-established:
  - "Contact dedup: email primary key, phone fallback — consistent across upsertContact and migration backfill"

duration: ~15min
started: 2026-04-09T00:00:00Z
completed: 2026-04-09T00:00:00Z
---

# Phase 1 Plan 01: Contacts Table + Storage Layer

**`contacts` table, `bookings.contactId` FK, 6 storage methods, and backfill migration — full foundation for the Contacts page and calendar enrichment.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 3 of 3 completed |
| Files modified | 3 |
| TypeScript errors | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: contacts table in schema | Pass | All fields present, types exported |
| AC-2: bookings.contactId FK | Pass | Nullable, references contacts(id) onDelete set null |
| AC-3: IStorage interface extended | Pass | All 6 methods declared |
| AC-4: DatabaseStorage implements contact methods | Pass | All 6 implemented, `npm run check` clean |
| AC-5: Migration SQL ready | Pass | Created — not yet applied (user runs `npx supabase db push`) |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `shared/schema.ts` | Modified | Added `contacts` table, `UserRole` type, `insertContactSchema`, `Contact`/`InsertContact` types, `bookings.contactId` FK |
| `server/storage.ts` | Modified | Imported `contacts`, `Contact`, `ilike`; added 6 methods to IStorage interface + DatabaseStorage |
| `supabase/migrations/20260409000000_add_contacts.sql` | Created | Creates contacts table, adds contact_id to bookings, 4-step backfill from existing booking data |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `UserRole` type added in plan 01 | Colocated with other schema type exports; plan 02 imports it from schema | Plan 02 can import without duplication |
| `upsertContact` is find-or-create only | Callers don't accidentally overwrite existing contact data on booking creation | updateContact method handles intentional updates |
| Backfill: email dedup first, phone second | Mirrors upsertContact runtime logic — consistency between migration and runtime | Future bookings follow same dedup path |

## Deviations from Plan

| Type | Detail |
|------|--------|
| Minor scope addition | `UserRole` type added in this plan — was planned for 06-01-02. No impact; plan 02 will import it from schema instead of declaring it. |

## Next Phase Readiness

**Ready:**
- `contacts` table schema + types available to all future plans
- `bookings.contactId` ready to be populated by booking creation flow (Phase 3)
- All storage methods typed and implemented
- Migration SQL ready to apply via `npx supabase db push`

**Concerns:**
- Migration not yet applied to DB — must run before any contact methods are called in production
- `listContacts` uses `ilike` which requires Postgres (not SQLite) — fine for this project

**Blockers:**
- None for plan 02 (schema changes are in code, TypeScript compiles)

---
*Phase: 06-01-db-foundation, Plan: 01*
*Completed: 2026-04-09*
