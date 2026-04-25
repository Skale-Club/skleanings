---
phase: 10-schema-capture-classification
plan: 03
subsystem: client
tags: [analytics, utm, client-hook, fire-and-forget, react, wouter]

# Dependency graph
requires:
  - phase: 10-schema-capture-classification
    plan: 01
    provides: visitorSessions Drizzle table in shared/schema.ts
  - phase: 10-schema-capture-classification
    plan: 02
    provides: POST /api/analytics/session endpoint

provides:
  - useUTMCapture() React hook — client-side UTM capture with DEV guard
  - AnalyticsProvider invokes useUTMCapture() on every location change

affects:
  - 11 (booking attribution — client stores visitorId in localStorage for attribution linkage)
  - 12 (marketing dashboard — data flowing into visitor_sessions from this hook)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DEV guard as first statement in hook (matches analytics.ts initAnalytics pattern)"
    - "fire-and-forget fetch with .catch(() => {}) — analytics never breaks UX"
    - "localStorage UUID via crypto.randomUUID() — no UUID package needed (browser built-in)"
    - "URLSearchParams for UTM param reading — no third-party library"
    - "Mounted inside existing AnalyticsProvider — zero new providers or components"

key-files:
  created:
    - client/src/hooks/use-utm-capture.ts (87 lines)
  modified:
    - client/src/App.tsx (2 lines — import + useUTMCapture() invocation)

key-decisions:
  - "useUTMCapture() invoked at line 85 in App.tsx, immediately after const [location] = useLocation() inside AnalyticsProvider"
  - "localStorage key is 'skleanings_visitor_id' — critical for Phase 11 attribution linkage"
  - "Signal filter: only POST when isNewVisitor || hasUtm || !!referrer — pure internal SPA navs silently skipped"
  - "landingPage = window.location.pathname only (no query string) — UTM params captured separately to avoid duplication"

# Metrics
duration: 2min
completed: 2026-04-25
---

# Phase 10 Plan 03: Client UTM Capture Hook Summary

**useUTMCapture hook with DEV guard, localStorage UUID, client-side normalization, and fire-and-forget POST mounted inside AnalyticsProvider**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-25T15:53:38Z
- **Completed:** 2026-04-25T15:55:55Z
- **Tasks completed:** 2 of 2 code tasks (Task 3 is human-verify, auto-approved in auto mode — pending migration)
- **Files created:** 1, **Files modified:** 1

## Accomplishments

### Task 1 — client/src/hooks/use-utm-capture.ts (87 lines)

- `VISITOR_ID_KEY = "skleanings_visitor_id"` — localStorage key used for cross-visit UUID persistence (CAPTURE-02)
- `norm(v)` helper: `v?.trim().toLowerCase()` returning `null` for empty — client-side CAPTURE-03 normalization
- `useUTMCapture()` exported hook:
  - Line 1 of effect: `if (import.meta.env.DEV) return` — D-05 guard matching analytics.ts pattern
  - `localStorage.getItem / setItem` with `crypto.randomUUID()` — D-08, no UUID package
  - `URLSearchParams(window.location.search)` — reads all 6 UTM params
  - `referrer = document.referrer || null` — captures page-load referrer
  - `landingPage = window.location.pathname` — pathname-only per CONTEXT.md specifics
  - Signal filter: `isNewVisitor || hasUtm || !!referrer` — skips pure internal SPA navs
  - `fetch("/api/analytics/session", { method: "POST", ... }).catch(() => {})` — fire-and-forget

### Task 2 — client/src/App.tsx (2 line addition)

- Line 15: `import { useUTMCapture } from "@/hooks/use-utm-capture";`
- Line 85: `useUTMCapture();` — invoked immediately after `const [location] = useLocation();` inside AnalyticsProvider
- `npm run build` exits 0 — hook included in production bundle

### Task 3 — Human-verify checkpoint (auto-approved, PENDING MIGRATION)

Auto-approved per auto_advance=true. The 7-step manual smoke test cannot be fully executed until:
1. `POSTGRES_URL_NON_POOLING` (direct connection) is set in `.env`
2. `supabase db push` is run to apply `supabase/migrations/20260425000000_add_utm_tracking.sql`

See test steps in 10-03-PLAN.md Task 3 `<how-to-verify>` section. Resume signal: "phase 10 verified".

## useUTMCapture() Mount Point

**File:** `client/src/App.tsx`
**Line number (after edits):** 85
**Context:**
```typescript
function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useQuery<CompanySettings>({ ... });
  const [location] = useLocation();  // line 84
  useUTMCapture();                   // line 85 — MOUNT POINT
  ...
}
```

## localStorage Key

**Key:** `skleanings_visitor_id`

This key is the primary cross-visit visitor identifier. Any future migration (e.g., if the key needs to change) must:
1. Read the old key
2. Migrate the value to the new key
3. Delete the old key

The server's `visitor_sessions.id` (UUID) is the canonical source of truth — the localStorage UUID matches `visitor_sessions.id`.

## Smoke Test Status

| Test | Description | Status |
|------|-------------|--------|
| 1 | UTM capture + UUID + lowercase | PENDING MIGRATION |
| 2 | First-touch immutability | PENDING MIGRATION |
| 3 | Organic search classification | PENDING MIGRATION |
| 4 | Direct nav does not overwrite last-touch | PENDING MIGRATION |
| 5 | DEV guard suppresses POST in dev | PENDING MIGRATION (verifiable locally now) |
| 6 | Rate limit triggers 429 | PENDING MIGRATION |
| 7 | ATTR-03 unique constraint deferred to Phase 11 | Deferred by design |

Test 5 (DEV guard) can be verified locally without migration: run `npm run dev`, visit `/?utm_source=Test`, confirm no POST in Network tab.

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing TypeScript Errors (Out of Scope)

The following errors existed before this plan and are unrelated to the new hook:
- `client/src/components/chat/admin/ConversationList.tsx` — Lucide icon `title` prop (3 errors)
- `server/routes/bookings.ts` — missing storage methods in DatabaseStorage (4 errors)
- `server/routes/contacts.ts` — missing storage methods in DatabaseStorage (4 errors)
- `server/routes/user-routes.ts` — missing `linkStaffToUser` in DatabaseStorage (2 errors)
- `server/storage.ts` — `userId` property mismatch (1 error)

These are logged in `deferred-items.md` and are out of scope for this plan.

## Known Stubs

None — the hook is fully wired. The POST will fail at runtime until the migration is applied (server will return a DB error, which the client silently swallows per fire-and-forget design).

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create client/src/hooks/use-utm-capture.ts | `0ac072b` | client/src/hooks/use-utm-capture.ts (created) |
| 2 | Mount useUTMCapture() in AnalyticsProvider | `563ec4f` | client/src/App.tsx (modified) |
| 3 | Human-verify checkpoint | N/A — auto-approved, pending migration | — |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| client/src/hooks/use-utm-capture.ts exists | FOUND |
| export function useUTMCapture present | FOUND (count=1) |
| DEV guard as first statement | FOUND |
| skleanings_visitor_id localStorage key | FOUND |
| crypto.randomUUID() | FOUND |
| fetch("/api/analytics/session") | FOUND |
| method: "POST" | FOUND |
| .catch() present | FOUND |
| await fetch absent | CONFIRMED (count=0) |
| window.location.pathname | FOUND |
| document.referrer | FOUND |
| URLSearchParams | FOUND |
| toLowerCase in norm() | FOUND |
| import in App.tsx | FOUND (line 15) |
| useUTMCapture() invocation in AnalyticsProvider | FOUND (line 85) |
| npm run build exits 0 | PASSED |
| Commit 0ac072b exists | FOUND |
| Commit 563ec4f exists | FOUND |
