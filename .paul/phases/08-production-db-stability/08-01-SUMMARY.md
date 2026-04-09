---
phase: 08-production-db-stability
plan: 01
subsystem: database
tags: [postgres, neon, vercel, drizzle, connection-pooling, serverless]

requires:
  - phase: 07-google-calendar-polish
    provides: stable auth middleware and CalendarReconnectBanner component

provides:
  - Vercel serverless functions use pgBouncer pooler (POSTGRES_URL) instead of direct TCP (POSTGRES_URL_NON_POOLING)
  - DB connection timeout fails in 8s instead of 30s (ahead of Vercel's 30s hard kill)
  - CalendarReconnectBanner does not trigger repeated /api/staff/calendar/all-statuses refetches on tab focus

affects: []

tech-stack:
  added: []
  patterns:
    - "Vercel serverless: always use POSTGRES_URL (pgBouncer pooler) for runtime; reserve POSTGRES_URL_NON_POOLING for migrations only"
    - "connectionTimeoutMillis must be less than Vercel maxDuration to allow graceful error response"

key-files:
  modified:
    - server/db.ts
    - client/src/components/admin/CalendarReconnectBanner.tsx

key-decisions:
  - "POSTGRES_URL (pooled) first in serverless — direct TCP connection was bypassing pgBouncer, causing 30s hangs on Neon auto-pause"
  - "connectionTimeoutMillis: 8000 — fail fast with a real error instead of timing out silently at Vercel's hard kill"
  - "refetchOnWindowFocus: false on CalendarReconnectBanner — prevents cascading 504 storms on tab switches when DB is recovering"

patterns-established:
  - "For Vercel + Neon: POSTGRES_URL (pooled) for all runtime queries; POSTGRES_URL_NON_POOLING only in drizzle.config.ts for db:push"

duration: ~15min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 8 Plan 01: Production DB Stability — Summary

**Fixed Vercel 504 timeouts by correcting the DB connection priority: serverless now uses pgBouncer-pooled POSTGRES_URL instead of the direct NON_POOLING URL that was hanging for 30s on every Neon auto-pause.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Tasks | 2 completed |
| Files modified | 2 |
| Deviations | 0 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Serverless uses pooled connection | Pass | `POSTGRES_URL` now first in serverless branch of `server/db.ts` |
| AC-2: Connection timeout fails fast | Pass | `connectionTimeoutMillis` reduced from 30000 → 8000 |
| AC-3: CalendarReconnectBanner no refetch on focus | Pass | `refetchOnWindowFocus: false` + `staleTime: 5min` added |

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/db.ts` | Modified | Swap serverless connection priority; reduce timeout |
| `client/src/components/admin/CalendarReconnectBanner.tsx` | Modified | Prevent repeated refetch on window focus |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use `POSTGRES_URL` first in serverless | pgBouncer pooler keeps warm TCP connections; direct NON_POOLING creates a new TCP connection per invocation, hanging 30s on Neon auto-pause | Eliminates primary 504 cause |
| `connectionTimeoutMillis: 8000` | Must be less than Vercel's `maxDuration: 30` to allow graceful error response vs. silent kill | Functions now return a real error instead of a 504 |
| `refetchOnWindowFocus: false` on banner | When query is in error state, React Query refetches on every tab switch regardless of staleTime — creating a 504 storm loop | Breaks the refetch loop |

## Deviations from Plan

None — plan executed exactly as specified.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Production API endpoints should respond normally after deploy
- DB connection is now routed through pgBouncer for all serverless runtime queries

**Concerns:**
- Neon auto-pause may still cause a 1-3s cold-start delay on the very first request after inactivity (even with pooler). User should disable auto-pause in Neon/Vercel Postgres console as documented.
- `drizzle.config.ts` should be verified to use `POSTGRES_URL_NON_POOLING` (not POSTGRES_URL) for migrations — pgBouncer disables prepared statements which breaks `db:push`.

**Blockers:**
- None — but user manual action recommended: disable Neon auto-pause in console (Settings → Compute → Suspend compute after inactivity → Disable)

---
*Phase: 08-production-db-stability, Plan: 01*
*Completed: 2026-04-04*
