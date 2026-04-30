---
phase: 17-favicon-legal-company-type-admin-ui
plan: "02"
subsystem: server, frontend, tests
tags: [seo-injector, favicon, token-replacement, tdd, index-html]

# Dependency graph
requires:
  - phase: 17-01
    provides: faviconUrl field in companySettings schema and CompanySettingsData type

provides:
  - "{{FAVICON_URL}}" token in seo-injector.ts tokens map (with /favicon.png fallback)
  - Tokenized favicon link tag in client/index.html (href="{{FAVICON_URL}}", type attr removed)
  - FAV-02 / FAV-03 / FAV-03b automated test cases in tests/seo/inject.test.mjs

affects:
  - 17-03-PLAN (admin UI — favicon upload; SEO injector now correctly serves dynamic favicon)
  - Any browser request — favicon served dynamically from companySettings.faviconUrl

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED-GREEN cycle: test added first (fails), then token added (passes)
    - Token map pattern: all dynamic values go through escapeAttr() before insertion
    - Fallback pattern: settings?.faviconUrl || "/favicon.png" — null, undefined, empty string all resolve to default

key-files:
  created: []
  modified:
    - server/lib/seo-injector.ts
    - client/index.html
    - tests/seo/inject.test.mjs

key-decisions:
  - "{{FAVICON_URL}} inserted before {{COMPANY_NAME_ALT}} in token map — consistent vertical alignment of the tokens block"
  - "escapeAttr() wraps the favicon URL — handles any special characters in Supabase Storage URLs"
  - "type='image/png' removed from favicon link in index.html — browser derives MIME from Supabase Content-Type (matches Plan 01 decision D-07)"

requirements-completed: [FAV-02, FAV-03]

# Metrics
duration: 2m 53s
completed: 2026-04-30
---

# Phase 17 Plan 02: Favicon SEO Injector Token + Index.html Tokenization Summary

**{{FAVICON_URL}} token wired into seo-injector.ts token map with /favicon.png fallback; client/index.html favicon link tokenized; FAV-02/FAV-03/FAV-03b tests added via TDD RED-GREEN cycle**

## Performance

- **Duration:** 2m 53s
- **Started:** 2026-04-30T12:22:03Z
- **Completed:** 2026-04-30T12:24:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `{{FAVICON_URL}}` entry to the `tokens` Record in `injectSeoMeta` (`server/lib/seo-injector.ts`): value is `escapeAttr(settings?.faviconUrl || "/favicon.png")` — handles null, undefined, and empty-string faviconUrl
- Updated `client/index.html` favicon link tag: `href` changed from `/favicon.png` to `{{FAVICON_URL}}`; `type="image/png"` attribute removed (browser derives MIME from Supabase Content-Type header)
- Added `{{FAVICON_URL}}` to TEMPLATE constant in `tests/seo/inject.test.mjs`
- Added three new test cases (FAV-02, FAV-03, FAV-03b) for custom URL, empty fallback, and null fallback behaviors
- All 11 inject.test.mjs cases pass; all jsonld-parity.test.mjs cases pass; `npm run check` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing FAVICON_URL test cases (RED)** - `0c8c4a1` (test)
2. **Task 2: Add FAVICON_URL token + tokenize index.html (GREEN)** - `99b4ee3` (feat)

## Files Created/Modified

- `tests/seo/inject.test.mjs` — TEMPLATE updated with `<link rel="icon" href="{{FAVICON_URL}}" />`; FAV-02, FAV-03, FAV-03b test blocks appended
- `server/lib/seo-injector.ts` — `"{{FAVICON_URL}}"` token entry added to tokens map before `{{COMPANY_NAME_ALT}}`
- `client/index.html` — Favicon link tag: `href="/favicon.png" type="image/png"` → `href="{{FAVICON_URL}}"` (type attr removed)

## Decisions Made

- `escapeAttr()` applied to favicon URL — consistent with all other attribute-bound tokens; handles special chars in CDN URLs
- Fallback uses `||` (falsy) not `?? ` (nullish) — treats empty string as "no favicon set" which is the correct UX semantic
- `type="image/png"` removed — hardcoding PNG MIME type is incorrect when admin uploads SVG or ICO; browser auto-detects from response headers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript check passed on first run.

## Known Stubs

None — all tokens wired; no placeholder values flowing to UI rendering.

## Self-Check: PASSED

- `server/lib/seo-injector.ts` FOUND: contains `{{FAVICON_URL}}`
- `client/index.html` FOUND: contains `href="{{FAVICON_URL}}"`, does NOT contain `href="/favicon.png"`
- `tests/seo/inject.test.mjs` FOUND: contains FAV-02, FAV-03, FAV-03b test blocks
- Commits FOUND: `0c8c4a1` (test), `99b4ee3` (feat)
- All 11 inject.test.mjs cases PASS
- All jsonld-parity.test.mjs cases PASS
- `npm run check` exit code 0

---
*Phase: 17-favicon-legal-company-type-admin-ui*
*Completed: 2026-04-30*
