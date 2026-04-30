---
phase: 17-favicon-legal-company-type-admin-ui
verified: 2026-04-30T00:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Admin Legal & Branding tab — visual layout and favicon upload flow"
    expected: "Favicon dashed placeholder renders, upload triggers spinner + toast, preview replaces placeholder after success, browser tab favicon updates on reload"
    why_human: "File upload interaction, Supabase signed URL flow, and browser favicon rendering cannot be verified without a live browser session"
  - test: "Service delivery model radio — auto-save persists on refresh"
    expected: "Clicking 'Customer Comes In' triggers auto-save indicator, refreshing the admin page shows that option still selected"
    why_human: "Debounce timing and persistence state require a running app with a live DB connection"
  - test: "/privacy-policy and /terms-of-service round-trip"
    expected: "Pasting content in admin textarea auto-saves; navigating to the public page shows that content; clearing the field switches back to the empty-state card"
    why_human: "DB write + read round-trip requires a live running app connected to the migrated database"
---

# Phase 17: Favicon, Legal, Company Type Admin UI — Verification Report

**Phase Goal:** Admin can configure the favicon, privacy policy, terms of service, and service delivery model through the settings panel — and customers visiting /privacy-policy or /terms-of-service see the content stored in the database rather than a 404 or placeholder
**Verified:** 2026-04-30
**Status:** PASSED (automated checks all green; human verification items noted below)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                    | Status     | Evidence                                                                                                                    |
|----|----------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------|
| 1  | faviconUrl column exists in migration file and Drizzle schema                                            | VERIFIED   | `supabase/migrations/20260430000000_add_favicon_url.sql` contains `ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT ''`; `shared/schema.ts` line 685 has `faviconUrl: text("favicon_url").default('')` |
| 2  | CompanySettingsData TypeScript interface includes all four new fields without type error                  | VERIFIED   | `client/src/components/admin/shared/types.ts` lines 61-64 define all four fields; `npm run check` exits 0                  |
| 3  | publicCompanySettingsFallback in server/routes/company.ts includes all four new fields                   | VERIFIED   | `server/routes/company.ts` lines 62-65 include `faviconUrl: ""`, `serviceDeliveryModel: "at-customer"`, `privacyPolicyContent: ""`, `termsOfServiceContent: ""`  |
| 4  | CompanySettingsSection useState initializer seeds all four new fields                                    | VERIFIED   | `client/src/components/admin/CompanySettingsSection.tsx` lines 55-58 include all four fields with safe defaults             |
| 5  | use-seo.ts reads settings.faviconUrl (not settings.logoIcon) for the favicon link update                 | VERIFIED   | `client/src/hooks/use-seo.ts` line 114: `if (settings.faviconUrl)`, line 121: `favicon.href = settings.faviconUrl`; `settings.logoIcon` not referenced in favicon block; no `favicon.type = 'image/png'` |
| 6  | Server injects faviconUrl into HTML responses via token; client/index.html uses {{FAVICON_URL}} token    | VERIFIED   | `server/lib/seo-injector.ts` line 109 maps `{{FAVICON_URL}}` with `settings?.faviconUrl \|\| "/favicon.png"` fallback; `client/index.html` line 29 has `href="{{FAVICON_URL}}"`, no `type="image/png"` |
| 7  | /privacy-policy and /terms-of-service render DB content or empty-state; admin Legal & Branding tab wired | VERIFIED   | Both pages use `useQuery(['/api/company-settings'])`, `hasContent` guard, `dangerouslySetInnerHTML`, and `LegalEmptyState`; `LegalBrandingTab` imported and rendered in `CompanySettingsSection`; routes registered in `App.tsx` lines 196-197 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                      | Provides                                      | Status     | Details                                                                                     |
|-------------------------------------------------------------------------------|-----------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| `supabase/migrations/20260430000000_add_favicon_url.sql`                      | favicon_url column migration                  | VERIFIED   | File exists; contains `ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT ''`                |
| `shared/schema.ts`                                                            | faviconUrl Drizzle field                      | VERIFIED   | Line 685: `faviconUrl: text("favicon_url").default('')`                                     |
| `client/src/components/admin/shared/types.ts`                                 | Updated CompanySettingsData interface         | VERIFIED   | Lines 61-64: all four new fields present with `string \| null` types                        |
| `server/routes/company.ts`                                                    | Updated publicCompanySettingsFallback         | VERIFIED   | Lines 62-65: all four fields in fallback object                                             |
| `client/src/hooks/use-seo.ts`                                                 | Favicon reads faviconUrl field                | VERIFIED   | Interface has `faviconUrl: string \| null`; favicon block uses `settings.faviconUrl`        |
| `server/lib/seo-injector.ts`                                                  | {{FAVICON_URL}} token in token map            | VERIFIED   | Line 109: `"{{FAVICON_URL}}": escapeAttr(settings?.faviconUrl \|\| "/favicon.png")`         |
| `client/index.html`                                                           | Tokenized favicon link tag                    | VERIFIED   | Line 29: `<link rel="icon" href="{{FAVICON_URL}}" />`, no `type="image/png"`                |
| `tests/seo/inject.test.mjs`                                                   | Automated tests for FAV-02 and FAV-03         | VERIFIED   | Lines 191-230: FAV-02, FAV-03, FAV-03b test blocks present; all three PASS when executed    |
| `client/src/components/admin/LegalBrandingTab.tsx`                            | Legal & Branding tab component with 4 sections| VERIFIED   | Exports `LegalBrandingTab`; contains RadioGroup, Textarea, Separator, Globe, favicon upload handler; 3 correct radio values; textarea `min-h-[400px] font-mono text-sm`; no DOMPurify |
| `client/src/components/admin/CompanySettingsSection.tsx`                      | Updated to render LegalBrandingTab            | VERIFIED   | Line 20: import; lines 441-446: render with all 4 props (settings, updateField, getAccessToken, isSaving) |
| `client/src/pages/PrivacyPolicy.tsx`                                          | DB-driven privacy policy page                 | VERIFIED   | 56 lines; `useQuery(['/api/company-settings'])`, `hasContent` guard, `dangerouslySetInnerHTML`, `LegalEmptyState`; no Skleanings content, no DOMPurify |
| `client/src/pages/TermsOfService.tsx`                                         | DB-driven terms of service page               | VERIFIED   | 56 lines; `useQuery(['/api/company-settings'])`, `hasContent` guard, `dangerouslySetInnerHTML`, `LegalEmptyState`; no Skleanings content, no DOMPurify |

### Key Link Verification

| From                                       | To                                       | Via                                        | Status   | Details                                                                                     |
|--------------------------------------------|------------------------------------------|--------------------------------------------|----------|---------------------------------------------------------------------------------------------|
| `LegalBrandingTab.tsx`                     | `CompanySettingsSection.tsx`             | props: settings, updateField, getAccessToken, isSaving | WIRED | Lines 441-446 in CompanySettingsSection pass all four expected props                        |
| `PrivacyPolicy.tsx`                        | `/api/company-settings`                  | useQuery                                   | WIRED    | Line 26: `queryKey: ['/api/company-settings']`; `content` derived from `settings?.privacyPolicyContent` |
| `TermsOfService.tsx`                       | `/api/company-settings`                  | useQuery                                   | WIRED    | Line 26: `queryKey: ['/api/company-settings']`; `content` derived from `settings?.termsOfServiceContent` |
| `seo-injector.ts`                          | `client/index.html`                      | token replacement loop                     | WIRED    | `{{FAVICON_URL}}` present in both token map and HTML template                               |
| `server/routes/company.ts`                 | `shared/schema.ts`                       | Drizzle select via storage.getCompanySettings | WIRED | `storage.getCompanySettings()` runs `db.select().from(companySettings)` — faviconUrl included automatically since it is in the schema |

### Data-Flow Trace (Level 4)

| Artifact               | Data Variable              | Source                            | Produces Real Data | Status    |
|------------------------|----------------------------|-----------------------------------|--------------------|-----------|
| `PrivacyPolicy.tsx`    | `settings.privacyPolicyContent` | `GET /api/company-settings` → `storage.getCompanySettings()` → `db.select().from(companySettings)` | Yes — queries DB row | FLOWING |
| `TermsOfService.tsx`   | `settings.termsOfServiceContent` | Same endpoint and storage path   | Yes — queries DB row | FLOWING |
| `LegalBrandingTab.tsx` | `settings.faviconUrl`, `settings.serviceDeliveryModel`, etc. | Passed via props from CompanySettingsSection, which fetches from `/api/company-settings` | Yes — parent component fetches from DB | FLOWING |

### Behavioral Spot-Checks

| Behavior                                               | Command                                                      | Result                                                   | Status  |
|--------------------------------------------------------|--------------------------------------------------------------|----------------------------------------------------------|---------|
| inject.test.mjs FAV-02: custom faviconUrl in href      | `npx tsx tests/seo/inject.test.mjs`                          | `PASS: FAV-02 — faviconUrl set → custom URL in favicon href` | PASS |
| inject.test.mjs FAV-03: empty faviconUrl → /favicon.png | `npx tsx tests/seo/inject.test.mjs`                         | `PASS: FAV-03 — faviconUrl empty → /favicon.png fallback` | PASS |
| inject.test.mjs FAV-03b: null faviconUrl → /favicon.png | `npx tsx tests/seo/inject.test.mjs`                         | `PASS: FAV-03b — faviconUrl null → /favicon.png fallback` | PASS |
| TypeScript compilation clean                           | `npm run check`                                              | Exits 0 with no errors                                   | PASS    |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                  | Status    | Evidence                                                                   |
|-------------|-------------|------------------------------------------------------------------------------|-----------|----------------------------------------------------------------------------|
| FAV-01      | 17-01, 17-03 | Admin can set a favicon URL in company settings (upload or external link)    | SATISFIED | `LegalBrandingTab.tsx` favicon upload section; `faviconUrl` field in schema, types, state, and fallback |
| FAV-02      | 17-01, 17-02 | Platform serves `/favicon.ico` dynamically from `companySettings.faviconUrl` | SATISFIED | `{{FAVICON_URL}}` token in seo-injector.ts; `client/index.html` uses token; inject.test.mjs FAV-02 PASS |
| FAV-03      | 17-02       | When `faviconUrl` is empty, platform falls back gracefully                   | SATISFIED | `settings?.faviconUrl \|\| "/favicon.png"` in seo-injector.ts; inject.test.mjs FAV-03 + FAV-03b PASS |
| WLTYPE-02   | 17-01, 17-03 | Admin can set the service delivery model in Company Settings                 | SATISFIED | `LegalBrandingTab.tsx` RadioGroup with 3 correct values; `updateField('serviceDeliveryModel', value)` wired |
| LEGAL-02    | 17-01, 17-03 | Admin can edit Privacy Policy and Terms content in the admin section         | SATISFIED | Both Textareas in `LegalBrandingTab.tsx` bind to `privacyPolicyContent` and `termsOfServiceContent` via `updateField` |
| LEGAL-03    | 17-03       | `/privacy-policy` and `/terms-of-service` pages render content from DB       | SATISFIED | Both pages query `/api/company-settings`, check `hasContent`, render via `dangerouslySetInnerHTML` |
| LEGAL-04    | 17-03       | Empty legal fields show a placeholder message rather than breaking           | SATISFIED | `LegalEmptyState` component renders "Our {label} is being finalized." when `hasContent` is false |

No orphaned requirements found. All 7 requirement IDs declared in plan frontmatter are accounted for and satisfied.

### Anti-Patterns Found

None. Scanned `LegalBrandingTab.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `seo-injector.ts`, and `use-seo.ts` for TODO/FIXME/empty implementations/hardcoded stubs. The word "placeholder" appears in `LegalBrandingTab.tsx` only as HTML `<textarea placeholder="...">` attribute and user-facing help text — not a code stub.

### Human Verification Required

#### 1. Admin favicon upload flow

**Test:** Open http://localhost:5000/admin → Company Settings → scroll to "Legal & Branding" card → click "Upload Favicon" → select a .png or .ico file
**Expected:** Spinner appears during upload; "Asset uploaded and saved" toast fires; 48×48 preview image replaces the dashed placeholder; hard-refresh shows the preview still present; browser tab favicon updates to the uploaded image
**Why human:** File upload requires a live browser, Supabase signed URL, and browser favicon rendering — not testable with grep/static analysis

#### 2. Service delivery model radio auto-save

**Test:** Click "Customer Comes In" radio in the Legal & Branding section → wait ~1 second → refresh the page
**Expected:** Auto-save indicator fires; after refresh, "Customer Comes In" is still selected
**Why human:** Debounce timing and DB persistence require a running app with applied migrations

#### 3. Legal content public page round-trip

**Test:** Paste text in the "Privacy Policy Content" textarea → wait ~1 second for auto-save → navigate to http://localhost:5000/privacy-policy
**Expected:** The pasted text is rendered in the page body (not the empty-state card); clearing the textarea and waiting for auto-save switches the page back to the "Our privacy policy is being finalized." card
**Why human:** DB read/write round-trip requires a live server with the `20260430000000_add_favicon_url.sql` migration applied

**Prerequisite for all human tests:** Both pending migrations (`20260428000000_add_white_label_columns.sql` and `20260430000000_add_favicon_url.sql`) must be applied via `supabase db push` before testing.

### Gaps Summary

No gaps. All seven automated truths verified. All artifacts exist, are substantive, and are wired. Data flows from the database through the storage layer to the API route and into both the admin components and the public legal pages. Three human verification items remain — these are interaction flows that require a live browser, running server, and applied DB migration, none of which can be verified statically.

---

_Verified: 2026-04-30_
_Verifier: Claude (gsd-verifier)_
