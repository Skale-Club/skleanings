---
phase: 15
plan: 02
subsystem: schema-foundation-detokenization
tags: [white-label, detokenization, react, localStorage, document-title]
requirements:
  completed: [DETOK-01, DETOK-02, DETOK-03]
dependency-graph:
  requires:
    - "Plan 15-01 (CompanySettings type stable; no schema dependency from this plan, but type imports are stable)"
  provides:
    - "client/src/lib/visitor-key.ts — deriveCompanySlug + getVisitorIdKey utilities"
    - "Runtime-driven document.title via DocumentTitleSync component (DETOK-01)"
    - "Tenant-stable localStorage visitor key replacing 'skleanings_visitor_id' (DETOK-02)"
    - "Zero hardcoded 'Skleanings' display literals in client/src/ (DETOK-03)"
  affects:
    - "Plan 15-03 (server detokenization) — independent; runs in parallel"
    - "Phase 16 (server-side SEO meta) — DocumentTitleSync remains client-side; per-page title is Phase 16 territory"
    - "Phase 17 (admin UI for white-label fields) — CompanySettingsSection now defaults to '' for companyName/companyEmail"
tech-stack:
  added: []
  patterns:
    - "useCompanySettings + isReady gating in effect dependencies (extends Plan 15-01 isReady semantics)"
    - "Single-source-of-truth utility module re-exported from a hook for D-07 contract compliance"
    - "useRef 'has fired' guard in BookingPage to prevent re-firing analytics events when settings reload mid-session"
key-files:
  created:
    - "client/src/lib/visitor-key.ts (26 lines, two pure functions)"
  modified:
    - "client/src/hooks/use-utm-capture.ts (rewritten: useCompanySettings + isReady gate + helper re-exports)"
    - "client/src/components/chat/ChatWidget.tsx (toggleOpen visitor-key read via helper)"
    - "client/src/pages/BookingPage.tsx (two read sites + isReady gate + useRef fire-once guard)"
    - "client/src/App.tsx (DocumentTitleSync component mounted inside CompanySettingsProvider)"
    - "client/src/pages/PrivacyPolicy.tsx (|| '' fallbacks)"
    - "client/src/pages/TermsOfService.tsx (|| '' fallbacks)"
    - "client/src/components/admin/AdminHeader.tsx (|| '' fallback)"
    - "client/src/components/admin/BlogSection.tsx (defaultAuthor from useCompanySettings; useCallback dep added)"
    - "client/src/components/admin/blog/BlogPostEditor.tsx (placeholder='')"
    - "client/src/components/admin/CompanySettingsSection.tsx (empty initial state)"
    - "client/src/pages/BlogPost.tsx (JSON-LD publisher.name fallback)"
    - "client/src/pages/AdminLogin.tsx (siteUrl fallback '')"
    - "client/src/components/LoginDialog.tsx (siteUrl fallback '')"
decisions:
  - "Used aliased { settings: csForKey, isReady: settingsReady } in BookingPage to avoid name collision with the existing parallel useQuery `companySettings` declared further down in the component"
  - "Added useRef 'fire-once' guard to BookingPage booking_started effect — prevents re-fire when settingsReady toggles or companySettings changes, matching the original [] dependency intent"
  - "BlogSection authorName uses defaultAuthor from useCompanySettings (per RESEARCH Open Question 1) rather than '' fallback — matches white-label semantic 'use the actual tenant name'"
  - "Stripped legacy literal `\"skleanings_visitor_id\"` from inline comments in visitor-key.ts and use-utm-capture.ts — strict grep zero-match compliance per success criteria (D-12 allows comments, but executor took the stricter path)"
  - "Added `defaultAuthor` to resetForm useCallback dependency array — required for Eslint exhaustive-deps and correctness when companyName loads after first render"
metrics:
  duration: "6m 0s"
  completed: "2026-04-29"
  tasks: 5
  files: 13
---

# Phase 15 Plan 02: Client Detokenization Summary

Made the customer-facing client tenant-agnostic — runtime-driven browser tab title from `companySettings.companyName`, slug-derived localStorage visitor key replacing `skleanings_visitor_id`, and zero hardcoded `"Skleanings"` literals in `client/src/`.

## What Was Done

### Task 1: Create `client/src/lib/visitor-key.ts`

**File created:** 26 lines, two pure functions.
**Commit:** `bd9b1e5`

```typescript
export function deriveCompanySlug(settings: CompanySettings | null): string {
  if (!settings) return '';
  const name = (settings.companyName ?? '').trim();
  if (name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  return `tenant-${settings.id}`;
}

export function getVisitorIdKey(slug: string): string {
  return `${slug || 'visitor'}_visitor_id`;
}
```

Single source of truth for visitor-key derivation. RESEARCH confirmed `companySettings` has NO `slug` column — slug is derived from `companyName` lowercased + slugified, with `tenant-${id}` fallback when name is empty. Empty-slug safety net produces `visitor_visitor_id`.

### Task 2: Rewrite `client/src/hooks/use-utm-capture.ts`

**Commit:** `05707c2`

- Calls `useCompanySettings()` and gates the effect on `isReady` (D-06).
- Derives `VISITOR_ID_KEY` per-render via `getVisitorIdKey(deriveCompanySlug(settings))` — eliminates the static module-level `const VISITOR_ID_KEY = "skleanings_visitor_id"`.
- Re-exports `getVisitorIdKey` and `deriveCompanySlug` from `@/lib/visitor-key` to honor D-07's literal text ("export from use-utm-capture.ts").
- Effect dependency array extended to `[location, isReady, settings]`.
- Preserved: dev-mode early return, UUID generation, UTM read, "no signal" skip, fire-and-forget POST.

### Task 3: Update read sites — `ChatWidget.tsx` + `BookingPage.tsx`

**Commit:** `6cb86cb`

- **ChatWidget.tsx:** Added `useCompanySettings` + helper imports; replaced `localStorage.getItem('skleanings_visitor_id')` at line 538 with `isReady ? localStorage.getItem(getVisitorIdKey(deriveCompanySlug(settings))) : null`.
- **BookingPage.tsx:** Added imports + aliased `{ settings: csForKey, isReady: settingsReady }` (the file already declares a `companySettings` from a parallel `useQuery` further down — collision avoided via alias). Both read sites (lines ~143 and ~195) replaced with helper-derived key. The booking_started useEffect is now gated on `settingsReady` and protected by a `useRef`-based fire-once guard.
- Stripped the legacy literal from inline comments in `visitor-key.ts` and `use-utm-capture.ts` for strict grep compliance.

### Task 4: `App.tsx` document.title sync

**Commit:** `15b132d`

Added `DocumentTitleSync()` effect-only component that runs `document.title = settings?.companyName || ""` whenever `settings.companyName` changes. Mounted directly inside `<CompanySettingsProvider>` next to `<BrandColorInjector />`. Returns `null` — zero layout impact. ThemeContext untouched per D-03.

### Task 5: Detokenize remaining `"Skleanings"` literals

**Commit:** `565edc5` (9 files)

| File | Edit |
|------|------|
| `pages/PrivacyPolicy.tsx` | `\|\| "Skleanings"` and `\|\| "contact@skleanings.com"` → `\|\| ""` |
| `pages/TermsOfService.tsx` | same pattern |
| `components/admin/AdminHeader.tsx` | `companyName \|\| 'Skleanings'` → `companyName \|\| ''` |
| `components/admin/blog/BlogPostEditor.tsx` | `placeholder="Skleanings"` → `placeholder=""` |
| `components/admin/CompanySettingsSection.tsx` | useState seed values `'Skleanings'`/`'contact@skleanings.com'` → `''` |
| `pages/BlogPost.tsx` | JSON-LD `"name": settings?.companyName \|\| "Skleanings"` → `\|\| ""` |
| `pages/AdminLogin.tsx` | `\|\| 'https://skleanings.com'` → `\|\| ''` |
| `components/LoginDialog.tsx` | same pattern |
| `components/admin/BlogSection.tsx` | Added `useCompanySettings`; `defaultAuthor = cs?.companyName ?? ''`; both `authorName: 'Skleanings'` seeds → `authorName: defaultAuthor`; `resetForm` useCallback dep array updated |

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| **DETOK-01** | `grep -n "document.title" client/src/App.tsx` references `settings?.companyName` | PASS (line 29) |
| **DETOK-02** | `grep -rn "skleanings_visitor_id" client/src/` | PASS (zero matches, including comments) |
| **DETOK-03** | `grep -rn "\"Skleanings\"\|'Skleanings'" client/src/ --include="*.{ts,tsx}"` | PASS (zero matches) |
| DETOK-03 email | `grep -rn "contact@skleanings.com" client/src/ --include="*.{ts,tsx}"` | PASS (zero matches) |
| DETOK-03 url | `grep -rn "https://skleanings.com" client/src/ --include="*.{ts,tsx}"` | PASS (zero matches) |
| **D-08 preserved** | `grep -c "skleanings-admin-theme" client/src/context/ThemeContext.tsx` | PASS (1 — UNCHANGED) |
| TypeScript clean | `npm run check` | PASS (0 errors) |
| Full build | `npm run build` | PASS (only pre-existing server-side `import.meta` warnings, out of scope) |

## D-08 Traceability

`THEME_STORAGE_KEY = 'skleanings-admin-theme'` in `client/src/context/ThemeContext.tsx` is **deliberately preserved** per D-08 (CONTEXT.md). It is admin-only, non-display localStorage state. Changing it would force every admin to re-select their theme on next deploy with no white-label benefit. Defer to a future cleanup phase if needed.

## Accepted Attribution Disconnect

Per CONTEXT.md `<code_context>` line 127 and RESEARCH Pitfall 1, no localStorage migration is performed for visitors that previously captured `skleanings_visitor_id`. New visitors from deploy onward use the slug-derived key (`${slug}_visitor_id`); pre-existing visitors will appear as new visitors in attribution data — accepted one-way migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Name collision in BookingPage.tsx**
- **Found during:** Task 3
- **Issue:** Plan suggested `const { settings: companySettings, isReady: settingsReady } = useCompanySettings()`, but BookingPage already declares `const { data: companySettings } = useQuery(...)` further down in the component, causing TS2451 "Cannot redeclare block-scoped variable".
- **Fix:** Renamed alias to `csForKey` to avoid collision. Plan-noted alternative ("Use aliases ... to avoid colliding with any existing `settings` variable").
- **Files modified:** `client/src/pages/BookingPage.tsx`
- **Commit:** `6cb86cb`

**2. [Rule 2 - Critical] Missing useCallback dependency in BlogSection.resetForm**
- **Found during:** Task 5
- **Issue:** `resetForm` reads `defaultAuthor` from closure but had `[]` dep array — would capture the initial (empty) value forever even after companyName loads.
- **Fix:** Added `[defaultAuthor]` to the dep array.
- **Files modified:** `client/src/components/admin/BlogSection.tsx`
- **Commit:** `565edc5`

**3. [Rule 2 - Critical] Missing fire-once guard in BookingPage booking_started effect**
- **Found during:** Task 3
- **Issue:** The original `useEffect(..., [])` fired exactly once on mount. Adding `[settingsReady, csForKey, items, totalPrice]` to satisfy isReady-gating would cause `booking_started` to re-fire whenever settings changed mid-session — duplicate analytics events.
- **Fix:** Added `bookingStartedFiredRef = useRef(false)` and short-circuit on `bookingStartedFiredRef.current` to preserve "fire exactly once when ready" semantics.
- **Files modified:** `client/src/pages/BookingPage.tsx`
- **Commit:** `6cb86cb`

**4. [Rule 1 - Strict compliance] Legacy literal in inline comments**
- **Found during:** Task 3 verification
- **Issue:** Plan/D-12 allows the literal `"skleanings_visitor_id"` to remain in comments, but the strict success criterion in the executor prompt was `grep -rn "skleanings_visitor_id" client/src/` returning ZERO matches.
- **Fix:** Rephrased two comment occurrences to satisfy the strict criterion.
- **Files modified:** `visitor-key.ts`, `use-utm-capture.ts`, `BlogSection.tsx`
- **Commit:** `6cb86cb`, `565edc5`

## Self-Check: PASSED

- File `client/src/lib/visitor-key.ts`: FOUND
- Commit `bd9b1e5` (Task 1): FOUND
- Commit `05707c2` (Task 2): FOUND
- Commit `6cb86cb` (Task 3): FOUND
- Commit `15b132d` (Task 4): FOUND
- Commit `565edc5` (Task 5): FOUND
- DETOK-01 grep: PASS
- DETOK-02 grep: PASS (zero matches)
- DETOK-03 grep: PASS (zero matches)
- D-08 preservation: PASS (ThemeContext untouched, key intact)
- `npm run check`: PASS (0 errors)
- `npm run build`: PASS
