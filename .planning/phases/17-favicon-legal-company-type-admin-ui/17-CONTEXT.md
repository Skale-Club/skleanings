# Phase 17: Favicon, Legal & Company Type Admin UI — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Add admin UI for three Phase 15 schema columns (`serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent`) plus a new `faviconUrl` field — and update the customer-facing `/privacy` and `/terms` pages to render from the database instead of hardcoded boilerplate.

**In scope:**
- Supabase migration adding `faviconUrl TEXT DEFAULT ''` to `company_settings`
- Drizzle schema + TypeScript type update for `faviconUrl`
- New **"Legal & Branding"** sub-tab in the Company Settings admin section containing: favicon upload, service delivery model selector, privacy policy textarea, terms of service textarea
- `/privacy` → renders `companySettings.privacyPolicyContent` via `dangerouslySetInnerHTML` when non-empty; shows placeholder card when empty
- `/terms` → same pattern with `termsOfServiceContent`
- Extend Phase 16 SEO injector (`server/lib/seo-injector.ts`) with a `{{FAVICON_URL}}` token replacing the `<link rel="icon">` href in `client/index.html`

**Out of scope:**
- Rich text or Markdown editing (plain textarea only)
- `/favicon.ico` Express redirect route (injector handles favicon delivery)
- Phase 18 calendar improvements (separate phase)
- Changing the existing Company Settings tabs (General, SEO, etc.)

</domain>

<decisions>
## Implementation Decisions

### Schema — New faviconUrl Column
- **D-01:** Add `favicon_url TEXT DEFAULT ''` to `company_settings` via a new Supabase migration file (next timestamp after `20260428000000`). Update `shared/schema.ts` with `faviconUrl: text("favicon_url").default('')`. Regenerate `CompanySettings` type.
- **D-02:** No migration needed for `serviceDeliveryModel`, `privacyPolicyContent`, `termsOfServiceContent` — Phase 15 already added these columns.
- **D-03:** The existing `publicCompanySettingsFallback` in `server/routes/company.ts` must add `faviconUrl: ""` to stay in sync with the new column.

### Favicon Delivery (FAV-01/02/03)
- **D-04:** Extend the Phase 16 SEO injector in `server/lib/seo-injector.ts` with a `{{FAVICON_URL}}` token. The injector replaces `{{FAVICON_URL}}` with `escapeAttr(settings.faviconUrl)` when non-empty, or falls back to `/favicon.png` (the current static value). No new Express route needed.
- **D-05:** Update `client/index.html` to replace the hardcoded `href="/favicon.png"` in `<link rel="icon">` with `href="{{FAVICON_URL}}"`. The SEO injector will fill this token on every request.
- **D-06:** Empty `faviconUrl` → injector emits `/favicon.png` as the href value (existing static fallback). This satisfies FAV-03: no broken image request, no console error.
- **D-07:** Also update `client/src/hooks/use-seo.ts`'s favicon-update block (lines 121-129) to read `faviconUrl` rather than `logoIcon` for the `<link rel="icon">` update, since `faviconUrl` is now the canonical favicon field. `logoIcon` reverts to being logo-only.
- **D-08:** Admin favicon input is **upload-only** — no URL paste field. Uses the existing `POST /upload` endpoint in `server/routes/company.ts` to push to Supabase and receive the public URL, then saves it to `companySettings.faviconUrl`. Same UX pattern as existing logo upload inputs.

### Service Delivery Model Admin (WLTYPE-02)
- **D-09:** Three radio buttons with descriptive title + subtitle labels:
  - `at-customer` → "At Customer Location" / "We travel to your customers"
  - `customer-comes-in` → "Customer Comes In" / "Customers visit your location"
  - `both` → "Both" / "We serve customers on-site and at their location"
- **D-10:** Controlled by `form.watch("serviceDeliveryModel")` via react-hook-form + Zod (consistent with other Company Settings fields). Saved via the existing `PUT /api/company-settings` endpoint.

### Legal Content Admin (LEGAL-02)
- **D-11:** Two tall plain `<Textarea>` fields in the "Legal & Branding" tab: one for Privacy Policy, one for Terms of Service. No word count, no live preview, no Markdown rendering. Admin pastes HTML or plain text from a legal content generator (TermsFeed, ChatGPT, etc.).
- **D-12:** Field labels: "Privacy Policy Content" and "Terms of Service Content" with helper text: "Paste HTML or plain text. Leave empty to show the default placeholder for visitors."
- **D-13:** Saved together with the rest of Company Settings via the existing `PUT /api/company-settings` mutation. No separate save button — same "Save Changes" button as the rest of the tab.

### Legal Public Pages (LEGAL-03/04)
- **D-14:** `client/src/pages/PrivacyPolicy.tsx` is **rewritten entirely** — the 10-section hardcoded cleaning-company template is removed. When `settings.privacyPolicyContent` is non-empty, render it via `dangerouslySetInnerHTML={{ __html: settings.privacyPolicyContent }}` inside a simple `prose` container. The content is admin-authored and served behind an authenticated admin endpoint, so XSS risk is acceptable (same pattern as blog content).
- **D-15:** `client/src/pages/TermsOfService.tsx` is rewritten the same way.
- **D-16:** Empty state (LEGAL-04): when `privacyPolicyContent` is empty (or null/whitespace), render a centered card:
  ```
  Our privacy policy is being finalized.
  For questions, please contact [companyEmail] or [companyPhone].
  ```
  The `companyName`, `companyEmail`, and `companyPhone` from `companySettings` are used. The page does NOT redirect or 404 — it always renders something useful.
- **D-17:** Same empty-state pattern for `/terms`. If both `companyEmail` and `companyPhone` are empty, show: "For questions, please contact us through our website."
- **D-18:** The page title (`<h1>`) and header remain static ("Privacy Policy" / "Terms of Service") — these are not configurable. The `<title>` in the browser tab is handled by the existing SEO injector.

### Admin UI Placement
- **D-19:** Add a new **"Legal & Branding"** tab to the existing Company Settings admin section (wherever it's implemented in `client/src/pages/Admin.tsx` or equivalent). The tab contains four sections in order: (1) Favicon upload, (2) Service Delivery Model, (3) Privacy Policy textarea, (4) Terms of Service textarea.
- **D-20:** The new tab follows the existing Company Settings tab pattern: same card layout, same form state, same "Save Changes" button.

### Claude's Discretion
- Migration filename: next timestamp after `20260428000000_add_white_label_columns.sql` — use `20260430000000_add_favicon_url.sql`
- Column position in migration: `faviconUrl` appended after `termsOfServiceContent`
- Whether to use a single `<form>` for the entire Legal & Branding tab or separate forms per section — follow the existing Company Settings tab pattern
- Exact tab label (e.g., "Legal & Branding", "Branding & Legal", "Legal") — match admin's naming convention
- Whether `faviconUrl` needs to be added to the `publicCompanySettingsFallback` in server/routes/company.ts or whether it flows through automatically — verify during research

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & Migration
- `shared/schema.ts:633-690` — full `companySettings` table definition; `faviconUrl` must be added here
- `supabase/migrations/` — directory to place new `20260430000000_add_favicon_url.sql` migration file (Supabase CLI only — never drizzle-kit push per project constraint)
- `.planning/REQUIREMENTS.md` lines 184-211 — FAV-01..03, WLTYPE-02, LEGAL-02..04 acceptance criteria

### Phase 16 SEO Injector (extend for {{FAVICON_URL}})
- `server/lib/seo-injector.ts` — add `{{FAVICON_URL}}` token; read `faviconUrl` from settings; fallback to `/favicon.png`
- `client/index.html` — add `{{FAVICON_URL}}` token to `<link rel="icon" href="{{FAVICON_URL}}">` (currently `href="/favicon.png"` after Phase 16 retemplating — verify current state)
- `.planning/phases/16-seo-meta-injection/16-CONTEXT.md` — D-04 token list ({{FAVICON_URL}} was reserved as `{{COMPANY_NAME_ALT}}` — now a real token)

### Legal Pages (rewrite targets)
- `client/src/pages/PrivacyPolicy.tsx` — full file to rewrite (currently 263 lines, hardcoded cleaning content)
- `client/src/pages/TermsOfService.tsx` — full file to rewrite (currently 199 lines, hardcoded content)
- `client/src/App.tsx` — verify `/privacy` and `/terms` routes are already registered (pages exist; check Wouter route declarations)

### Admin UI
- `client/src/pages/Admin.tsx` — locate the Company Settings section and existing tab structure to place the new "Legal & Branding" tab
- `server/routes/company.ts:20-128` — `publicCompanySettingsFallback` + PUT handler (add `faviconUrl` to fallback; PUT already accepts any `insertCompanySettingsSchema` field)
- `server/routes/company.ts:65-87` — existing `/upload` POST endpoint — reuse for favicon upload button (returns `objectPath` as public URL)

### Client-Side Favicon Update
- `client/src/hooks/use-seo.ts:121-129` — current favicon update block reads `logoIcon`; update to read `faviconUrl` instead

### v2.0 Roadmap
- `.planning/ROADMAP.md` Phase 17 section — success criteria and requirement IDs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Upload pattern** (`server/routes/company.ts:65-87`): existing `POST /upload` returns a Supabase signed URL + public `objectPath`. The favicon upload button calls this endpoint, receives the URL, and calls `form.setValue("faviconUrl", objectPath)` before the save mutation fires. Same flow as logo uploads.
- **Company Settings form**: existing admin Company Settings likely uses `react-hook-form` + Zod + `PUT /api/company-settings`. The new "Legal & Branding" tab slots into this same form/mutation without changes to the save path.
- **Phase 16 SEO injector**: `injectSeoMeta(html, settings, req)` in `server/lib/seo-injector.ts` already has the token-replacement infrastructure. Adding `{{FAVICON_URL}}` is a one-liner in the token map.
- **`dangerouslySetInnerHTML` precedent**: the blog system likely uses this for post content rendering. Check `client/src/pages/BlogPost.tsx` for the pattern to follow.
- **Wouter routing**: existing routes for `/privacy` and `/terms` are almost certainly already registered since the page components exist — verify in `App.tsx` before adding new route declarations.

### Established Patterns
- **Legal content XSS note**: `privacyPolicyContent` and `termsOfServiceContent` are admin-authored only (no customer input path). `dangerouslySetInnerHTML` is acceptable per the same reasoning as blog post rendering. Do NOT sanitize with DOMPurify — unnecessary dependency for admin-only content.
- **Textarea sizing**: use `className="min-h-[400px] font-mono text-sm"` for the legal content textareas — the content will be long (full legal documents) and monospace makes pasted HTML readable.
- **Radio group**: shadcn/ui has a `RadioGroup` + `RadioGroupItem` component. Use it for the service delivery model selector.

### Integration Points
- `server/lib/seo-injector.ts` token map: add `"{{FAVICON_URL}}"` entry between existing tokens
- `client/index.html` `<link rel="icon">`: currently `href="/favicon.png"` after Phase 16 (verify); change href to `{{FAVICON_URL}}`
- `shared/schema.ts` `companySettings` table: add `faviconUrl` after `termsOfServiceContent`
- `server/routes/company.ts` `publicCompanySettingsFallback`: add `faviconUrl: ""`
- Admin tab structure in `Admin.tsx`: add "Legal & Branding" to the tab list

</code_context>

<specifics>
## Specific Ideas

- The `/privacy` and `/terms` pages should keep a simple branded header (company name in `<h1>`, primary color background header like the current design) even after the rewrite — only the body content section changes from hardcoded to DB-driven.
- The "Legal & Branding" tab sections could be visually separated with `<Separator>` components between Favicon, Service Delivery, Privacy, and Terms sections for clarity.
- The existing `PrivacyPolicy.tsx` and `TermsOfService.tsx` pages import many Lucide icons for the hardcoded sections — these imports can be removed in the rewrite (only the header icon stays: `Shield` for privacy, `ShieldCheck` for terms).

</specifics>

<deferred>
## Deferred Ideas

- **Markdown rendering for legal content** — if the admin wants Markdown support later, the plain-text textarea + `dangerouslySetInnerHTML` approach is forward-compatible: just add a markdown-to-HTML conversion step at render time without changing the DB schema. Defer until there's actual demand.
- **Legal version history / changelog** — tracking when the admin changed the policy. Belongs in a future compliance-focused phase.
- **Custom /privacy and /terms URL slugs** — some tenants may want `/privacy-policy` or `/terms-of-service`. Defer to a future routing-configuration phase.
- **`/favicon.ico` Express redirect route** — FAV-02 spec mentions this, but the SEO injector token approach handles the real-world favicon delivery mechanism (browser `<link rel="icon">`). The `/favicon.ico` redirect is low-value unless specifically needed for old crawlers. Deferred.
- **Sitemap.xml listing /privacy and /terms** — already listed in `server/routes/company.ts` sitemap (lines 184-185). No action needed.

</deferred>

---

*Phase: 17-favicon-legal-company-type-admin-ui*
*Context gathered: 2026-04-30*
