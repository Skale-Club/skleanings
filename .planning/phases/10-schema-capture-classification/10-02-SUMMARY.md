---
phase: 10-schema-capture-classification
plan: 02
subsystem: server
tags: [analytics, utm, traffic-classification, rate-limiting, drizzle, express, zod]

# Dependency graph
requires:
  - phase: 10-schema-capture-classification
    plan: 01
    provides: visitorSessions Drizzle table + VisitorSession type in shared/schema.ts

provides:
  - classifyTraffic() pure TS function — server-authoritative UTM/referrer → TrafficSource label
  - upsertVisitorSession() storage function with first-touch immutability invariant
  - POST /api/analytics/session Express endpoint — public, rate-limited, Zod-validated

affects:
  - 10-03 (client hook — posts to /api/analytics/session created here)
  - 11 (booking attribution — storage.upsertVisitorSession also used to backfill utmSessionId on booking)
  - 12 (marketing dashboard — reads visitor_sessions rows written by this endpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure TS classifier with zero imports — dependency-free for reuse and future unit testing"
    - "Select-first integer increment pattern for visitCount (avoids Drizzle 0.39.3 raw SQL expression issues)"
    - "Direct ../storage/index import in route to bypass server/storage.ts type shadowing"
    - "Fire-and-forget error handling: storage errors return 200 with null sessionId"

key-files:
  created:
    - server/lib/traffic-classifier.ts (91 lines)
    - server/storage/analytics.ts (138 lines)
    - server/routes/analytics.ts (57 lines)
  modified:
    - server/storage/index.ts (import + spread ...analytics)
    - server/routes.ts (import + app.use registration)

key-decisions:
  - "classifyTraffic() uses simple string inclusion (tokenMatches) for UTM source, URL hostname for referrer — matches CONTEXT.md D-04 priority order"
  - "visitCount increment uses select-first pattern: fetch existing.visitCount, add 1, pass integer — avoids sql`` expression issues in Drizzle 0.39.3"
  - "server/routes/analytics.ts imports from ../storage/index directly (not ../storage) — server/storage.ts file takes TypeScript module resolution precedence over directory and lacks upsertVisitorSession in its DatabaseStorage type"
  - "UPDATE branch in upsertVisitorSession never references any first_* field — verified by grep and inline invariant comment"
  - "Rate limit key namespaced as analytics:{ip} (D-06, 60 req/min) — avoids collision with chat rate limit keys"

# Metrics
duration: 7min
completed: 2026-04-25
---

# Phase 10 Plan 02: Server Infrastructure — Traffic Classifier, Storage Upsert, Analytics Endpoint Summary

**Pure-TS traffic classifier + Drizzle upsert with first-touch immutability invariant + rate-limited public session endpoint wired at /api/analytics/session**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-04-25T15:36:10Z
- **Completed:** 2026-04-25T15:43:00Z
- **Tasks completed:** 3 of 3
- **Files created:** 3, **Files modified:** 2

## Accomplishments

### Task 1 — server/lib/traffic-classifier.ts (91 lines)

- `TrafficSource` union: `organic_search | social | paid | email | referral | direct | unknown`
- `classifyTraffic(utmSource, utmMedium, referrer)` — pure TypeScript, zero imports
- Priority: UTM medium email/e-mail → paid (cpc/ppc/etc.) → UTM source search/social/unknown → referrer search/social → direct
- `SEARCH_ENGINES`: google, bing, yahoo, duckduckgo, baidu, yandex, ecosia
- `SOCIAL_NETWORKS`: facebook, instagram, youtube, tiktok, linkedin, twitter, x.com, pinterest, reddit, snapchat
- `PAID_MEDIUMS` Set for O(1) lookup: cpc, ppc, paid, paidsearch, paid_search, display, paid_social, paidsocial, social_paid
- `hostnameMatches()` uses `new URL(referrer).hostname` — handles `www.google.com`, `google.co.uk`, etc.

### Task 2 — server/storage/analytics.ts (138 lines) + server/storage/index.ts

- `UpsertSessionPayload` interface (visitorId + 8 UTM/referrer fields)
- First-touch immutability invariant comment (exact wording per CONTEXT.md planning note 4)
- Server-side D-04 normalization: UTMs lowercased+trimmed; referrer/landingPage trimmed only
- `classifyTraffic()` called once per request for server-authoritative source label
- `hasMeaningfulSignal` (D-02): true if `utmSource` present OR external referrer — controls last-touch update
- SELECT returns `{ id, visitCount }` — integer used directly for safe increment
- INSERT branch: sets both `first_*` and `last_*` columns from this visit, `visitCount: 1`
- UPDATE branch: NEVER touches `first_*` columns — only `lastSeenAt`, `visitCount`, and conditionally `last_utm_*`/`last*`
- `isSameDomain()` reads `APP_DOMAIN || VITE_APP_URL` env vars (file-private helper)
- `storage/index.ts`: `import * as analytics from "./analytics"` + `...analytics` spread added after `...staff`

### Task 3 — server/routes/analytics.ts (57 lines) + server/routes.ts

- `sessionSchema`: `visitorId` as `z.string().uuid()`, 8 optional nullable fields with `.default(null)`, UTM fields max(500), URL fields max(2000)
- Rate limit: `isRateLimited(\`analytics:${ip}\`, 60, 60_000)` — D-06 threshold, namespaced key
- ZodError branch → 400 `{ message, errors }`
- Generic error branch → log + 200 `{ sessionId: null, isNew: false }` (fire-and-forget)
- Success → 200 `{ sessionId: session.id, isNew }`
- `server/routes.ts`: import + `app.use("/api/analytics", analyticsRouter)` after payments router

## Rate Limit Configuration

| Key prefix | Limit | Window | Source |
|------------|-------|--------|--------|
| `analytics:{ip}` | 60 | 60,000 ms | D-06 / `isRateLimited()` from `server/lib/rate-limit.ts` |

## First-Touch Invariant Verification

```
grep "first" server/storage/analytics.ts | grep -v "//\|comment\|first_*\|firstUtm\|INSERT\|isNew\|firstSeen\|first-touch\|first_* columns"
```

The UPDATE branch (lines after `// UPDATE — returning visitor`) references ONLY:
- `lastSeenAt`, `visitCount`, `lastUtmSource`, `lastUtmMedium`, `lastUtmCampaign`, `lastUtmTerm`, `lastUtmContent`, `lastUtmId`, `lastLandingPage`, `lastReferrer`, `lastTrafficSource`

Zero `first*` field assignments in the UPDATE branch — confirmed by `node -e` verification script.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Direct import from ../storage/index to bypass type shadowing**
- **Found during:** Task 3 verification (`npm run check` reported `upsertVisitorSession` not on `DatabaseStorage`)
- **Issue:** `server/storage.ts` (class-based `DatabaseStorage`) and `server/storage/index.ts` (object-based spread) coexist. TypeScript module resolution finds the `.ts` file before the directory index, so `import { storage } from "../storage"` resolves to the old `DatabaseStorage` class which doesn't include `upsertVisitorSession`.
- **Fix:** Changed import in `server/routes/analytics.ts` to `import { storage } from "../storage/index"` — explicit path bypasses the file-vs-directory ambiguity.
- **Files modified:** `server/routes/analytics.ts` (line 3)
- **Commit:** `68c7638` (included in Task 3 commit)
- **Note:** The same root cause explains pre-existing errors in `server/routes/bookings.ts`, `server/routes/contacts.ts`, `server/routes/user-routes.ts` — those files were updated in `dev` to use new storage methods but still import from `"../storage"`. These are out of scope for this plan (pre-existing, not caused by plan 10-02 changes).

**2. [Out-of-scope - Deferred] Pre-existing TypeScript errors in merged dev branch**
- `client/src/components/chat/admin/ConversationList.tsx` — Lucide icon `title` prop type issue (3 errors)
- `server/routes/bookings.ts` — references to `getBookingsByDateRange`, `upsertContact`, `updateBookingContactId`, `userId` not in `DatabaseStorage` (4 errors)
- `server/routes/contacts.ts` — references to `listContactsWithStats`, `getContact`, `getContactBookings`, `updateContact` not in `DatabaseStorage` (4 errors)
- `server/routes/user-routes.ts` — `linkStaffToUser` not in `DatabaseStorage` (2 errors)
- `server/storage.ts` — `userId` property mismatch in booking insert type (1 error)
- **Root cause:** The `server/storage.ts` vs `server/storage/index.ts` dual-storage architecture. The `dev` branch updated routes to use new modular storage methods but TypeScript still resolves to the old file.
- **Action:** Logged to deferred items. NOT fixed in this plan — they are pre-existing and out of scope.

## Known Stubs

None — all functions are fully implemented. The endpoint will return a runtime error (not a stub response) if the DB tables don't exist until `supabase db push` is applied (per 10-01 blocker).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create server/lib/traffic-classifier.ts | `13cec5d` | server/lib/traffic-classifier.ts (created) |
| 2 | Create server/storage/analytics.ts + update index.ts | `81b8d51` | server/storage/analytics.ts (created), server/storage/index.ts (modified) |
| 3 | Create server/routes/analytics.ts + register in routes.ts | `68c7638` | server/routes/analytics.ts (created), server/routes.ts (modified) |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| server/lib/traffic-classifier.ts exists | FOUND |
| server/storage/analytics.ts exists | FOUND |
| server/routes/analytics.ts exists | FOUND |
| Commit 13cec5d exists | FOUND |
| Commit 81b8d51 exists | FOUND |
| Commit 68c7638 exists | FOUND |
| No errors in new files (npm run check) | PASSED — zero errors in analytics/classifier files |
| npm run build completes | PASSED — 2.0mb bundle, 3 pre-existing warnings only |
