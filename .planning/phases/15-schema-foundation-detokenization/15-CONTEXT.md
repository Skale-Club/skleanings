# Phase 15: Schema Foundation & Detokenization — Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add the three missing `companySettings` columns to the database, run the Supabase migration, and replace all hardcoded `"Skleanings"` brand strings in the codebase so the platform reads tenant identity from the DB at runtime.

**In scope:**
- Supabase migration adding `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent` to `company_settings`
- Drizzle schema + TypeScript types for the new columns
- Browser tab title (`document.title`) updated dynamically from `companySettings.companyName`
- localStorage visitor key made slug-derived (`${slug}_visitor_id`) — updates `use-utm-capture.ts`, `ChatWidget.tsx`, `BookingPage.tsx`
- `server/lib/openrouter.ts` reads `companyName` via parameter injection (caller passes from DB)
- Replace all `|| "Skleanings"` / `|| "contact@skleanings.com"` fallbacks with `|| ""` in React component files

**Out of scope (other phases):**
- Admin UI for `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent` fields — Phase 17
- Server-side SEO meta injection into `index.html` — Phase 16
- Favicon dynamic serving — Phase 17
- Telegram / Thumbtack server-side integration strings — not in `client/src/` scope; deferred

</domain>

<decisions>
## Implementation Decisions

### Schema — New Columns
- **D-01:** Add three columns to the `company_settings` table via a new Supabase migration file:
  - `service_delivery_model text DEFAULT 'at-customer'` — values: `'at-customer'`, `'customer-comes-in'`, `'both'`
  - `privacy_policy_content text DEFAULT ''`
  - `terms_of_service_content text DEFAULT ''`
  - All nullable with safe empty defaults so existing rows are unaffected.
- **D-02:** Update `shared/schema.ts` — add `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent` to the `companySettings` Drizzle table definition. Regenerate `CompanySettings` type and `insertCompanySettingsSchema`.

### Browser Tab Title (DETOK-01)
- **D-03:** `ThemeContext.tsx` stays theme-only — no `companyName`/`companyEmail` fields added there. `CompanySettingsContext` already provides these from the API.
- **D-04:** Add a single `useEffect` in `App.tsx` (after the existing `useCompanySettings()` call) that sets `document.title` when `settings.companyName` changes. Format: `settings.companyName || ""`. No separate hook or ThemeContext extension needed.

### localStorage Visitor Key (DETOK-02)
- **D-05:** The canonical visitor key becomes `${slug}_visitor_id` where `slug` is `settings.slug` (or a suitable unique identifier from `companySettings`). If no slug field exists in the schema, derive from `companyName` lowercased + slugified, or use `settings.id` as a stable fallback.
- **D-06:** Modify `useUTMCapture` to call `useCompanySettings()` and derive the key from there. Gate the capture logic on `isReady` — if settings haven't loaded, the `useEffect` dependency array includes `isReady` and re-runs when they do. Accept the brief first-load window; UTM capture completes before any meaningful user action.
- **D-07:** Export a `getVisitorIdKey(slug: string): string` helper from `use-utm-capture.ts` so `ChatWidget.tsx` and `BookingPage.tsx` use the same derived key — no key divergence between capture and read sites.
- **D-08:** `ThemeContext.tsx` also has `THEME_STORAGE_KEY = 'skleanings-admin-theme'`. This is a non-display localStorage key — leave it unchanged in Phase 15 (it's admin-only, not a customer-facing brand string, and changing it would log out all admins on next deploy). Defer to a future cleanup phase if needed.

### openrouter.ts (SERV-01)
- **D-09:** Add a `companyName: string` parameter to the blog-generation function(s) in `server/lib/openrouter.ts`. The caller (blog cron job or route handler) fetches `companySettings` from storage and passes `companyName`. Removes the `|| "Skleanings"` fallback — if the caller has no name, it passes `""`.
- **D-10:** Do NOT add a `storage` import or DB fetch inside `openrouter.ts` — keeps it a pure utility with no DB dependency.

### Fallback Defaults (DETOK-03)
- **D-11:** Replace all `|| "Skleanings"` and `|| "contact@skleanings.com"` fallbacks in `client/src/` React component files with `|| ""`. White-label behavior: show nothing when unconfigured, never show the wrong tenant name.
- **D-12:** Success criterion for DETOK-03: `grep -r '"Skleanings"' client/src/ --include="*.tsx" --include="*.ts"` returns zero matches in display/logic positions. Comments in code may remain.
- **D-13:** Server-side integration files (`telegram.ts`, `thumbtack.ts`) are out of scope for this phase — the DETOK-03 success criteria targets `client/src/` React component files only.

### Claude's Discretion
- Migration file naming: `supabase/migrations/20260428000000_add_white_label_columns.sql` (or next sequential timestamp)
- Column order in migration: `service_delivery_model`, `privacy_policy_content`, `terms_of_service_content`
- If `companySettings` has no `slug` field, derive the visitor key from `companyName` using a simple slugify (lowercase, replace spaces with `-`, strip non-alphanumeric). Researcher to verify whether `slug` exists or needs to be added.
- Exact file order of changes (schema → migration → client detokenization → server) — planner decides

### Folded Todos
None — todo match returned 0 candidates for Phase 15.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Migration
- `shared/schema.ts` line 633 — `companySettings` table definition and existing columns
- `shared/schema.ts` line 683 — `insertCompanySettingsSchema` and `CompanySettings` type
- `supabase/migrations/` — existing migration files; new migration follows the same naming convention
- `.planning/ROADMAP.md` Phase 15 — success criteria and requirement list (WLTYPE-01, LEGAL-01, DETOK-01–03, SERV-01)
- `.planning/REQUIREMENTS.md` v2.0 White Label section — full requirement text

### Client Files to Detokenize
- `client/src/context/ThemeContext.tsx` — THEME_STORAGE_KEY has 'skleanings-' prefix (do NOT change per D-08)
- `client/src/context/CompanySettingsContext.tsx` — existing API-driven context; source of truth for companyName/companyEmail in React
- `client/src/App.tsx` — add `document.title` effect here (D-04); `useCompanySettings()` already called at line ~32
- `client/src/hooks/use-utm-capture.ts` — `VISITOR_ID_KEY` constant to replace with derived key (D-05–D-07)
- `client/src/components/chat/ChatWidget.tsx` line 538 — direct `localStorage.getItem('skleanings_visitor_id')` call
- `client/src/pages/BookingPage.tsx` lines 143, 195 — direct `localStorage.getItem('skleanings_visitor_id')` calls
- `client/src/pages/PrivacyPolicy.tsx` lines 10–11 — fallback `|| "Skleanings"` / `|| "contact@skleanings.com"`
- `client/src/pages/TermsOfService.tsx` lines 27–28 — same fallback pattern
- `client/src/components/admin/AdminHeader.tsx` line 14 — `companyName || 'Skleanings'` fallback

### Server Files to Update
- `server/lib/openrouter.ts` lines 22, 47 — `OPENROUTER_APP_TITLE || "Skleanings"` → parameter injection (D-09)
- Caller of `openrouter.ts` blog generation — researcher to identify cron/route file that calls it

### Codebase Conventions
- `.planning/codebase/CONVENTIONS.md` — naming, import order, error handling patterns
- `.planning/codebase/ARCHITECTURE.md` — storage layer, data flow patterns

### Build Constraints (from roadmap)
1. Supabase CLI only for migrations — never drizzle-kit push
2. `companySettings` is a singleton row — all reads must handle missing row with safe defaults, never crash

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`useCompanySettings()` hook** — from `CompanySettingsContext.tsx`. Already used in `App.tsx`, `Footer.tsx`, `BrandColorInjector.tsx`. Use this for both the `document.title` effect (D-04) and the localStorage key derivation in `useUTMCapture` (D-06).
- **`CompanySettingsContext.isReady`** — already used in `App.tsx` (line ~32) to gate app rendering. Reuse as the gate condition in `useUTMCapture`.
- **`apiRequest` helper** — not needed for this phase; all reads go through React Query / the existing storage layer.

### Established Patterns
- **`useEffect` + `useCompanySettings()`** — pattern already established in `BrandColorInjector.tsx` for injecting CSS custom properties. Follow the same pattern for `document.title`.
- **React Query invalidation** — not needed here; `companySettings` reads are already in context.
- **Drizzle schema extension** — follow the exact pattern of existing columns in `companySettings` table (line 633). New columns go after existing ones; types collocated with table definition per Phase 10 decision.

### Integration Points
- `App.tsx` — one new `useEffect` for document.title; one update to `AnalyticsProvider` mounting if UTM capture needs slug dependency
- `use-utm-capture.ts` — add `useCompanySettings()` call; export `getVisitorIdKey` helper
- `openrouter.ts` — add parameter to function signature; update callers
- Supabase migration — new file in `supabase/migrations/`
- `shared/schema.ts` — three new column definitions + type regeneration

### Constraints
- `ChatWidget.tsx` and `BookingPage.tsx` read the visitor key outside of `useUTMCapture` — they need to call `useCompanySettings()` themselves or use the exported `getVisitorIdKey` helper. Both are React components inside `CompanySettingsProvider`, so `useCompanySettings()` is available.
- Visitor key change is a one-way migration: any visitor who captured a session under `skleanings_visitor_id` won't have their attribution linked under the new key. Acceptable for Phase 15 — attribution for new visitors from deploy onward uses the correct key.

</code_context>

<specifics>
## Specific Ideas

- Researcher should verify: does `companySettings` already have a `slug` or `identifier` column, or does D-05 require deriving from `companyName`? This affects how `getVisitorIdKey` is implemented.
- The `ThemeContext.tsx` `THEME_STORAGE_KEY = 'skleanings-admin-theme'` is intentionally left unchanged (D-08) — do not surface this as a gap in verification.

</specifics>

<deferred>
## Deferred Ideas

- **Admin-login-theme localStorage key** (`'skleanings-admin-theme'` in ThemeContext) — not a display string; changing it would force all admins to re-select their theme preference on next load. Defer to a future white-label cleanup phase.
- **Telegram integration string** (`server/routes/integrations/telegram.ts` line 98) — server-side, not in `client/src/`; deferred per D-13.
- **Thumbtack integration string** (`server/routes/integrations/thumbtack.ts` line 45) — same; deferred per D-13.
- **Document title per-page routing** — Phase 15 sets a global title from `companyName`; per-page title (e.g. "Services | [Company]") is Phase 16 territory as part of SEO meta injection.

### Reviewed Todos (not folded)
None — todo match returned 0 candidates.

</deferred>

---

*Phase: 15-schema-foundation-detokenization*
*Context gathered: 2026-04-28*
