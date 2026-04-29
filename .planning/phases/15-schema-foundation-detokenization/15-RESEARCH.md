# Phase 15: Schema Foundation & Detokenization - Research

**Researched:** 2026-04-28
**Domain:** Drizzle/Postgres schema migration + React white-label detokenization
**Confidence:** HIGH

## Summary

Phase 15 has two technical halves: (1) a **schema-and-migration extension** of the singleton `company_settings` table with three new nullable text columns (`service_delivery_model`, `privacy_policy_content`, `terms_of_service_content`), and (2) a **detokenization sweep** that removes every `"Skleanings"` / `"contact@skleanings.com"` literal from `client/src/` plus the `OPENROUTER_APP_TITLE || "Skleanings"` fallback in `server/lib/openrouter.ts`.

All design questions raised by CONTEXT.md were verified against the live codebase. Critical findings: `companySettings` has **no `slug` column** — D-05's fallback path is the actual path. The new migration timestamp is `20260428000000` (next sequential after the Phase 10 UTM migration). `useCompanySettings()` exposes `isReady` from `useQuery.isFetched` and is mounted inside the provider tree before all three visitor-key read sites — `useUTMCapture`, `ChatWidget`, `BookingPage`. The `openrouter.ts` callers are limited and known: one express route handler (`server/routes/integrations/ai.ts`) and one chat message handler that reaches it via dependency injection (`chatDeps.getOpenRouterClient`).

**Primary recommendation:** Implement in strict order — (1) migration SQL, (2) Drizzle schema extension, (3) `getVisitorIdKey(slug)` helper + `useUTMCapture` rewrite, (4) ChatWidget + BookingPage call sites, (5) detokenization edits, (6) openrouter parameter injection. Defer the egg-info-style risk: `npm run db:push` is **not** required — Drizzle types regenerate on TS recompile because `$inferSelect` is type-only. Use `supabase db push` (Supabase CLI) for the actual DB migration per Build Constraint #1.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema — New Columns**
- **D-01:** Add three columns to the `company_settings` table via a new Supabase migration file:
  - `service_delivery_model text DEFAULT 'at-customer'` — values: `'at-customer'`, `'customer-comes-in'`, `'both'`
  - `privacy_policy_content text DEFAULT ''`
  - `terms_of_service_content text DEFAULT ''`
  - All nullable with safe empty defaults so existing rows are unaffected.
- **D-02:** Update `shared/schema.ts` — add `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent` to the `companySettings` Drizzle table definition. Regenerate `CompanySettings` type and `insertCompanySettingsSchema`.

**Browser Tab Title (DETOK-01)**
- **D-03:** `ThemeContext.tsx` stays theme-only — no `companyName`/`companyEmail` fields added there. `CompanySettingsContext` already provides these from the API.
- **D-04:** Add a single `useEffect` in `App.tsx` (after the existing `useCompanySettings()` call) that sets `document.title` when `settings.companyName` changes. Format: `settings.companyName || ""`. No separate hook or ThemeContext extension needed.

**localStorage Visitor Key (DETOK-02)**
- **D-05:** The canonical visitor key becomes `${slug}_visitor_id` where `slug` is `settings.slug` (or a suitable unique identifier from `companySettings`). If no slug field exists in the schema, derive from `companyName` lowercased + slugified, or use `settings.id` as a stable fallback.
- **D-06:** Modify `useUTMCapture` to call `useCompanySettings()` and derive the key from there. Gate the capture logic on `isReady` — if settings haven't loaded, the `useEffect` dependency array includes `isReady` and re-runs when they do. Accept the brief first-load window; UTM capture completes before any meaningful user action.
- **D-07:** Export a `getVisitorIdKey(slug: string): string` helper from `use-utm-capture.ts` so `ChatWidget.tsx` and `BookingPage.tsx` use the same derived key — no key divergence between capture and read sites.
- **D-08:** `ThemeContext.tsx` also has `THEME_STORAGE_KEY = 'skleanings-admin-theme'`. This is a non-display localStorage key — leave it unchanged in Phase 15.

**openrouter.ts (SERV-01)**
- **D-09:** Add a `companyName: string` parameter to the blog-generation function(s) in `server/lib/openrouter.ts`. The caller (blog cron job or route handler) fetches `companySettings` from storage and passes `companyName`. Removes the `|| "Skleanings"` fallback — if the caller has no name, it passes `""`.
- **D-10:** Do NOT add a `storage` import or DB fetch inside `openrouter.ts` — keeps it a pure utility with no DB dependency.

**Fallback Defaults (DETOK-03)**
- **D-11:** Replace all `|| "Skleanings"` and `|| "contact@skleanings.com"` fallbacks in `client/src/` React component files with `|| ""`.
- **D-12:** Success criterion for DETOK-03: `grep -r '"Skleanings"' client/src/ --include="*.tsx" --include="*.ts"` returns zero matches in display/logic positions. Comments may remain.
- **D-13:** Server-side integration files (`telegram.ts`, `thumbtack.ts`) are out of scope.

### Claude's Discretion
- Migration file naming: `supabase/migrations/20260428000000_add_white_label_columns.sql` (or next sequential timestamp)
- Column order in migration: `service_delivery_model`, `privacy_policy_content`, `terms_of_service_content`
- If `companySettings` has no `slug` field, derive the visitor key from `companyName` using a simple slugify, or use `settings.id` as a stable fallback. **(Researcher confirmed: NO slug field exists.)**
- Exact file order of changes — planner decides

### Deferred Ideas (OUT OF SCOPE)
- **Admin-login-theme localStorage key** (`'skleanings-admin-theme'` in ThemeContext) — defer to a future white-label cleanup phase.
- **Telegram integration string** (`server/routes/integrations/telegram.ts` line 98) — server-side, deferred per D-13.
- **Thumbtack integration string** (`server/routes/integrations/thumbtack.ts` line 45) — deferred per D-13.
- **Document title per-page routing** — Phase 16 territory.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WLTYPE-01 | `companySettings` has a `serviceDeliveryModel` field (values: `at-customer`, `customer-comes-in`, `both`) | Schema audit confirms field absent — migration adds `service_delivery_model TEXT DEFAULT 'at-customer'`; Drizzle column `serviceDeliveryModel: text("service_delivery_model").default('at-customer')` |
| LEGAL-01 | `companySettings` has `privacyPolicyContent` and `termsOfServiceContent` text fields | Schema audit confirms both absent — migration adds two `TEXT DEFAULT ''` columns; mirrored in Drizzle |
| DETOK-01 | `ThemeContext.tsx` initializes companyName/companyEmail from API, not hardcoded defaults | Verified — `ThemeContext` does NOT contain companyName/companyEmail (D-03 confirms). Real DETOK-01 work: `App.tsx` adds a `useEffect` that sets `document.title` from `settings.companyName` |
| DETOK-02 | localStorage visitor key replaced with dynamic key derived from company slug | Three call sites identified: `use-utm-capture.ts:4,40,44`, `ChatWidget.tsx:538`, `BookingPage.tsx:143,195`. No `slug` column exists — fallback chain documented below |
| DETOK-03 | All hardcoded `"Skleanings"` literals in React components replaced with `companySettings` values | Definitive grep produced 8 active matches across 7 files (see Hardcoded Inventory section) |
| SERV-01 | `server/lib/openrouter.ts` reads app title from `companySettings.companyName` | Two literal sites identified (lines 22, 47). Three callers across two files (`ai.ts`, `message-handler.ts` via DI) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

CLAUDE.md establishes the following directives that this phase MUST honor:

- **Tech stack:** Express + Drizzle ORM + PostgreSQL on the server; React 18 + Vite + Wouter + React Query + shadcn/ui on the client.
- **Type-safe API pattern:** `shared/routes.ts` is the source of truth for endpoint signatures with Zod schemas — both client and server import from it.
- **Shared schema discipline:** Database tables in `shared/schema.ts` generate both TypeScript types (`typeof table.$inferSelect`) and Zod validators (`createInsertSchema`/`insertXSchema`) via `drizzle-zod`. New columns MUST follow this pattern.
- **Storage layer:** All database operations go through `server/storage.ts` implementing `IStorage`. Routes call storage methods, not raw SQL. Phase 15 does NOT introduce new storage methods (column additions auto-flow through existing `getCompanySettings`/`upsertCompanySettings`), but the planner must verify those existing methods don't have explicit column whitelists that would drop the new fields.
- **State management:** React Query for server state (used by `CompanySettingsContext`), React Context for cart/auth/theme/companySettings — no Redux. The detokenization work integrates with the **existing** `useCompanySettings()` consumer pattern.
- **Brand fallback policy (D-11 in CONTEXT.md):** Replace `|| "Skleanings"` with `|| ""` — never the wrong tenant name. CLAUDE.md's "Brand Guidelines" reference Skleanings-specific colors but those are **CSS vars / design tokens**, NOT JS string literals — out of scope for detokenization.

## Standard Stack

### Core (already in use, version-pinned in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.39.3 | Schema definition + queries | Existing — used across `shared/schema.ts` |
| drizzle-zod | 0.7.0 | Generate Zod schemas from Drizzle tables | Existing — `insertCompanySettingsSchema` pattern |
| @tanstack/react-query | 5.60.5 | API state in `CompanySettingsContext` | Existing — `useQuery` already wraps `/api/company-settings` |
| Supabase CLI | (project-local) | Apply migrations from `supabase/migrations/` | Build Constraint #1 — never drizzle-kit push |

**Installation:** Nothing new to install. All Phase 15 work uses libraries already in the dependency tree.

**Version verification:** No new packages — version verification N/A. Drizzle 0.39.3 supports `text(...).default('value')` on column definitions which is the only Drizzle API surface this phase touches.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `text` column for `service_delivery_model` | Postgres `ENUM` type | ENUM forces a follow-up migration to add new variants (e.g., a future `mobile-only` mode); existing project precedent uses **plain TEXT for enum-like values** (see `time_format text default '12h'`, `og_type text default 'website'`, `twitter_card text default 'summary_large_image'` in `shared/schema.ts:652,665,668`). **Use TEXT.** Optionally add a CHECK constraint, but no existing column in `companySettings` does so — skip CHECK for consistency. |
| Adding `slug` column to companySettings now | Use `companyName`-derived slug | Adding `slug` is white-label scope creep — not in CONTEXT.md decisions. Phase 17 may add it explicitly. Use the deterministic `companyName` fallback. |
| Server-side fetch inside `openrouter.ts` | Parameter injection (D-10) | DI pattern preserves the file as a pure utility; matches existing `chatDeps` injection model already established in `server/routes/chat/dependencies.ts` |

## Architecture Patterns

### Recommended Project Structure
No structural changes required. All edits land in existing files:

```
shared/
└── schema.ts                          # +3 columns + regenerate types

supabase/migrations/
└── 20260428000000_add_white_label_columns.sql  # NEW

client/src/
├── App.tsx                            # +useEffect for document.title
├── hooks/
│   └── use-utm-capture.ts             # rewrite: uses useCompanySettings + exports getVisitorIdKey
├── components/
│   ├── chat/ChatWidget.tsx            # line 538: replace literal with helper
│   └── admin/AdminHeader.tsx          # line 14: || '' fallback
└── pages/
    ├── BookingPage.tsx                # lines 143, 195: replace literal with helper
    ├── PrivacyPolicy.tsx              # lines 10, 11: || '' fallback
    └── TermsOfService.tsx             # lines 27, 28: || '' fallback

server/
├── lib/openrouter.ts                  # add companyName param to client factory
├── routes/integrations/ai.ts          # update getOpenRouterClient call sites
└── routes/chat/
    ├── dependencies.ts                # update getOpenRouterClient signature in DI surface
    └── message-handler.ts             # pass companyName to chatDeps.getOpenRouterClient
```

### Pattern 1: Drizzle column extension (proven in this codebase)
**What:** Add column to existing `pgTable` definition + matching SQL migration.
**When to use:** Always — Drizzle table is the TypeScript truth, SQL migration is the database truth, both must agree.
**Example (matches existing precedent in `shared/schema.ts:633-680`):**
```typescript
// shared/schema.ts — appended to existing companySettings pgTable
export const companySettings = pgTable("company_settings", {
  // ... existing columns ...
  homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({}),
  // White-label columns (Phase 15)
  serviceDeliveryModel: text("service_delivery_model").default('at-customer'),
  privacyPolicyContent: text("privacy_policy_content").default(''),
  termsOfServiceContent: text("terms_of_service_content").default(''),
});
```
Drizzle types auto-regenerate when `tsc` runs (or any TS-aware editor reload). **`npm run db:push` is NOT required and MUST NOT be run** — it bypasses the Supabase migration history (Build Constraint #1).

### Pattern 2: SQL migration with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
**What:** Idempotent ALTER TABLE that adds columns with safe defaults.
**Example (matches `supabase/migrations/20260402100000_add_stripe_fields.sql`):**
```sql
-- Migration: add_white_label_columns
-- Phase 15: Schema Foundation & Detokenization
-- Adds service delivery model + legal page content fields to company_settings.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS service_delivery_model TEXT DEFAULT 'at-customer',
  ADD COLUMN IF NOT EXISTS privacy_policy_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_of_service_content TEXT DEFAULT '';
```
**Why this exact form:**
- `IF NOT EXISTS` matches all existing migrations (idempotency on retry).
- `public.` schema qualifier matches the stripe-fields migration (line 1).
- Lowercase keyword style matches recent migrations (`add_bookings_user_id.sql`, `add_stripe_fields.sql`).
- Default values are non-null strings — existing rows get the default automatically; no backfill UPDATE needed.
- One ALTER TABLE with comma-separated ADD COLUMN clauses (most efficient — single table rewrite/lock).

### Pattern 3: `useCompanySettings()` consumer + `isReady` gating
**What:** React hook returning `{ settings, isLoading, isReady }` — components gate on `isReady` for first-render safety.
**Example (already used in App.tsx:32 for `useHideInitialLoader`):**
```typescript
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { useEffect } from "react";

export function useUTMCapture(): void {
  const { settings, isReady } = useCompanySettings();
  const [location] = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (!isReady) return;  // wait for company settings to load

    const slug = deriveSlug(settings);                  // see helper below
    const VISITOR_ID_KEY = getVisitorIdKey(slug);       // exported helper

    let visitorId = localStorage.getItem(VISITOR_ID_KEY);
    // ... rest of capture logic unchanged ...
  }, [location, isReady, settings]);  // re-run when settings load
}

export function getVisitorIdKey(slug: string): string {
  return `${slug || 'visitor'}_visitor_id`;  // safe fallback if slug is empty
}

function deriveSlug(settings: CompanySettings | null): string {
  if (!settings) return '';
  // No `slug` column on companySettings — derive from companyName.
  // Stable fallback: settings.id (always present on a saved row).
  const name = settings.companyName?.trim() || '';
  if (name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')   // non-alphanumeric → dash
      .replace(/^-+|-+$/g, '');       // strip leading/trailing dashes
  }
  return `tenant-${settings.id}`;     // numeric singleton id
}
```

### Anti-Patterns to Avoid
- **Don't add a `slug` column in this phase** — out of CONTEXT.md scope; would expand the migration's surface area and make column count harder to verify.
- **Don't run `npm run db:push`** — it would push the Drizzle schema directly via drizzle-kit, bypassing the Supabase migration file. Build Constraint #1 explicitly forbids this. Apply via `supabase db push`.
- **Don't import `storage` into `server/lib/openrouter.ts`** (D-10) — would make the file a heavy module with side effects and break the chat-dependencies DI pattern.
- **Don't change `THEME_STORAGE_KEY`** in `ThemeContext.tsx:15` — D-08 explicitly defers this; admin theme localStorage is non-display state.
- **Don't migrate the existing `skleanings_visitor_id` localStorage value** to the new derived key — accepted attribution disconnect per CONTEXT.md `<code_context>` constraint and Risks section below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slugifying `companyName` | Custom regex with hand-rolled Unicode handling | Inline `.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')` | Tenant names are likely ASCII English; full Unicode slug normalization (e.g., `slugify` npm package) is unnecessary. The existing project already has `slug: text("slug").notNull().unique()` columns elsewhere (categories, subcategories) — they are admin-set strings, not auto-derived. Match that simplicity. |
| Drizzle type regeneration | Custom codegen script | `tsc` (already in `npm run check`) | `$inferSelect` is type-only; types update on next TS compile. No build step required. |
| Postgres ENUM for delivery model | `pgEnum('service_delivery_model', [...])` | `text(...).default('at-customer')` | Project precedent (3 existing columns) uses TEXT for enum-like values. Adding a pgEnum requires a separate migration to extend variants and complicates Drizzle type inference. |
| localStorage migration script | One-shot effect that copies `skleanings_visitor_id` to new key | **Do nothing** — accept disconnect | CONTEXT.md `<code_context>` line 127 explicitly accepts this as a one-way migration. New visitors from deploy onward use correct key; pre-existing visitors are a thin slice with no business-critical attribution loss. |

**Key insight:** Phase 15 is intentionally minimal-surface-area. Every "should we also..." impulse should be checked against CONTEXT.md decisions; if not in D-01..D-13, defer.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `localStorage["skleanings_visitor_id"]` on every existing visitor's browser | **No action** — D-05/D-06 establish a new derived key; pre-existing entries are accepted as orphaned per CONTEXT.md `<code_context>` line 127. New visitors get the new key on first load. |
| Live service config | None — `companySettings` table has no live external service binding for the new fields. The OpenRouter `X-Title` HTTP header is read from env (`OPENROUTER_APP_TITLE`) at function call time, not registered with the OpenRouter service. | **None** — verified via `server/lib/openrouter.ts` end-to-end inspection. |
| OS-registered state | None — no Windows Task Scheduler / launchd / systemd / pm2 process names embed "Skleanings" in this codebase (Express server is started via `npm run dev` / `npm run start`, no OS-registered process names). | None — verified by absence of process-manager configuration files. |
| Secrets/env vars | `OPENROUTER_APP_TITLE` env var (optional, used at lines 22 + 47 of `openrouter.ts`). The env var **name** stays. The default fallback `"Skleanings"` is what gets removed (replaced by parameter injection). | **None** — env var name unchanged. Operators may continue setting `OPENROUTER_APP_TITLE`; if unset, the new code reads `companyName` from DB instead of falling back to the literal. |
| Build artifacts / installed packages | None — Drizzle types are inferred at compile time; no `*.egg-info`-style artifact. esbuild server bundle (`dist/index.cjs`) is regenerated on `npm run build` and contains no cached "Skleanings" string after detokenization. | **Trigger one full rebuild** after detokenization to confirm bundle no longer contains the string. |

**Canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*
**Answer:** Only the localStorage `skleanings_visitor_id` entries on existing visitors' browsers, accepted as orphaned per the CONTEXT.md design.

## Detailed Investigation Results

### 1. `companySettings` schema audit

**File: `shared/schema.ts` lines 633–681 — full column inventory:**
```
id, companyName, industry, companyEmail, companyPhone, companyAddress,
workingHoursStart, workingHoursEnd, logoMain, logoDark, logoIcon, sectionsOrder,
socialLinks, mapEmbedUrl, heroTitle, heroSubtitle, heroImageUrl, ctaText,
timeFormat, timeZone, businessHours, minimumBookingValue,
seoTitle, seoDescription, ogImage, seoKeywords, seoAuthor, seoCanonicalUrl,
seoRobotsTag, ogType, ogSiteName, twitterCard, twitterSite, twitterCreator,
schemaLocalBusiness, gtmContainerId, ga4MeasurementId, facebookPixelId,
gtmEnabled, ga4Enabled, facebookPixelEnabled, homepageContent
```

**Critical finding:** **NO `slug` column exists on `companySettings`.** A `grep -n "slug" shared/schema.ts` returns 4 hits — all on **other** tables (`categories`, `subcategories`, `serviceAreaGroups`, `serviceAreaCities`). D-05's fallback path is the actual path.

**Recommendation:** `getVisitorIdKey(slug)` consumes a precomputed slug string. The slug is derived from `settings.companyName` via inline slugify; if `companyName` is empty, fall back to `tenant-${settings.id}` (the singleton row's serial primary key, always present). The constant prefix `tenant-` ensures the key is well-formed even on a brand-new row with no name set.

**Migration timestamp:** Existing migrations end at `20260425000000_add_utm_tracking.sql`. The next sequential timestamp at the day-granularity used by recent migrations is **`20260428000000_add_white_label_columns.sql`** (matches today's date 2026-04-28; CONTEXT.md `<decisions>` discretion item suggests this exact name).

### 2. `use-utm-capture.ts` race-condition analysis

**Full file behavior (`client/src/hooks/use-utm-capture.ts`, 87 lines):**

The hook runs a single `useEffect` keyed on `location`. On first run it:
1. **Returns early in DEV** (`import.meta.env.DEV`) — **note for the planner:** Phase 15 testing in dev mode will NOT exercise the new code path. Manual production-build verification required for DETOK-02.
2. Reads `localStorage[VISITOR_ID_KEY]` (currently the literal `"skleanings_visitor_id"`).
3. Generates a UUID via `crypto.randomUUID()` if absent.
4. Reads UTM params from `window.location.search`.
5. Skips POST if no signal (no UTM, no referrer, not a new visitor).
6. Fires fire-and-forget POST to `/api/analytics/session`.

**Provider tree (verified in `client/src/App.tsx:225-253`):**
```
<ThemeProvider>
  <QueryClientProvider>
    <CompanySettingsProvider>          ← line 229
      <BrandColorInjector />
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
            <SEOProvider>
              <AnalyticsProvider>      ← contains useUTMCapture() at line 85
                <Router />              ← contains ChatWidget + BookingPage
```
**`CompanySettingsProvider` wraps everything that calls `useCompanySettings()` — confirmed.** The hook is safe to call from `useUTMCapture`, `ChatWidget`, and `BookingPage`.

**`isReady` semantics (verified in `CompanySettingsContext.tsx:18-27`):**
```typescript
const { data: settings, isLoading, isFetched } = useQuery<CompanySettings>({
  queryKey: ['/api/company-settings'],
});
const value: CompanySettingsContextValue = {
  settings: settings ?? null,
  isLoading,
  isReady: isFetched,
};
```
`isReady` is React Query's `isFetched` — **flips true on the first successful fetch OR first error**. This is more permissive than `isSuccess` and avoids deadlocks if `/api/company-settings` 500s. `isFetched` semantics match `useHideInitialLoader` at `App.tsx:30-50` which uses the same flag for the splash-screen gate.

**Race condition:** On first page load, `useUTMCapture`'s `useEffect` fires at mount. Because `isReady` is in the dependency array, it re-runs once when the fetch completes. **Pre-fetch run is gated by `if (!isReady) return;`** — no localStorage write happens until settings have loaded. The race is benign: a UTM-tagged visitor who lands at T=0 and navigates at T=200ms would trigger two effect runs (one gated, one effective), but only the second would write the visitor key + POST the session. UTM params read from `window.location.search` are still present at T=200ms because the user has not yet interacted.

**Edge case:** If `/api/company-settings` is slow (>5 seconds) and the user navigates before `isReady`, the visitor key never gets written. **Acceptable** — this is the same behavior as the splash-screen gate, which already blocks the entire UI render until `isReady`.

**Recommended `getVisitorIdKey` signature:**
```typescript
export function getVisitorIdKey(slug: string): string {
  return `${slug || 'visitor'}_visitor_id`;
}
```
**Recommended slug-derivation helper (NOT exported — internal to `use-utm-capture.ts`):**
```typescript
function deriveCompanySlug(settings: CompanySettings | null): string {
  if (!settings) return '';
  const name = settings.companyName?.trim() ?? '';
  if (name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  return `tenant-${settings.id}`;
}
export function getVisitorIdKey(slug: string): string { return `${slug || 'visitor'}_visitor_id`; }
```
**Consumers (ChatWidget, BookingPage):** call `useCompanySettings()` themselves, derive the slug, and pass to `getVisitorIdKey(slug)`. **Do not export `deriveCompanySlug`** unless it becomes the single source of truth — current 3-call-site count is small enough that planner can decide whether to colocate the helper in `use-utm-capture.ts` and export both, or extract to `client/src/lib/visitor-key.ts`.

**Strong recommendation:** Extract slug derivation + key construction into a tiny `client/src/lib/visitor-key.ts` module exporting two functions, `deriveCompanySlug(settings)` and `getVisitorIdKey(slug)`. Reasons:
- Three React component files become consumers; the hook is no longer a logical "owner."
- Easier to grep-verify single source of truth.
- Matches existing `client/src/lib/` utilities convention (`utils.ts`, `analytics.ts`, `queryClient.ts`).

### 3. `openrouter.ts` caller graph

**Exported functions in `server/lib/openrouter.ts`:**
| Function | Signature | Hardcoded literal location |
|----------|-----------|---------------------------|
| `getRuntimeOpenRouterKey()` | `() => string` | none |
| `setRuntimeOpenRouterKey(key: string)` | `(key: string) => void` | none |
| `getOpenRouterClient(apiKey?: string)` | `(apiKey?: string) => OpenAI \| null` | **line 22** — `const title = process.env.OPENROUTER_APP_TITLE \|\| "Skleanings";` |
| `listOpenRouterModels(apiKey?: string)` | `(apiKey?: string) => Promise<OpenRouterModelInfo[]>` | **line 47** — same pattern |
| `DEFAULT_OPENROUTER_CHAT_MODEL` | const string | none |

**Recommended new signatures (D-09 / D-10):**
```typescript
// keep apiKey as first param for back-compat; companyName as second
export function getOpenRouterClient(apiKey?: string, companyName?: string): OpenAI | null { ... }
export async function listOpenRouterModels(apiKey?: string, companyName?: string): Promise<OpenRouterModelInfo[]> { ... }
```
Inside both functions, replace:
```typescript
const title = process.env.OPENROUTER_APP_TITLE || "Skleanings";
```
with:
```typescript
const title = process.env.OPENROUTER_APP_TITLE || companyName || "";
```
**Why this exact precedence:** D-09 says "if the caller has no name, it passes `""`," but the existing `OPENROUTER_APP_TITLE` env var is a legitimate operator override (e.g., on a shared deployment). Preserving env-var precedence maintains operator control; falling through to the parameter and finally `""` removes the brand literal. If `title` ends up empty, the `...(title ? { "X-Title": title } : {})` spread (already present at lines 28-29 and 52-53) **silently omits the header** — OpenRouter accepts requests without `X-Title`. Verified safe.

**Caller sites:**

| Caller file | Line | Function called | Has access to `companySettings`? | Required change |
|-------------|------|-----------------|----------------------------------|-----------------|
| `server/routes/integrations/ai.ts` | 203 | `getOpenRouterClient(keyToUse)` | Yes — can `await storage.getCompanySettings()` (route handler with `storage` import already present) | `const cs = await storage.getCompanySettings(); getOpenRouterClient(keyToUse, cs?.companyName ?? undefined);` |
| `server/routes/integrations/ai.ts` | 227 | `listOpenRouterModels(keyToUse)` | Yes (same handler context) | `await storage.getCompanySettings(); listOpenRouterModels(keyToUse, cs?.companyName ?? undefined);` |
| `server/routes/chat/dependencies.ts` | 35, 44, 54, 86, 113-114 | type alias `typeof defaultGetOpenRouterClient` exposed via DI | N/A — just plumbing types | Update `ChatDependencies.getOpenRouterClient` type to match new signature; DI shape change is automatic through `typeof` |
| `server/routes/chat/message-handler.ts` | 1095 | `chatDeps.getOpenRouterClient(apiKey)` | Yes — message handler already loads `companyInfoSummary` and other settings (line 1086) | Pass `companyName` as 2nd arg; resolve from existing settings load earlier in the handler |

**Verification step:** A complete grep `getOpenRouterClient\|listOpenRouterModels` across `server/` returns the 5 sites above plus the export site. No other callers exist.

### 4. Hardcoded "Skleanings" inventory in `client/src/`

**Definitive grep `Skleanings` (case-sensitive, double-quoted in match) — 8 active matches across 7 files:**

| File:Line | Code | Classification | DETOK-03 action |
|-----------|------|----------------|-----------------|
| `components/admin/AdminHeader.tsx:14` | `{companyName \|\| 'Skleanings'}` | Display fallback | `\|\| ''` per D-11 |
| `components/admin/BlogSection.tsx:83` | `authorName: 'Skleanings'` | Form default value (admin-only seed for new blog post author) | **Edge case — see note below** |
| `components/admin/BlogSection.tsx:180` | `authorName: 'Skleanings'` | Form reset default | Same edge case |
| `components/admin/blog/BlogPostEditor.tsx:626` | `placeholder="Skleanings"` | HTML input placeholder | `placeholder=""` or remove — D-11 spirit |
| `components/admin/CompanySettingsSection.tsx:32` | `companyName: 'Skleanings'` | useState initial value (overwritten by API on load) | `companyName: ''` per D-11 |
| `components/admin/CompanySettingsSection.tsx:34` | `companyEmail: 'contact@skleanings.com'` | Same — initial-state placeholder | `companyEmail: ''` per D-11 |
| `pages/BlogPost.tsx:374` | `"name": settings?.companyName \|\| "Skleanings"` | JSON-LD publisher name fallback | `\|\| ""` per D-11 |
| `pages/PrivacyPolicy.tsx:10` | `const companyName = settings?.companyName \|\| "Skleanings";` | Display fallback | `\|\| ""` |
| `pages/PrivacyPolicy.tsx:11` | `const companyEmail = settings?.companyEmail \|\| "contact@skleanings.com";` | Display fallback | `\|\| ""` |
| `pages/TermsOfService.tsx:27` | `const companyName = settings?.companyName \|\| "Skleanings";` | Display fallback | `\|\| ""` |
| `pages/TermsOfService.tsx:28` | `const companyEmail = settings?.companyEmail \|\| "contact@skleanings.com";` | Display fallback | `\|\| ""` |

**Definitive grep `skleanings` (lowercase, all extensions) adds:**
| File:Line | Code | Classification | Action |
|-----------|------|----------------|--------|
| `context/ThemeContext.tsx:15` | `const THEME_STORAGE_KEY = 'skleanings-admin-theme';` | localStorage key (admin theme) | **Leave unchanged** per D-08 |
| `hooks/use-utm-capture.ts:4` | `const VISITOR_ID_KEY = "skleanings_visitor_id";` | localStorage key (visitor) | Replace with derived helper per D-05–D-07 |
| `components/chat/ChatWidget.tsx:538` | `localStorage.getItem('skleanings_visitor_id')` | Read site | Replace with `getVisitorIdKey(deriveCompanySlug(settings))` |
| `pages/BookingPage.tsx:143` | `localStorage.getItem('skleanings_visitor_id')` | Read site | Same |
| `pages/BookingPage.tsx:195` | `localStorage.getItem('skleanings_visitor_id')` | Read site | Same |
| `pages/AdminLogin.tsx:134` | `\|\| 'https://skleanings.com'` | URL fallback (origin redirect) | **Out of scope** — domain URL, not brand-display string. Consider deferring to Phase 17 / future cleanup. Could be replaced with `\|\| ''` but `window.location.origin` is virtually always truthy in production. |
| `components/LoginDialog.tsx:69` | `\|\| 'https://skleanings.com'` | Same pattern | Same — out of scope by same reasoning. |
| `components/admin/integrations/GHLTab.tsx:14` | `'https://lsrlnlcdrshzzhqvklqc.supabase.co/storage/v1/object/public/skleanings/ghl-logo.webp'` | Supabase Storage bucket path | **Out of scope** — bucket name is operational infrastructure, not brand-display. Renaming the bucket is a separate Supabase admin task. |

**Edge case — BlogSection authorName:** `'Skleanings'` is used as the **default author name** for newly created blog posts. The intent is "the company writes its own blog." Replacing with `''` would create blog posts with empty author. **Recommended:** Replace with `settings?.companyName ?? ''` from `useCompanySettings()` — this is the correct white-label semantic. The planner should treat this as a **read-from-context replacement, not a `|| ''` fallback**. Add a `useCompanySettings()` call to `BlogSection.tsx` and `BlogPostEditor.tsx`. Verify line 83 is in component scope (it appears to be inside `useState(...)` — need to call hook before useState). For BlogPostEditor.tsx:626 placeholder, drive from the same source (or simply remove placeholder).

**Files to edit for DETOK-03 success criterion (`client/src/` `*.tsx` `*.ts` zero `"Skleanings"` matches):**
1. `client/src/components/admin/AdminHeader.tsx`
2. `client/src/components/admin/BlogSection.tsx`
3. `client/src/components/admin/blog/BlogPostEditor.tsx`
4. `client/src/components/admin/CompanySettingsSection.tsx`
5. `client/src/pages/BlogPost.tsx`
6. `client/src/pages/PrivacyPolicy.tsx`
7. `client/src/pages/TermsOfService.tsx`

For DETOK-02 (visitor key) the additional files are:
8. `client/src/hooks/use-utm-capture.ts`
9. `client/src/components/chat/ChatWidget.tsx`
10. `client/src/pages/BookingPage.tsx`

For DETOK-01 (document.title) the file is:
11. `client/src/App.tsx`

**Total files to edit: 11.** (Plus `shared/schema.ts`, the new migration file, and 4 server files for SERV-01 = **17 file edits total.**)

### 5. Migration sequencing

**Existing migration directory listing (chronological):**
```
20260326194801_remote_schema.sql
20260326200100_fix_public_schema_drift.sql
20260327035700_add_blog_settings_and_services.sql
20260402000000_add_staff_tables.sql
20260402100000_add_stripe_fields.sql
20260402200000_add_calendar_reconnect_fields.sql
20260402300000_add_user_roles.sql
20260403000000_add_users_and_fix_blog_posts.sql
20260405000000_add_bookings_user_id.sql
20260409000000_add_contacts.sql
20260409100000_add_user_role_staff_userid.sql
20260425000000_add_utm_tracking.sql      ← most recent (Phase 10)
```

**Recommended next filename:** `20260428000000_add_white_label_columns.sql`

**SQL style observations:**
- **Mixed case usage exists**: `add_staff_tables.sql` uses UPPERCASE (`CREATE TABLE`, `ALTER TABLE`), while `add_stripe_fields.sql` and `add_bookings_user_id.sql` use lowercase. The Phase 10 UTM migration (`20260425000000_add_utm_tracking.sql`, the most recent example) uses UPPERCASE.
- **Recommendation:** Use **UPPERCASE** to match the most recent Phase 10 migration — consistency over project-wide variance. Either is functionally equivalent.
- All migrations use `IF NOT EXISTS` for idempotency.
- `public.` schema prefix used inconsistently (`add_stripe_fields.sql` uses it; `add_staff_tables.sql` does not). For ALTER TABLE on a table whose name doesn't collide with a Postgres system table, omitting `public.` is fine; including it is safer. **Recommendation:** include `public.` to match the most recent comparable ALTER (`add_stripe_fields.sql`).

**Recommended migration file content:**
```sql
-- Migration: add_white_label_columns
-- Phase 15: Schema Foundation & Detokenization
-- Adds three white-label fields to company_settings:
--   service_delivery_model — operational mode for the tenant
--   privacy_policy_content — DB-backed legal copy (Phase 17 admin UI consumes this)
--   terms_of_service_content — same

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS service_delivery_model TEXT DEFAULT 'at-customer',
  ADD COLUMN IF NOT EXISTS privacy_policy_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_of_service_content TEXT DEFAULT '';
```

**Should `service_delivery_model` be a Postgres ENUM or CHECK-constrained TEXT?**

Project precedent (verified by reading `shared/schema.ts:633-680`):
- `time_format text default '12h'` — enum-like ('12h' | '24h'), no constraint
- `og_type text default 'website'` — enum-like (website | article), no constraint
- `twitter_card text default 'summary_large_image'` — enum-like, no constraint
- `seo_robots_tag text default 'index, follow'` — free-form preset, no constraint

**Recommendation:** **Plain TEXT, no CHECK, no ENUM.** Rationale:
- Matches 4 existing precedents in the same table.
- Drizzle 0.39.3 ENUMs require a separate `pgEnum(...)` declaration and migration when extending variants — operational burden.
- Phase 17 admin UI is responsible for providing the dropdown that constrains values at the form layer. DB-level enforcement is over-engineering for a singleton row.
- If a future phase needs DB-level enforcement, a CHECK constraint can be added without altering data: `ALTER TABLE public.company_settings ADD CONSTRAINT service_delivery_model_check CHECK (service_delivery_model IN ('at-customer', 'customer-comes-in', 'both'));`

### 6. Validation Architecture (Nyquist VALIDATION.md)

See dedicated section below. Each requirement has a deterministic grep- or query-based assertion.

### 7. Pitfalls / risks

**Detailed in Common Pitfalls and Risks & Open Questions sections below.**

## Common Pitfalls

### Pitfall 1: localStorage attribution disconnect for existing visitors
**What goes wrong:** Visitors who acquired `localStorage["skleanings_visitor_id"]` before deploy will get a fresh UUID under the new derived key on first post-deploy visit. Their pre-deploy session/booking history is no longer linked.
**Why it happens:** D-05/D-06 change the read key, but no migration code copies the old value to the new key.
**How to avoid:** **Don't avoid it — accept it.** CONTEXT.md `<code_context>` line 127 explicitly accepts this. The number of pre-existing visitors with attribution is bounded by Phase 10–13 deployment age, and the data is dashboard-only (no operational dependency).
**Alternative if planner reconsiders:** Add a one-time migration in `useUTMCapture` that runs before reading the new key:
```typescript
const oldId = localStorage.getItem('skleanings_visitor_id');
if (oldId && !localStorage.getItem(VISITOR_ID_KEY)) {
  localStorage.setItem(VISITOR_ID_KEY, oldId);
  localStorage.removeItem('skleanings_visitor_id');
}
```
**Recommendation:** Skip the migration code for now — extra complexity, accepted disconnect. Flag for Phase 17 if attribution loss is observed.
**Warning signs:** Phase 12 dashboard "Visitors" count drops to near-zero on the day of deploy and rebuilds over a week as old visitors return.

### Pitfall 2: Empty `companyName` on a fresh deploy → empty OpenRouter X-Title header
**What goes wrong:** A brand-new deployment with no admin-set `companyName` would call `getOpenRouterClient(apiKey, "")`. The new code resolves `title` to `""`. The conditional spread `...(title ? {} : {})` already handles this — the `X-Title` header is omitted entirely.
**Why it happens:** D-09 says caller passes `""` if no name available; the existing OpenRouter client builder already treats empty title as "skip header."
**How to avoid:** **Already avoided** by the existing `(title ? { "X-Title": title } : {})` guard at lines 28-29 and 52-53.
**Verification:** A unit-test-equivalent grep would confirm the guard. No changes needed beyond the new `companyName` parameter.
**Warning signs:** OpenRouter API rejects request with "missing X-Title" — would only happen if their API changes in a future version. Currently optional per OpenRouter docs.

### Pitfall 3: Drizzle type regeneration confusion
**What goes wrong:** Developer assumes `npm run db:push` is required after editing `shared/schema.ts`. Running it would push schema changes via drizzle-kit, **bypassing the Supabase migration file** and creating a silent divergence between the migration history and the live DB.
**Why it happens:** Drizzle docs default to `db:push` flow; project uses Supabase migration flow per Build Constraint #1.
**How to avoid:** Drizzle types are inferred at compile time via `typeof companySettings.$inferSelect`. They auto-regenerate when:
- `tsc` runs (`npm run check`)
- `vite dev` rebuilds the type cache
- An IDE TS server picks up the file change
**No db:push is needed.** The Drizzle schema edit is purely a TypeScript change; the actual DB schema change comes from `supabase db push`.
**Warning signs:** Planner adds a "run npm run db:push" step. **Reject.** Replace with `supabase db push` (or manual `psql` apply).

### Pitfall 4: `useCompanySettings` first-render returns settings=null
**What goes wrong:** A consumer calls `deriveCompanySlug(settings)` before `isReady` is true; `settings` is `null`; slug is `''`; key becomes `"visitor_visitor_id"` or similar non-tenant-specific value.
**Why it happens:** First useEffect run before fetch resolves.
**How to avoid:** **Always gate read sites on `isReady`.** Pattern:
```typescript
const { settings, isReady } = useCompanySettings();
useEffect(() => {
  if (!isReady) return;
  const slug = deriveCompanySlug(settings);
  const key = getVisitorIdKey(slug);
  // ... use key ...
}, [isReady, settings]);
```
For non-effect read sites (e.g., a button click handler), guard at call time:
```typescript
const handleClick = () => {
  if (!isReady) return; // or queue, or show loading
  const visitorId = localStorage.getItem(getVisitorIdKey(deriveCompanySlug(settings)));
  // ...
};
```
**Warning signs:** Localstorage entries with key `visitor_visitor_id` appearing in browser DevTools.

### Pitfall 5: ChatWidget visitorId read in toggleOpen — synchronous handler
**What goes wrong:** `ChatWidget.tsx:538` reads the visitor key inside a click handler (`toggleOpen`). React Query may or may not have fetched settings by the time the user clicks.
**Why it happens:** ChatWidget is mounted at app boot; first paint fires; user could click before `isReady`.
**How to avoid:** Inside `toggleOpen`, read `settings` and `isReady` from the hook closure. If `!isReady`, fall back to a temporary key OR simply skip the visitorId field (per existing `visitorId ?? undefined` pattern at line 543). Recommendation:
```typescript
const { settings, isReady } = useCompanySettings();
// inside toggleOpen:
const visitorId = isReady
  ? localStorage.getItem(getVisitorIdKey(deriveCompanySlug(settings)))
  : null;
fetch('/api/analytics/events', { ..., body: JSON.stringify({ visitorId: visitorId ?? undefined, ... }) });
```
**Warning signs:** chat_initiated events with no visitorId during the first 200ms of page load.

### Pitfall 6: BookingPage line 143 read happens in `useEffect` with `[]` deps
**What goes wrong:** Line 143's read is inside a `useEffect(() => { ... }, [])` — the empty deps array means the effect runs **once on mount**. If `isReady` is false at mount, the read returns `null` and the booking_started event has no visitorId.
**Why it happens:** Existing code pattern; predates `useCompanySettings`.
**How to avoid:** Either (a) widen the dep array to include `isReady` (but this re-fires the analytics event — bad), or (b) gate the entire effect on `isReady` and accept that `booking_started` fires after settings load instead of on mount, or (c) use a ref-based "has fired" flag combined with a useEffect that watches `isReady`.
**Recommended:** Option (b) — gate on `isReady`. The user has not yet completed the booking flow at mount; firing `booking_started` 100ms later is benign.
```typescript
const { settings, isReady } = useCompanySettings();
const firedRef = useRef(false);
useEffect(() => {
  if (!isReady || firedRef.current) return;
  if (items.length === 0) return;
  firedRef.current = true;
  // ... existing trackBeginCheckout + fetch logic, but use derived visitor key ...
}, [isReady, settings, items.length]);
```

## Code Examples

### Example 1: Drizzle schema extension (canonical)
```typescript
// shared/schema.ts — append inside companySettings pgTable definition (line ~680)
// Source: matches existing column patterns at lines 635-680
export const companySettings = pgTable("company_settings", {
  // ... 41 existing columns ...
  homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({}),
  // === Phase 15: White-label columns ===
  serviceDeliveryModel: text("service_delivery_model").default('at-customer'),
  privacyPolicyContent: text("privacy_policy_content").default(''),
  termsOfServiceContent: text("terms_of_service_content").default(''),
});
```

### Example 2: SQL migration
```sql
-- supabase/migrations/20260428000000_add_white_label_columns.sql
-- Source: matches existing migration patterns (add_stripe_fields, add_bookings_user_id, add_utm_tracking)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS service_delivery_model TEXT DEFAULT 'at-customer',
  ADD COLUMN IF NOT EXISTS privacy_policy_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_of_service_content TEXT DEFAULT '';
```

### Example 3: `App.tsx` document.title effect (D-04)
```typescript
// client/src/App.tsx — inside the App() function or a child wrapped by CompanySettingsProvider
import { useEffect } from "react";
import { useCompanySettings } from "@/context/CompanySettingsContext";

function DocumentTitleSync() {
  const { settings } = useCompanySettings();
  useEffect(() => {
    document.title = settings?.companyName || "";
  }, [settings?.companyName]);
  return null;
}
// Mount inside CompanySettingsProvider — e.g., next to <BrandColorInjector /> at line 230.
```

### Example 4: visitor-key utility module
```typescript
// client/src/lib/visitor-key.ts — NEW FILE
import type { CompanySettings } from "@shared/schema";

export function deriveCompanySlug(settings: CompanySettings | null): string {
  if (!settings) return '';
  const name = settings.companyName?.trim() ?? '';
  if (name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  return `tenant-${settings.id}`;
}

export function getVisitorIdKey(slug: string): string {
  return `${slug || 'visitor'}_visitor_id`;
}
```

### Example 5: openrouter.ts parameter injection
```typescript
// server/lib/openrouter.ts — both occurrences
export function getOpenRouterClient(apiKey?: string, companyName?: string) {
  const key = apiKey || runtimeOpenRouterKey || process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  const referer = process.env.OPENROUTER_HTTP_REFERER || process.env.VITE_SITE_URL;
  const title = process.env.OPENROUTER_APP_TITLE || companyName || "";

  return new OpenAI({
    apiKey: key,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      ...(referer ? { "HTTP-Referer": referer } : {}),
      ...(title ? { "X-Title": title } : {}),
    },
  });
}
// listOpenRouterModels — same change at line 47
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `"Skleanings"` brand fallbacks across React tree | Read from `companySettings` via `useCompanySettings()` context with `|| ""` fallback | Phase 15 (this phase) | Tenant-agnostic deployment becomes possible. |
| Constant `VISITOR_ID_KEY = "skleanings_visitor_id"` | Derived `${slug}_visitor_id` via `getVisitorIdKey(deriveCompanySlug(settings))` | Phase 15 | Multi-tenant localStorage isolation; one-time attribution disconnect for existing visitors (accepted). |
| `OPENROUTER_APP_TITLE \|\| "Skleanings"` env-fallback | `OPENROUTER_APP_TITLE \|\| companyName \|\| ""` parameter injection | Phase 15 | OpenRouter X-Title header reflects actual tenant identity; pure-utility module structure preserved. |

**Deprecated/outdated:** None — this is forward-only schema and code evolution. No removals from prior phases.

## Open Questions

1. **Should `BlogSection.tsx` and `BlogPostEditor.tsx` author defaults be `companyName` or empty?**
   - What we know: D-11 says replace literals with `|| ""`. But author-name "" is a UX regression — published blog posts would be authorless.
   - What's unclear: Is author-name a brand-display string (replace with companyName) or a free-form admin field (replace with "")?
   - Recommendation: **Replace with `settings?.companyName ?? ''`** — semantically correct for white-label. Planner should treat this as a context-read replacement, not a `|| ""` fallback. Document explicitly in plan.

2. **Should the `getVisitorIdKey` helper live in `use-utm-capture.ts` (per D-07) or a new `client/src/lib/visitor-key.ts` module?**
   - What we know: D-07 specifies export from `use-utm-capture.ts`. Three React component files need to consume it.
   - What's unclear: D-07 also mentions `deriveCompanySlug` could be exported. If exported from a hook file, that hook file becomes a utility module by accident.
   - Recommendation: Honor D-07 literally — export `getVisitorIdKey` from `use-utm-capture.ts`. If the planner sees an opportunity to extract to `client/src/lib/visitor-key.ts`, document the deviation explicitly. **Default to D-07.**

3. **Should `JSON-LD` publisher name in `BlogPost.tsx:374` use `|| ""` or skip the field when empty?**
   - What we know: D-11 says `|| ""`. JSON-LD with empty `name` is technically invalid schema.org.
   - What's unclear: Will SEO crawlers accept `"name": ""`?
   - Recommendation: Use `|| ""` per D-11 — the planner can defer JSON-LD validity to Phase 16 SEO Meta Injection (which owns schema.org). Phase 15's brief is detokenization, not SEO correctness.

4. **`pages/AdminLogin.tsx:134` and `components/LoginDialog.tsx:69` — `|| 'https://skleanings.com'` URL fallbacks: in scope?**
   - What we know: These are URL fallbacks for `window.location.origin` (effectively dead code in browsers).
   - What's unclear: D-12 success criterion says "zero matches in display/logic positions." A URL fallback IS a logic position.
   - Recommendation: Replace with `|| ""` — empty origin is harmless in OAuth redirects since `window.location.origin` is always truthy in practice. Add to the file edit list to fully satisfy D-12. The planner should call this out and decide.

5. **Migration file UPPERCASE vs lowercase SQL?**
   - What we know: Project has both styles. Most recent migration (Phase 10) is UPPERCASE.
   - What's unclear: No project-wide style guide.
   - Recommendation: UPPERCASE to match Phase 10 (most recent precedent) — see Section 5.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration application | ? — must verify | TBD | Manual `psql` apply via `POSTGRES_URL_NON_POOLING` (same fallback documented in STATE.md for Phase 10 migration) |
| Node.js 20.x | TypeScript compile + dev server | ✓ | from package.json `engines`-implicit | — |
| PostgreSQL DB | Drizzle DB operations | ✓ (existing tenant DB) | — | — |
| `npx drizzle-kit` | NOT used in this phase | ✓ (devDep) | 0.31.8 | — must NOT be used (Build Constraint #1) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Supabase CLI — if absent, the planner can apply the migration via direct `psql` connection using `POSTGRES_URL_NON_POOLING` (same workaround flagged in STATE.md "MIGRATION PENDING" blocker). Document this fallback in the plan.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None** (project has no automated test suite per `.planning/codebase/STACK.md` line 38: "Testing: Not configured (manual testing per AGENTS.md)") |
| Config file | none |
| Quick run command | `npm run check` (TypeScript only) |
| Full suite command | `npm run check && npm run build` |
| Phase 15 verification approach | **Grep-based + manual smoke test** — no test runner to install |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Manual? |
|--------|----------|-----------|-------------------|---------|
| WLTYPE-01 | `companySettings` has `serviceDeliveryModel` field with values `at-customer`/`customer-comes-in`/`both` | Schema assertion (grep) | `grep -n "service_delivery_model" supabase/migrations/20260428000000_add_white_label_columns.sql && grep -n "serviceDeliveryModel" shared/schema.ts` — both must return ≥1 match | + `psql -c "\\d company_settings"` to confirm column exists post-migration |
| LEGAL-01 | `companySettings` has `privacyPolicyContent` and `termsOfServiceContent` text fields | Schema assertion (grep) | `grep -n "privacy_policy_content\|terms_of_service_content" supabase/migrations/20260428000000_add_white_label_columns.sql && grep -n "privacyPolicyContent\|termsOfServiceContent" shared/schema.ts` | + `psql -c "\\d company_settings"` post-migration |
| DETOK-01 | `document.title` is set from `settings.companyName` (no `ThemeContext` modification per D-03) | Code-presence grep + manual | `grep -n "document.title" client/src/App.tsx` returns ≥1 match referencing `settings.companyName` | Manual: load site with `companyName="TestTenant"` in DB, observe browser tab title shows "TestTenant" |
| DETOK-02 | localStorage visitor key is derived from slug, not literal `"skleanings_visitor_id"` | Negative grep | `grep -rn "'skleanings_visitor_id'\|\"skleanings_visitor_id\"" client/src/` returns **zero** matches (the constant + 3 read sites all replaced) | Manual: change `companyName` in DB, reload, verify localStorage key prefix changes |
| DETOK-03 | All `"Skleanings"` literals in React components removed | Negative grep | `grep -rn '"Skleanings"\|'\''Skleanings'\''' client/src/ --include="*.tsx" --include="*.ts"` returns **zero** matches in display/logic positions | Manual: load `/privacy-policy` and `/terms-of-service` with `companyName=""` in DB, confirm pages render without "Skleanings" appearing |
| SERV-01 | `server/lib/openrouter.ts` reads app title from `companyName` parameter, not the hardcoded literal | Negative grep + signature inspection | `grep -n '"Skleanings"' server/lib/openrouter.ts` returns **zero** matches; `grep -n "companyName" server/lib/openrouter.ts` returns ≥2 matches (one per function) | Manual: invoke `/api/integrations/openrouter/test` with seeded `companyName="TestTenant"`, intercept request, confirm `X-Title: TestTenant` header |

### Sampling Rate
- **Per task commit:** `npm run check` (TypeScript clean — catches missing companyName parameter, broken type inference)
- **Per wave merge:** `npm run check && npm run build` (full TS + bundle build; verifies no esbuild-detectable references to removed string)
- **Phase gate:** Run all 6 grep assertions + 6 manual smoke tests above; all must pass before `/gsd:verify-work`

### Wave 0 Gaps
- **None** — project has no test framework to set up (existing manual-testing convention per AGENTS.md). Validation is grep + manual smoke test, no test files needed.

If the planner introduces tests for this phase, it would be a **first** for the project. **Do not introduce tests in Phase 15** — defer test-framework selection to a dedicated infrastructure phase. Phase 15's validation is grep + smoke test, sufficient for the requirement set.

## Risks & Open Questions (Planner Decisions Required)

### Risk 1: Existing `getCompanySettings` storage method may have explicit column whitelist
**Why it matters:** If `server/storage.ts` has an explicit `select({ ... })` projection that lists every column, the new columns will silently NOT appear in API responses, breaking DETOK-01 verification.
**Mitigation:** Planner MUST inspect `server/storage.ts` `getCompanySettings` implementation. If it uses a column whitelist, add the three new columns. If it does `select().from(companySettings)` (full row), no change needed. **Add as explicit verification step in Plan 01.**

### Risk 2: Existing `upsertCompanySettings` may strip unknown columns via Zod
**Why it matters:** `insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true })` auto-includes new columns IF the schema is regenerated on the same TS compile. But if the route handler calls `.parse(req.body)` on a stricter schema, Phase 17's admin-UI write path would silently drop the new fields.
**Mitigation:** Phase 15 is read-only for the new fields (Phase 17 owns admin UI). Planner can defer this risk to Phase 17, but **flag in the verification step**: "Insert/upsert path for new columns is NOT exercised in Phase 15."

### Risk 3: Migration must run before any code reads new fields
**Why it matters:** Drizzle TS types claim columns exist; live DB doesn't until migration runs. Any code that reads `settings.serviceDeliveryModel` will get `undefined` from a stale-DB row.
**Mitigation:** Phase 15 itself does not READ the new columns — they're forward-looking for Phase 17/18. The detokenization sweep doesn't touch new fields. So a migration timing issue would only break Phase 17/18, not Phase 15. **Document migration as the first task** (Wave 0) in Plan 01 to maximize lead time.

### Risk 4: ThemeContext interaction with DETOK-01
**Why it matters:** Requirement DETOK-01 reads "ThemeContext.tsx initializes companyName and companyEmail from API." But D-03 explicitly says ThemeContext stays theme-only. The requirement language is misleading — the ACTUAL implementation per D-03/D-04 is in App.tsx via document.title, not in ThemeContext.
**Mitigation:** **Verify with user / treat D-03 as authoritative.** This is the standard pattern: requirement text is aspirational; CONTEXT.md decisions are the implementation contract. The planner should reference D-03/D-04 in the plan, NOT the literal text of DETOK-01.

### Risk 5: Phase 15 ships before Phase 17 admin UI exists
**Why it matters:** After Phase 15 deploys, the live DB has `serviceDeliveryModel='at-customer'` (default) — but no admin can change it until Phase 17. Phase 18 (Calendar Improvements) depends on the field being admin-settable.
**Mitigation:** Planner should NOT introduce dependencies on Phase 17 in Phase 15. The field default (`'at-customer'`) is the correct backward-compatible value for the existing tenant. Phase 18 will read this default until Phase 17 ships. **Acceptable** per roadmap order.

### Risk 6: `chatDeps.getOpenRouterClient(apiKey)` callsite signature breakage
**Why it matters:** Adding `companyName` parameter to `getOpenRouterClient` will TYPE-BREAK every caller until they pass the second arg.
**Mitigation:** Make `companyName` an **optional** second parameter (`companyName?: string`). Existing callsites compile clean. Update callsites incrementally; default behavior with `undefined` companyName resolves to `""` X-Title (header omitted), matching post-detokenization behavior. **Net safe.**

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts:633-688` — companySettings table definition (verified: 42 columns, no slug)
- `client/src/hooks/use-utm-capture.ts:1-87` — full file inspection
- `server/lib/openrouter.ts:1-72` — full file inspection
- `client/src/App.tsx:1-256` — full provider tree inspection
- `client/src/context/CompanySettingsContext.tsx:1-39` — isReady semantics
- `supabase/migrations/*.sql` — 12-file inventory verified
- `client/src/pages/PrivacyPolicy.tsx:1-263` — both fallback sites located
- `client/src/pages/TermsOfService.tsx:1-198` — both fallback sites located
- `client/src/components/chat/ChatWidget.tsx:520-553` — toggleOpen handler with line 538 read
- `client/src/pages/BookingPage.tsx:130-210` — both line 143 + 195 read sites
- `client/src/components/admin/AdminHeader.tsx:1-19` — full file
- `server/routes/integrations/ai.ts:190-235` — caller context
- `server/routes/chat/dependencies.ts:1-117` — DI plumbing
- `server/routes/chat/message-handler.ts:1080-1110` — chat caller
- `package.json:1-22` — script inventory (db:push exists; not to be used)
- `.planning/config.json` — workflow.nyquist_validation: true (Validation Architecture section included)

### Secondary (MEDIUM confidence)
- `supabase/migrations/20260402100000_add_stripe_fields.sql` — used as ALTER TABLE template
- `supabase/migrations/20260402000000_add_staff_tables.sql` — UPPERCASE precedent
- `supabase/migrations/20260425000000_add_utm_tracking.sql` — most recent migration, UPPERCASE precedent

### Tertiary (LOW confidence)
- None. All findings verified by direct file reads.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in package.json with verified versions
- Architecture: HIGH — full file reads of every involved component
- Pitfalls: HIGH — provider tree race conditions verified via App.tsx inspection
- Validation: HIGH — project has no test framework, manual + grep is the established pattern
- Open questions: MEDIUM — questions 1, 2, 3, 4 require planner judgment

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (30 days — schema file and React hook structure are stable)

## RESEARCH COMPLETE

**Phase:** 15 - Schema Foundation & Detokenization
**Confidence:** HIGH

### Key Findings
- **`companySettings` has NO `slug` column** — confirmed by grep across `shared/schema.ts`. Visitor key derivation MUST use `companyName`-slugified-or-`tenant-${id}` fallback path documented in D-05's escape clause.
- **8 active "Skleanings" string literals across 7 files in `client/src/`** — full inventory in DETOK-03 section. Plus 5 lowercase `skleanings` references (3 visitor-key reads + 2 deferred admin/URL/bucket items).
- **`useCompanySettings.isReady` flips on `useQuery.isFetched`** — safe gate for race-condition-free localStorage key derivation. Pattern already established in `useHideInitialLoader`.
- **`openrouter.ts` has 5 caller sites** across 2 files — `ai.ts` (2) + chat DI plumbing (`dependencies.ts` + `message-handler.ts`). Make `companyName` an OPTIONAL parameter to avoid signature break.
- **No new dependencies needed** — all work uses existing libraries. No test framework gap (project has none; grep + manual smoke test is the established pattern).
- **Migration filename: `20260428000000_add_white_label_columns.sql`** — next sequential after Phase 10 (`20260425000000`). UPPERCASE SQL style to match most recent precedent. Plain TEXT column for `service_delivery_model` (matches 4 existing enum-like TEXT columns in the same table).

### File Created
`c:\Users\Vanildo\Dev\skleanings\.planning\phases\15-schema-foundation-detokenization\15-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries already in package.json; no version unknowns |
| Architecture | HIGH | Every involved file read end-to-end; provider tree verified |
| Pitfalls | HIGH | Race conditions identified via App.tsx provider order + isReady semantics |
| Validation | HIGH | Project has no test framework; grep + manual is the established convention |
| Open Questions | MEDIUM | 5 planner-judgment items flagged (BlogSection authorName, helper location, JSON-LD validity, AdminLogin URL fallback, SQL case style) |

### Open Questions
1. BlogSection authorName: `|| ""` (per D-11) or `|| companyName` (semantic)? **Recommendation: companyName.**
2. `getVisitorIdKey` location: `use-utm-capture.ts` (per D-07) or `client/src/lib/visitor-key.ts`? **Recommendation: honor D-07.**
3. JSON-LD publisher empty name validity? **Recommendation: defer to Phase 16; use `|| ""` here.**
4. `AdminLogin.tsx:134` + `LoginDialog.tsx:69` URL fallback in scope? **Recommendation: in scope to satisfy D-12 strictly.**
5. SQL case style? **Recommendation: UPPERCASE to match Phase 10 precedent.**

### Ready for Planning
Research complete. Planner can now create PLAN.md files. Suggested wave decomposition:
- **Wave 0:** Migration SQL + Drizzle schema extension (unblocks all type usage)
- **Wave 1:** `client/src/lib/visitor-key.ts` (or in-place helper) + `useUTMCapture` rewrite + `App.tsx` document.title — DETOK-01 + DETOK-02 foundation
- **Wave 2:** `ChatWidget.tsx` + `BookingPage.tsx` callsite migrations + 7-file fallback sweep — DETOK-03
- **Wave 3:** `openrouter.ts` parameter injection + 3 caller updates — SERV-01
- **Phase gate:** Run all 6 grep assertions + 6 manual smoke tests in Validation Architecture section.
