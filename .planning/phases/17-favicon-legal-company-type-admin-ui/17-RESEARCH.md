# Phase 17: Favicon, Legal & Company Type Admin UI — Research

**Researched:** 2026-04-30
**Domain:** Admin settings UI extension — favicon delivery, legal content management, service delivery model selector
**Confidence:** HIGH — all findings verified against live source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema — New faviconUrl Column**
- D-01: Add `favicon_url TEXT DEFAULT ''` to `company_settings` via a new Supabase migration `20260430000000_add_favicon_url.sql`. Update `shared/schema.ts` with `faviconUrl: text("favicon_url").default('')`. Regenerate `CompanySettings` type.
- D-02: No migration needed for `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent` — Phase 15 already added these columns.
- D-03: The existing `publicCompanySettingsFallback` in `server/routes/company.ts` must add `faviconUrl: ""` to stay in sync.

**Favicon Delivery (FAV-01/02/03)**
- D-04: Extend `server/lib/seo-injector.ts` with a `{{FAVICON_URL}}` token replacing `{{COMPANY_NAME_ALT}}` comment placeholder.
- D-05: Update `client/index.html` `<link rel="icon" href="{{FAVICON_URL}}">` (currently `href="/favicon.png"`).
- D-06: Empty `faviconUrl` → injector emits `/favicon.png` as fallback href.
- D-07: Update `client/src/hooks/use-seo.ts` lines 113–122 — replace `settings.logoIcon` with `settings.faviconUrl` for the `<link rel="icon">` update.
- D-08: Admin favicon input is upload-only — calls existing `POST /api/upload`, receives `objectPath`, saves to `faviconUrl`.

**Service Delivery Model (WLTYPE-02)**
- D-09: Three radio buttons: `at-customer` / `customer-comes-in` / `both` with descriptive subtitle labels.
- D-10: Controlled by local state + `updateField("serviceDeliveryModel", value)` — same 800ms debounce save pattern as other Company Settings fields.

**Legal Content Admin (LEGAL-02)**
- D-11: Two plain `<Textarea>` fields — no word count, no live preview, no Markdown rendering.
- D-12: Labels: "Privacy Policy Content" / "Terms of Service Content" with helper text about pasting HTML.
- D-13: Saved via existing `PUT /api/company-settings` mutation — same "auto-save" mechanism as the rest.

**Legal Public Pages (LEGAL-03/04)**
- D-14: `PrivacyPolicy.tsx` fully rewritten — render `settings.privacyPolicyContent` via `dangerouslySetInnerHTML` (no DOMPurify).
- D-15: `TermsOfService.tsx` same rewrite pattern.
- D-16: Empty state: centered card with "Our privacy policy is being finalized. For questions, contact [email] or [phone]."
- D-17: If both email and phone are empty: "For questions, please contact us through our website."
- D-18: Static `<h1>` header stays ("Privacy Policy" / "Terms of Service") — not DB-driven.

**Admin UI Placement**
- D-19: New "Legal & Branding" tab in Company Settings with four sections in order: (1) Favicon upload, (2) Service Delivery Model, (3) Privacy Policy textarea, (4) Terms of Service textarea.
- D-20: Same card layout, same auto-save pattern as existing Company Settings tabs.

### Claude's Discretion
- Migration filename: `20260430000000_add_favicon_url.sql`
- Column position in migration: appended after `termsOfServiceContent`
- Whether to use a single form or separate forms per section — follow existing pattern (local state + `updateField`)
- Exact tab label — match admin naming convention in `CompanySettingsSection.tsx`
- Whether Phase 15 fields need adding to `publicCompanySettingsFallback` — VERIFY during research (FINDING: YES, they are missing — see Critical Gap below)

### Deferred Ideas (OUT OF SCOPE)
- Markdown rendering for legal content
- Legal version history / changelog
- Custom /privacy and /terms URL slugs
- `/favicon.ico` Express redirect route
- Sitemap.xml listing (already present)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FAV-01 | Admin can set a favicon URL (upload) in company settings and save it | Upload pattern confirmed in `CompanySettingsSection.tsx`; `POST /api/upload` returns `objectPath` |
| FAV-02 | Platform serves favicon dynamically from `companySettings.faviconUrl` | SEO injector token system confirmed; `{{FAVICON_URL}}` slot identified in seo-injector.ts |
| FAV-03 | Empty `faviconUrl` falls back gracefully without breaking | Injector fallback pattern confirmed (`/favicon.png` static value) |
| WLTYPE-02 | Admin can set service delivery model in Company Settings | `RadioGroup` + `RadioGroupItem` components confirmed present in `client/src/components/ui/radio-group.tsx` |
| LEGAL-02 | Admin can edit Privacy Policy and Terms content in Company Settings admin section | `Textarea` component confirmed; `updateField` auto-save pattern confirmed in `CompanySettingsSection.tsx` |
| LEGAL-03 | `/privacy-policy` and `/terms-of-service` pages render content from DB | Routes confirmed in `App.tsx`; `dangerouslySetInnerHTML` precedent confirmed in `BlogPost.tsx` |
| LEGAL-04 | Empty legal fields show placeholder message rather than breaking | Pattern: conditional render on content truthiness |
</phase_requirements>

---

## Summary

Phase 17 is an extension phase: it wires three existing Phase 15 database columns (`serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent`) to admin UI, adds one new column (`faviconUrl`) via a single-line migration, and rewrites two hardcoded public pages. The codebase already contains all the UI primitives, the save/upload infrastructure, and the SEO injector token system — this phase is primarily about plumbing connections rather than inventing patterns.

The most impactful research finding is a **critical gap**: the Phase 15 fields (`serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent`) were never added to the `publicCompanySettingsFallback` object in `server/routes/company.ts` or to the `CompanySettingsData` interface in `client/src/components/admin/shared/types.ts`. Phase 17 must address these omissions or the new fields will be missing from fallback responses and TypeScript will reject them in the admin form state.

The routes for legal pages are `/privacy-policy` and `/terms-of-service` (not `/privacy` and `/terms` as abbreviated in some context notes). This matches the existing Wouter declarations and footer links — no route changes needed.

**Primary recommendation:** Implement as three focused units: (1) DB migration + schema, (2) new LegalBrandingTab component added to CompanySettingsSection, (3) rewrite PrivacyPolicy.tsx and TermsOfService.tsx.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Used |
|---------|---------|---------|----------|
| shadcn/ui RadioGroup | via @radix-ui/react-radio-group | Service delivery model selector | Already installed, confirmed at `client/src/components/ui/radio-group.tsx` |
| shadcn/ui Textarea | native | Legal content plain-text editing | Already installed, confirmed at `client/src/components/ui/textarea.tsx` |
| shadcn/ui Separator | native | Visual section dividers in tab | Already installed at `client/src/components/ui/separator.tsx` |
| React Query | @tanstack/react-query | Server state — `useQuery` for companySettings | Used by all existing admin sections |
| Supabase Storage | supabase-js | Favicon file upload | Same flow as logo uploads in `CompanySettingsSection.tsx` |

### No New Dependencies

All work uses existing packages. **Do not add** DOMPurify for legal content (admin-authored, not user-authored — CONTEXT D-14 explicitly prohibits this).

---

## Architecture Patterns

### Recommended Project Structure

Files to create or modify:

```
client/src/components/admin/
└── LegalBrandingTab.tsx        # NEW — the four-section tab content

client/src/pages/
├── PrivacyPolicy.tsx            # REWRITE (263 lines → ~80 lines)
└── TermsOfService.tsx           # REWRITE (199 lines → ~80 lines)

client/src/components/admin/shared/
└── types.ts                     # ADD faviconUrl, serviceDeliveryModel, privacyPolicyContent, termsOfServiceContent to CompanySettingsData

client/src/hooks/
└── use-seo.ts                   # UPDATE lines 113–122: logoIcon → faviconUrl

server/lib/
└── seo-injector.ts              # ADD {{FAVICON_URL}} token

client/
└── index.html                   # UPDATE <link rel="icon"> href to {{FAVICON_URL}}

shared/
└── schema.ts                    # ADD faviconUrl after termsOfServiceContent

server/routes/
└── company.ts                   # ADD faviconUrl + Phase 15 fields to publicCompanySettingsFallback

supabase/migrations/
└── 20260430000000_add_favicon_url.sql    # NEW single-line migration
```

### Pattern 1: Auto-Save via updateField (existing — REPLICATE exactly)

**What:** Local state stores the current form values. `updateField(field, value)` updates state immediately and schedules a debounced save (800ms) via `saveSettings({ [field]: value })`. No explicit save button for text/select fields.

**How it works in `CompanySettingsSection.tsx`:**
```typescript
// Source: client/src/components/admin/CompanySettingsSection.tsx:102-112
const updateField = useCallback(<K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => {
  setSettings(prev => ({ ...prev, [field]: value }));
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(() => {
    saveSettings({ [field]: value });
  }, 800);
}, [saveSettings]);
```

**How saveSettings calls the API:**
```typescript
// Source: client/src/components/admin/CompanySettingsSection.tsx:79-99
await authenticatedRequest('PUT', '/api/company-settings', token, newSettings);
queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
```

**The new LegalBrandingTab must receive `settings`, `updateField`, `saveSettings`, `getAccessToken`, and `isSaving` as props** — the same pattern the main `CompanySettingsSection` exposes to its internal sections. This avoids duplicating state and save logic.

### Pattern 2: Favicon Upload (existing — REPLICATE logo upload)

**What:** Admin clicks an upload button, file is selected, a signed upload URL is fetched from `POST /api/upload`, the file is PUT to that URL, and the returned `objectPath` is saved via `saveSettings({ faviconUrl: objectPath })`.

```typescript
// Source: client/src/components/admin/CompanySettingsSection.tsx:114-146
const token = await getAccessToken();
const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
const { uploadURL, objectPath } = await uploadRes.json();
await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
updateField('faviconUrl', objectPath);  // or setSettings + saveSettings directly
```

### Pattern 3: SEO Injector Token (existing — ADD one entry)

**What:** `injectSeoMeta()` has a `tokens` record. Adding `{{FAVICON_URL}}` follows the identical pattern.

```typescript
// Source: server/lib/seo-injector.ts:96-112
const tokens: Record<string, string> = {
  "{{SEO_TITLE}}":   escapeAttr(title),
  // ... existing tokens ...
  // ADD:
  "{{FAVICON_URL}}": escapeAttr(settings?.faviconUrl || "/favicon.png"),
};
```

The existing comment on line 109 explicitly marks this slot: `// {{COMPANY_NAME_ALT}}: reserved for Phase 17 favicon alt-text`. The actual token to add is `{{FAVICON_URL}}`, not `{{COMPANY_NAME_ALT}}`. The `{{COMPANY_NAME_ALT}}` token already exists in the map as an alias for `companyName` — it is unrelated to favicon.

### Pattern 4: dangerouslySetInnerHTML for DB-driven content

**What:** Legal pages render admin-entered HTML content directly. The blog post page (`BlogPost.tsx`) uses DOMPurify because blog content comes from a rich text editor accessible to admin. Legal content is pasted text from a legal generator and is NOT user-authored, making sanitization unnecessary (per D-14/D-15).

```tsx
// Pattern (adapted from BlogPost.tsx:194-198):
{settings?.privacyPolicyContent ? (
  <div
    className="prose prose-gray max-w-none"
    dangerouslySetInnerHTML={{ __html: settings.privacyPolicyContent }}
  />
) : (
  <EmptyState settings={settings} />
)}
```

### Pattern 5: RadioGroup for Service Delivery Model

```tsx
// Source: client/src/components/ui/radio-group.tsx — already installed
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

<RadioGroup
  value={settings.serviceDeliveryModel || 'at-customer'}
  onValueChange={(value) => updateField('serviceDeliveryModel', value)}
>
  {[
    { value: 'at-customer', title: 'At Customer Location', subtitle: 'We travel to your customers' },
    { value: 'customer-comes-in', title: 'Customer Comes In', subtitle: 'Customers visit your location' },
    { value: 'both', title: 'Both', subtitle: 'We serve customers on-site and at their location' },
  ].map(({ value, title, subtitle }) => (
    <div key={value} className="flex items-start space-x-3">
      <RadioGroupItem value={value} id={`sdm-${value}`} className="mt-1" />
      <Label htmlFor={`sdm-${value}`} className="cursor-pointer">
        <span className="font-medium">{title}</span>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </Label>
    </div>
  ))}
</RadioGroup>
```

### Anti-Patterns to Avoid

- **Do not** create a separate form/state for the Legal & Branding tab — extend the existing `CompanySettingsSection` local state by adding the new fields.
- **Do not** add a separate "Save Changes" button for the new tab — rely on the 800ms debounce auto-save already in place.
- **Do not** use DOMPurify on legal content — the CONTEXT explicitly prohibits this as an unnecessary dependency for admin-only content.
- **Do not** redirect or 404 on empty legal pages — always render something (LEGAL-04).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload to Supabase | Custom multipart upload | Existing `POST /api/upload` endpoint (`server/routes/company.ts:65-87`) | Already signed, returns `objectPath` public URL |
| Token injection in HTML | String concatenation | Existing `injectSeoMeta()` token loop | Handles `$` special chars in replacements (replacer function) |
| Radio button group | Custom div-based selector | `RadioGroup` + `RadioGroupItem` from `@radix-ui/react-radio-group` | Already installed and styled |
| Auto-saving form | Manual save button + mutation | Existing `updateField` debounce pattern in `CompanySettingsSection` | 800ms debounce, consistent UX |

---

## Critical Gaps Found (REQUIRED Phase 17 work — not in CONTEXT.md)

### Gap 1: Phase 15 Fields Missing from publicCompanySettingsFallback

**File:** `server/routes/company.ts` lines 21–62

**Finding:** `publicCompanySettingsFallback` does NOT include `serviceDeliveryModel`, `privacyPolicyContent`, or `termsOfServiceContent`. These are Phase 15 fields that were schema-only — the admin UI and type plumbing were deferred to Phase 17.

**Required action:** Add to the fallback object:
```typescript
serviceDeliveryModel: 'at-customer',
privacyPolicyContent: '',
termsOfServiceContent: '',
faviconUrl: '',   // Phase 17 new field
```

### Gap 2: Phase 15 Fields Missing from CompanySettingsData Type

**File:** `client/src/components/admin/shared/types.ts`

**Finding:** `CompanySettingsData` interface does NOT include `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent`, or `faviconUrl`. TypeScript will reject `updateField('serviceDeliveryModel', value)` calls.

**Required action:** Add four fields to `CompanySettingsData`:
```typescript
faviconUrl: string | null;
serviceDeliveryModel: string | null;
privacyPolicyContent: string | null;
termsOfServiceContent: string | null;
```

### Gap 3: CompanySettingsSection Initial State Missing New Fields

**File:** `client/src/components/admin/CompanySettingsSection.tsx` lines 31–54

**Finding:** The `useState` initializer for `settings` does not include the Phase 15 fields or `faviconUrl`. They must be seeded with defaults to avoid uncontrolled-to-controlled input warnings.

**Required action:** Add to initial state:
```typescript
faviconUrl: '',
serviceDeliveryModel: 'at-customer',
privacyPolicyContent: '',
termsOfServiceContent: '',
```

### Gap 4: use-seo.ts SeoSettings Type Missing faviconUrl

**File:** `client/src/hooks/use-seo.ts`

**Finding:** `SeoSettings` interface (lines 6–26) includes `logoIcon` but not `faviconUrl`. The favicon update block (lines 113–122) currently reads `settings.logoIcon`. D-07 requires switching to `settings.faviconUrl`.

**Required action:** Add `faviconUrl: string | null` to the `SeoSettings` interface AND update the favicon update block to read `settings.faviconUrl` instead of `settings.logoIcon`.

---

## Route Path Clarification

**CONTEXT.md** uses `/privacy` and `/terms` as abbreviations. The **actual registered paths** are:

- `App.tsx` line 196: `<Route path="/privacy-policy" component={PrivacyPolicy} />`
- `App.tsx` line 197: `<Route path="/terms-of-service" component={TermsOfService} />`
- Footer links: `/privacy-policy` and `/terms-of-service`
- Sitemap: `/privacy-policy` and `/terms-of-service`

**No route changes needed.** The page components exist and are registered.

---

## index.html Favicon State (Verified)

Current state of `client/index.html` line 29:
```html
<link rel="icon" type="image/png" href="/favicon.png" />
```

This is the hardcoded static value. Phase 17 changes it to:
```html
<link rel="icon" type="image/png" href="{{FAVICON_URL}}" />
```

The SEO injector will fill `{{FAVICON_URL}}` with `escapeAttr(settings.faviconUrl || "/favicon.png")` — so when `faviconUrl` is empty, the existing `/favicon.png` static file continues to serve.

---

## seo-injector.ts Token Map State (Verified)

Current tokens at lines 96–112 of `server/lib/seo-injector.ts`:

```
{{SEO_TITLE}}, {{SEO_DESCRIPTION}}, {{CANONICAL_URL}},
{{OG_IMAGE_BLOCK}}, {{TWITTER_IMAGE_BLOCK}}, {{OG_TYPE}},
{{OG_SITE_NAME}}, {{OG_LOCALE}}, {{TWITTER_CARD}},
{{TWITTER_SITE}}, {{TWITTER_CREATOR}}, {{ROBOTS}},
{{COMPANY_NAME_ALT}},  ← already exists (emits companyName)
{{JSON_LD}}
```

Line 109 comment: `// {{COMPANY_NAME_ALT}}: reserved for Phase 17 favicon alt-text — no emit site in client/index.html yet.`

**Clarification:** `{{COMPANY_NAME_ALT}}` is already defined and emits `companyName`. It is NOT the favicon token. The token to ADD is `{{FAVICON_URL}}` — a new entry in the token map.

---

## Common Pitfalls

### Pitfall 1: Favicon Injector Falls Back Incorrectly

**What goes wrong:** Developer writes `escapeAttr(settings?.faviconUrl)` without the `|| "/favicon.png"` fallback. When `faviconUrl` is empty string, `escapeAttr("")` returns `""`, yielding `href=""` — which causes an immediate 404 for the favicon.

**How to avoid:** Always use `escapeAttr(settings?.faviconUrl || "/favicon.png")`.

**Warning signs:** Browser console shows `GET /  net::ERR_...` or empty string favicon href in dev tools.

### Pitfall 2: updateField Type Error on New Fields

**What goes wrong:** New fields (`faviconUrl`, `serviceDeliveryModel`, etc.) are passed to `updateField` before being added to `CompanySettingsData`. TypeScript throws a type error: `Argument of type '"faviconUrl"' is not assignable to parameter of type 'keyof CompanySettingsData'`.

**How to avoid:** Add all four new fields to `CompanySettingsData` in `types.ts` BEFORE writing the new tab component.

### Pitfall 3: DOMPurify Added as Dependency for Legal Pages

**What goes wrong:** Developer copies the `BlogPost.tsx` pattern including the `DOMPurify.sanitize()` call and adds the import.

**How to avoid:** The CONTEXT explicitly prohibits DOMPurify for legal content (D-14/D-15). Legal content is admin-authored only — use `dangerouslySetInnerHTML={{ __html: content }}` directly. BlogPost uses DOMPurify because blog content goes through a rich text editor; legal pages do not.

### Pitfall 4: LegalBrandingTab Creates Duplicate State

**What goes wrong:** A new component creates its own `useState` + `useQuery` for company settings instead of receiving state from `CompanySettingsSection` as props. This causes a second API call, a second save path, and potential state sync issues.

**How to avoid:** Extract a `LegalBrandingTab` component that receives `settings`, `updateField`, `getAccessToken`, and `isSaving` as props from `CompanySettingsSection`. All state lives in `CompanySettingsSection` as it does today.

### Pitfall 5: Empty Legal Content Shows Blank White Page

**What goes wrong:** `dangerouslySetInnerHTML={{ __html: "" }}` renders a visible empty `div` — no error, just a blank section. Admin and visitors see a white void instead of a useful message.

**How to avoid:** Add an explicit `content?.trim()` guard before the `dangerouslySetInnerHTML` branch:
```tsx
{content?.trim() ? (
  <div dangerouslySetInnerHTML={{ __html: content }} className="prose prose-gray max-w-none" />
) : (
  <EmptyLegalPlaceholder settings={settings} type="privacy" />
)}
```

### Pitfall 6: {{FAVICON_URL}} Token Emitted Without Type Attribute Change

**What goes wrong:** `client/index.html` `<link rel="icon">` currently has `type="image/png"`. If the admin uploads a `.ico` or `.svg` favicon, the `type` attribute will be wrong.

**How to avoid:** The CONTEXT (D-08) specifies upload-only, and the existing upload endpoint does not restrict file types. Consider whether to keep `type="image/png"` or remove it. Safest: remove `type="image/png"` when switching to `{{FAVICON_URL}}` since the server will serve the correct MIME type from Supabase.

### Pitfall 7: Phase 15 Migration Not Applied

**What goes wrong:** Phase 15 migration (`20260428000000_add_white_label_columns.sql`) is listed as a pending blocker in STATE.md. If this migration has not been applied, `serviceDeliveryModel`, `privacyPolicyContent`, and `termsOfServiceContent` columns do not exist in the database — the Phase 17 admin UI will silently drop those fields on save.

**How to verify:** The STATE.md Blockers section confirms this migration is written but flagged as pending: "Phase 15 migration file (20260428000000_add_white_label_columns.sql) ready but NOT applied."

**How to avoid:** Plan 17-01 must include operator step: apply pending migration AND new Phase 17 migration before testing.

---

## Code Examples

### Adding {{FAVICON_URL}} to seo-injector.ts

```typescript
// Source: server/lib/seo-injector.ts — add to tokens map
const tokens: Record<string, string> = {
  // ... existing tokens ...
  "{{FAVICON_URL}}": escapeAttr(settings?.faviconUrl || "/favicon.png"),
  "{{COMPANY_NAME_ALT}}": escapeAttr(companyName),  // unchanged
  // ...
};
```

### LegalBrandingTab Skeleton (Component Props Interface)

```typescript
// client/src/components/admin/LegalBrandingTab.tsx
interface LegalBrandingTabProps {
  settings: CompanySettingsData;
  updateField: <K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => void;
  getAccessToken: () => Promise<string | null>;
  isSaving: boolean;
}
```

### PrivacyPolicy.tsx Rewrite Structure

```tsx
// client/src/pages/PrivacyPolicy.tsx
export default function PrivacyPolicy() {
  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ['/api/company-settings'],
  });
  const content = settings?.privacyPolicyContent;
  const hasContent = Boolean(content?.trim());

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Static header — unchanged from current design */}
      <div className="bg-primary text-white py-16">
        <div className="container-custom">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-10 h-10" />
            <h1 className="text-4xl font-bold font-heading text-white">Privacy Policy</h1>
          </div>
        </div>
      </div>

      {/* DB-driven content or empty state */}
      <div className="container-custom py-12">
        {hasContent ? (
          <div
            className="prose prose-gray max-w-none"
            dangerouslySetInnerHTML={{ __html: content! }}
          />
        ) : (
          <LegalEmptyState settings={settings} type="privacy" />
        )}
      </div>
    </div>
  );
}
```

### LegalEmptyState Component

```tsx
function LegalEmptyState({ settings, type }: { settings: CompanySettings | undefined; type: 'privacy' | 'terms' }) {
  const label = type === 'privacy' ? 'privacy policy' : 'terms of service';
  const hasContact = settings?.companyEmail || settings?.companyPhone;
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="max-w-md space-y-3">
        <p className="text-lg text-gray-700">
          Our {label} is being finalized.
        </p>
        <p className="text-gray-500">
          {hasContact
            ? `For questions, please contact ${[settings?.companyEmail, settings?.companyPhone].filter(Boolean).join(' or ')}.`
            : 'For questions, please contact us through our website.'}
        </p>
      </div>
    </div>
  );
}
```

### Migration File Content

```sql
-- supabase/migrations/20260430000000_add_favicon_url.sql
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS favicon_url TEXT DEFAULT '';
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 17 is purely code/config changes (file edits + one DB migration column addition). No new external services, CLI tools, or runtimes required beyond what Phase 15 and 16 already used.

**Note:** Supabase CLI for `supabase db push` is required to apply the migration. Per MEMORY.md, always use Supabase CLI for DB migrations — never `drizzle-kit push` (TTY prompt issues).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js assert (ESM test harness — custom, no jest/vitest) |
| Config file | none — run directly with `npx tsx tests/seo/inject.test.mjs` |
| Quick run command | `npx tsx tests/seo/inject.test.mjs` |
| Full suite command | `npx tsx tests/seo/inject.test.mjs && npx tsx tests/seo/jsonld-parity.test.mjs` |

Confirmed: `tests/seo/inject.test.mjs` and `tests/seo/jsonld-parity.test.mjs` exist and test the `injectSeoMeta()` function directly.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FAV-02 | `{{FAVICON_URL}}` token replaces to custom URL in HTML | unit | `npx tsx tests/seo/inject.test.mjs` | ❌ Wave 0 — add test case to inject.test.mjs |
| FAV-03 | Empty `faviconUrl` → token expands to `/favicon.png` | unit | `npx tsx tests/seo/inject.test.mjs` | ❌ Wave 0 — add test case to inject.test.mjs |
| FAV-01 | Admin upload saves faviconUrl to DB | manual | navigate to admin > Company > Legal & Branding | N/A |
| WLTYPE-02 | Service delivery model radio saves and persists | manual | navigate to admin > Company > Legal & Branding | N/A |
| LEGAL-02 | Legal textarea saves content | manual | navigate to admin > Company > Legal & Branding | N/A |
| LEGAL-03 | `/privacy-policy` renders DB content | smoke | `curl http://localhost:5000/privacy-policy` — manual check | N/A |
| LEGAL-04 | Empty legal field shows placeholder | manual | clear privacyPolicyContent, visit `/privacy-policy` | N/A |

### Sampling Rate
- **Per task commit:** `npx tsx tests/seo/inject.test.mjs`
- **Per wave merge:** `npx tsx tests/seo/inject.test.mjs && npx tsx tests/seo/jsonld-parity.test.mjs && npm run check`
- **Phase gate:** Full suite green + manual smoke of legal pages and favicon in browser tab before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add `{{FAVICON_URL}}` token test cases to `tests/seo/inject.test.mjs`:
  - Case: `faviconUrl` set → token expands to custom URL (REQ FAV-02)
  - Case: `faviconUrl` empty → token expands to `/favicon.png` (REQ FAV-03)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded `/favicon.png` in `index.html` | `{{FAVICON_URL}}` token filled by SEO injector at request time | Favicon becomes DB-driven, no static fallback needed |
| Hardcoded legal text in PrivacyPolicy.tsx (263 lines) | DB-driven content via `dangerouslySetInnerHTML` (~80 lines) | Admin can update legal text without code deploy |
| `logoIcon` used as client-side favicon (use-seo.ts) | `faviconUrl` as dedicated favicon field | `logoIcon` returns to logo-only semantic; favicon is separate |

---

## Open Questions

1. **Should `type="image/png"` be removed from the favicon `<link>` tag?**
   - What we know: The current tag has `type="image/png"`. Supabase Storage serves files with correct MIME headers. If admin uploads a `.ico` or `.svg`, the `type` attribute will be technically wrong (not broken — browsers ignore it mostly).
   - What's unclear: Whether any browser or SEO tooling relies on the `type` attribute.
   - Recommendation: Remove `type="image/png"` when adding `{{FAVICON_URL}}`. Browsers derive MIME from the file content header, not the HTML attribute.

2. **Does the `publicCompanySettingsFallback` need to be a full `CompanySettings` shape?**
   - What we know: The fallback is typed as a plain object, not `CompanySettings`. The `PUT` handler uses `insertCompanySettingsSchema.partial()` which now includes `faviconUrl` (after schema update). The GET fallback serves this object when DB is unavailable.
   - What's unclear: Whether TypeScript enforces `CompanySettings` type on the fallback object (it doesn't — it's untyped).
   - Recommendation: Add all four new fields to the fallback anyway — consistency prevents silent undefined values on the client.

---

## Sources

### Primary (HIGH confidence — verified against live source files)

- `server/lib/seo-injector.ts` — token map structure, `escapeAttr` function, `{{COMPANY_NAME_ALT}}` placeholder comment at line 109
- `client/index.html` line 29 — confirmed `href="/favicon.png"` (NOT yet templated)
- `client/src/components/ui/radio-group.tsx` — `RadioGroup` + `RadioGroupItem` confirmed installed
- `client/src/components/ui/textarea.tsx` — `Textarea` confirmed installed
- `client/src/components/ui/separator.tsx` — `Separator` confirmed installed
- `client/src/components/admin/CompanySettingsSection.tsx` — `updateField` auto-save pattern, `handleLogoUpload` upload pattern confirmed
- `client/src/components/admin/shared/types.ts` — `CompanySettingsData` interface confirmed missing Phase 15 fields
- `server/routes/company.ts` — `publicCompanySettingsFallback` confirmed missing Phase 15 fields
- `client/src/pages/PrivacyPolicy.tsx` — 263 lines hardcoded, confirmed rewrite target
- `client/src/pages/TermsOfService.tsx` — 199 lines hardcoded, confirmed rewrite target
- `client/src/App.tsx` — routes `/privacy-policy` and `/terms-of-service` confirmed registered (lines 196–197)
- `client/src/hooks/use-seo.ts` lines 113–122 — `logoIcon` favicon block confirmed; requires D-07 update to `faviconUrl`
- `shared/schema.ts` lines 680–685 — Phase 15 columns confirmed present; `faviconUrl` not yet present
- `supabase/migrations/20260428000000_add_white_label_columns.sql` — Phase 15 migration confirmed; `20260430000000_add_favicon_url.sql` does NOT yet exist
- `.planning/STATE.md` — Phase 15 migration confirmed pending (Blockers section)
- `tests/seo/inject.test.mjs` — SEO injector test harness confirmed; runs via `npx tsx`

### Secondary (MEDIUM confidence)

- `client/src/pages/BlogPost.tsx` — DOMPurify usage pattern verified; legal pages explicitly differ (no DOMPurify per CONTEXT D-14/D-15)
- `.planning/config.json` — `nyquist_validation: true` confirmed; test section required

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified in live source files
- Architecture: HIGH — patterns traced through actual code, not documentation
- Pitfalls: HIGH — three pitfalls (Pitfall 1, 2, 4) confirmed by code inspection; others from CONTEXT decision rationale
- Critical gaps: HIGH — confirmed by inspecting `types.ts`, `company.ts`, and `CompanySettingsSection.tsx` directly

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable framework; no fast-moving dependencies)
