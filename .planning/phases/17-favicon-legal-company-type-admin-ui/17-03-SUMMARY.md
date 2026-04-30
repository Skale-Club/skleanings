---
phase: 17-favicon-legal-company-type-admin-ui
plan: "03"
subsystem: ui
tags: [react, admin, shadcn, legal-pages, company-settings, white-label]

# Dependency graph
requires:
  - phase: 17-01
    provides: faviconUrl, serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent fields in CompanySettingsData and DB schema

provides:
  - LegalBrandingTab component with favicon upload, service delivery model radio, privacy/terms textareas
  - CompanySettingsSection wired to render LegalBrandingTab
  - DB-driven PrivacyPolicy page (56 lines, replaces 263 hardcoded)
  - DB-driven TermsOfService page (56 lines, replaces 199 hardcoded)

affects: [phase-18-calendar-address-gating, any phase using privacy or terms routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LegalBrandingTab receives settings + updateField + getAccessToken + isSaving props — no separate state/save mutation needed
    - Legal pages use hasContent guard before dangerouslySetInnerHTML — always check content?.trim() truthiness first
    - Auth token null guard before authenticatedRequest call — toast + return on null

key-files:
  created:
    - client/src/components/admin/LegalBrandingTab.tsx
  modified:
    - client/src/components/admin/CompanySettingsSection.tsx
    - client/src/pages/PrivacyPolicy.tsx
    - client/src/pages/TermsOfService.tsx

key-decisions:
  - "LegalBrandingTab uploads favicon by calling authenticatedRequest + updateField('faviconUrl') — no prop-drilling of saveSettings; state sync done via updateField, cache invalidated via queryClient.invalidateQueries"
  - "Null guard added for getAccessToken return before authenticatedRequest call — plan template omitted this but TypeScript required it (Rule 1 auto-fix)"
  - "Legal pages are complete rewrites — no DOMPurify per D-14/D-15 (admin-authored content)"
  - "LegalEmptyState shows companyEmail or companyPhone from settings, falls back to generic copy when both absent"

patterns-established:
  - "Tab components in CompanySettingsSection receive settings+updateField+getAccessToken+isSaving — same pattern for future settings tabs"
  - "DB-driven legal pages: hasContent guard -> dangerouslySetInnerHTML OR LegalEmptyState — reuse for any future DB-driven content pages"

requirements-completed: [FAV-01, WLTYPE-02, LEGAL-02, LEGAL-03, LEGAL-04]

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 17 Plan 03: Legal & Branding Admin UI Summary

**Admin Legal & Branding tab with favicon upload, service delivery model radio, and legal content textareas; public /privacy-policy and /terms-of-service rewritten as DB-driven pages with empty-state fallback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-30T12:22:45Z
- **Completed:** 2026-04-30T12:25:55Z
- **Tasks:** 2 (+ checkpoint auto-approved)
- **Files modified:** 4

## Accomplishments

- Created LegalBrandingTab.tsx with 4 sub-sections: favicon upload (with dashed placeholder and image preview states), service delivery model RadioGroup (3 options), Privacy Policy textarea (400px min-height, monospace), Terms of Service textarea
- Wired LegalBrandingTab into CompanySettingsSection — rendered at bottom, receives existing settings/updateField/getAccessToken/isSaving props
- Rewrote PrivacyPolicy.tsx from 263 lines of hardcoded cleaning-company content to 56 lines reading privacyPolicyContent from DB
- Rewrote TermsOfService.tsx from 199 lines of hardcoded cleaning-company content to 56 lines reading termsOfServiceContent from DB

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LegalBrandingTab.tsx + wire into CompanySettingsSection** - `c358448` (feat)
2. **Task 2: Rewrite PrivacyPolicy.tsx and TermsOfService.tsx** - `d5bc7b4` (feat)

**Plan metadata:** (docs commit — see final_commit step)

## Files Created/Modified

- `client/src/components/admin/LegalBrandingTab.tsx` - New tab component with favicon upload, service delivery model radio, and legal content textareas
- `client/src/components/admin/CompanySettingsSection.tsx` - Added LegalBrandingTab import and render at bottom of JSX
- `client/src/pages/PrivacyPolicy.tsx` - Complete rewrite: DB-driven with hasContent guard and LegalEmptyState fallback (56 lines)
- `client/src/pages/TermsOfService.tsx` - Complete rewrite: DB-driven with hasContent guard and LegalEmptyState fallback (56 lines)

## Decisions Made

- Null guard added to handleFaviconUpload before authenticatedRequest call: `if (!token) { toast(...); return; }` — TypeScript required this since getAccessToken returns `string | null`
- LegalBrandingTab calls `updateField('faviconUrl', objectPath)` after upload to sync parent state, plus `queryClient.invalidateQueries` for cache — no prop-drilling of saveSettings needed
- No DOMPurify added per plan constraints D-14/D-15 — legal pages are admin-authored content, not user-generated

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added null guard for auth token before upload request**
- **Found during:** Task 1 (LegalBrandingTab.tsx creation)
- **Issue:** The plan template for handleFaviconUpload passed `token` (type `string | null`) directly to `authenticatedRequest` which expects `string`. TypeScript rejected this.
- **Fix:** Added `if (!token) { toast({ title: 'Upload failed', ... }); return; }` guard before the upload request — matches the pattern used in CompanySettingsSection.handleLogoUpload
- **Files modified:** client/src/components/admin/LegalBrandingTab.tsx
- **Verification:** `npm run check` exits 0
- **Committed in:** c358448 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type safety bug in plan template)
**Impact on plan:** Minimal — single null guard line, no scope creep. Matches existing pattern in CompanySettingsSection.

## Issues Encountered

None beyond the auto-fixed type error above.

## Known Stubs

None — all fields are wired to DB (via updateField debounce auto-save) and rendered from DB on the public legal pages.

## User Setup Required

**External services require manual configuration before testing:**
- Apply pending migration `20260428000000_add_white_label_columns.sql` (Phase 15, adds faviconUrl, serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent columns)
- Apply pending migration `20260430000000_add_favicon_url.sql` (Phase 17-01, if not already applied)
- Run: `supabase db push` from project root with `POSTGRES_URL_NON_POOLING` set in `.env`

## Next Phase Readiness

- Admin can now configure all white-label content: favicon, service delivery model, privacy policy, terms of service
- Public /privacy-policy and /terms-of-service serve DB content or graceful empty-state
- Phase 17 admin UI goals complete — Phase 18 (calendar address-gating based on serviceDeliveryModel) can proceed once migrations are applied

---
*Phase: 17-favicon-legal-company-type-admin-ui*
*Completed: 2026-04-30*
