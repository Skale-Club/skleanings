# Phase 16: SEO Meta Injection - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side injection of tenant-specific SEO meta tags into the HTML response so search-engine crawlers and social platforms see correct values without depending on client-side React hydration.

Specifically: every HTML response from the app emits `<title>`, `<meta name="description">`, `<link rel="canonical">`, full Open Graph set (og:title, og:description, og:image, og:url, og:type, og:site_name), Twitter Card set (twitter:card, twitter:title, twitter:description, twitter:image), and a `<script type="application/ld+json">` LocalBusiness block — all populated from `companySettings` at request time.

Out of scope: route-aware per-page meta (e.g., distinct `<title>` per blog post or service slug). Site-wide meta from `companySettings` is emitted for every URL; per-page dynamic updates remain the responsibility of the existing client-side `useSEO` hook + page components like `BlogPost.tsx`. Anything that adds new admin UI (favicon upload, legal pages, service-delivery selector) belongs to Phase 17.

</domain>

<decisions>
## Implementation Decisions

### Production Rendering Pipeline
- **D-01:** HTML requests are rerouted through Express on Vercel — `vercel.json` rewrite for non-asset, non-API GETs goes to `/api/index.js` (the Express handler) instead of the static `/index.html`. The Express route reads `dist/public/index.html` from disk, runs the meta-injection transformer, and returns the rendered HTML. Static assets under `/assets/*` continue to be served directly by Vercel CDN with long-cache headers.
- **D-02:** Same injection function is mounted in two places: (a) `server/vite.ts` dev pipeline, between `vite.transformIndexHtml` and the response, and (b) the new prod Express HTML route. One injector, two mount points — dev parity guaranteed.
- **D-03:** `companySettings` singleton is cached in memory with a short TTL (30–60s) and explicit invalidation when admin saves company settings. Each HTML request re-renders the template (cheap string replacement on cached values) — no rendered-HTML caching layer.

### Template Strategy (SEO-05)
- **D-04:** `client/index.html` is retemplated to use explicit token markers wherever brand-specific content currently lives. Token list (subject to refinement during planning):
  - `{{SEO_TITLE}}` — `<title>` and twitter:title and og:title
  - `{{SEO_DESCRIPTION}}` — `<meta name="description">`, og:description, twitter:description
  - `{{CANONICAL_URL}}` — `<link rel="canonical">`, og:url, hreflang href
  - `{{OG_IMAGE}}` — og:image, twitter:image
  - `{{OG_IMAGE_ALT}}` — og:image:alt, twitter:image:alt
  - `{{OG_TYPE}}`, `{{OG_SITE_NAME}}`, `{{OG_LOCALE}}`
  - `{{TWITTER_CARD}}`, `{{TWITTER_SITE}}`, `{{TWITTER_CREATOR}}`
  - `{{ROBOTS}}`, `{{COMPANY_NAME_ALT}}` (favicon alt fallbacks)
  - `{{JSON_LD}}` — full JSON string (no surrounding quotes; injected as raw schema body)
- **D-05:** The middleware does naive global string replacement (`String.prototype.replaceAll`) on each token. No HTML parsing — keeps the cost negligible and audit easy (`grep '{{' client/index.html` shows every injection point).
- **D-06:** All replacement values are HTML-attribute-escaped before substitution (`&`, `<`, `>`, `"`, `'`) to prevent broken markup or XSS from admin-entered values. JSON-LD content is JSON-stringified (so embedded `</script>` is escaped to `<\/script>`), then injected literally.

### Empty / Day-One Tenant Fallbacks
- **D-07:** When `companySettings` row is missing or a field is empty, the injector emits **generic industry fallbacks**, not empty strings:
  - Title fallback: `companySettings.industry` value if present (e.g., `"Cleaning Services"`), else a literal generic like `"Professional Services"` (final wording decided in planning).
  - Description fallback: short generic line tied to industry.
  - og:image fallback: omitted entirely (do not emit `<meta property="og:image">` with empty content — crawlers prefer absent over empty).
  - Canonical fallback: `req.protocol + req.get('host') + req.originalUrl` if `seoCanonicalUrl` is empty.
  - JSON-LD fallback: a valid minimal LocalBusiness object with at least `@context`, `@type`, and `name` derived from `companyName || industry || "Local Business"`.
- **D-08:** Day-one site must remain indexable and presentable on social shares — never render `<title></title>` or empty meta tags.

### JSON-LD Source
- **D-09:** LocalBusiness schema is built by **deep-merging** `companySettings.schemaLocalBusiness` JSONB on top of a base object computed from individual fields. Base shape (mirrors current `client/src/hooks/use-seo.ts:47-69`):
  ```
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name":         companySettings.companyName,
    "description":  companySettings.seoDescription,
    "@id":          canonicalUrl,
    "url":          canonicalUrl,
    "telephone":    companySettings.companyPhone   (only if non-empty),
    "email":        companySettings.companyEmail   (only if non-empty),
    "address": {
      "@type": "PostalAddress",
      "streetAddress": companySettings.companyAddress
    } (only if companyAddress non-empty),
    "image":        companySettings.ogImage         (only if non-empty)
  }
  ```
  Then `schemaLocalBusiness` JSONB deep-merges on top — admin can override any field or add new ones (priceRange, openingHoursSpecification, sameAs, areaServed, etc.) without code changes.
- **D-10:** Success criterion #4 (`name matches companyName`) is satisfied by default — admin can override `name` via `schemaLocalBusiness.name` only if they explicitly want to. Document this in admin UI guidance (deferred to Phase 17 if surfaced there).

### Coexistence with Client Hook
- **D-11:** Existing `client/src/hooks/use-seo.ts` continues to run after server-side injection — defense in depth. Server is authoritative for first paint (and is what crawlers see); the client hook keeps tags correct after route changes and after admin saves settings without a full page reload. Tag updates are idempotent (the hook's `setMetaTag`/`setLinkTag` find-or-create logic already handles existing server-injected tags).
- **D-12:** Phase 16 does NOT modify `use-seo.ts` JSON-LD generation behaviorally, but **must keep it consistent** with the server's merge logic (D-09). If the client hook is left as-is, it will overwrite the server-emitted JSON-LD on hydration — the hook should be updated to use the same merge function (extracted to a shared helper) so both sides agree. Final implementation choice (extract shared util vs. duplicate logic) is left to planning.

### Page-Aware Meta (Out of Scope)
- **D-13:** Phase 16 emits site-wide meta only — same `companySettings`-derived tags on every URL. Per-page meta (e.g., `/blog/<slug>` distinct title from blog-post record) is **deferred** to future phase if needed. Existing client-side per-page updates in `BlogPost.tsx` (and any similar page) continue to work as today.

### Claude's Discretion
- Exact token-marker naming (e.g., `{{SEO_TITLE}}` vs `<!--SEO_TITLE-->`) — pick whichever lints cleanly in HTML and Vite during planning.
- Cache TTL exact value within the 30–60s range.
- Whether to extract a shared `buildLocalBusinessSchema()` helper used by both server middleware and `use-seo.ts`, or keep two parallel implementations that compute the same thing.
- Whether `vercel.json` rewrites for HTML go to a dedicated function file (e.g., `api/html.js`) or reuse the existing `api/index.js` Express handler with route-based dispatch.
- Default industry-fallback strings (the literal text emitted when `companySettings.industry` is also empty).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` § "Phase 16: SEO Meta Injection" — phase goal and 5 success criteria
- `.planning/REQUIREMENTS.md` lines 189-193 — SEO-01 through SEO-05 acceptance bullets
- `.planning/PROJECT.md` — project principles, white-label v2.0 vision

### Schema (read-only — no schema changes in this phase)
- `shared/schema.ts:633-690` — `companySettings` table definition; relevant SEO fields: `seoTitle`, `seoDescription`, `seoKeywords`, `seoAuthor`, `seoCanonicalUrl`, `seoRobotsTag`, `ogImage`, `ogType`, `ogSiteName`, `twitterCard`, `twitterSite`, `twitterCreator`, `schemaLocalBusiness` (jsonb), plus `companyName`, `companyEmail`, `companyPhone`, `companyAddress`, `industry`, `logoIcon`

### Reference Implementation (client-side)
- `client/src/hooks/use-seo.ts` — complete reference for which tags to emit, how og:image absolute-URL handling works (`startsWith('http')` check), and the LocalBusiness schema shape currently produced. The server injector should mirror this output exactly (modulo D-09 merge with `schemaLocalBusiness`)

### Server Pipeline (mount points)
- `server/index.ts:113-118` — production vs. dev branch; `serveStatic` is the prod static handler
- `server/static.ts` — current static serving; the new HTML middleware must run BEFORE the catch-all `app.use("*", res.sendFile(...))` at line 46
- `server/vite.ts:34-57` — dev HTML pipeline; `vite.transformIndexHtml(url, template)` is where dev-mode injection chains in
- `server/routes/company.ts:20-60` — `publicCompanySettingsFallback` shape; informs what an "empty" settings response looks like and is the contract for the `/api/company-settings` endpoint already used by `useSEO`

### Static Template (target of SEO-05)
- `client/index.html` — file that must be retemplated; current hardcoded "Skleanings" strings are at lines 6, 7, 14, 15, 17, 20, 21, 23, 24, 26, 29

### Deployment
- `vercel.json` — current rewrite rules (lines 4-30); D-01 requires updating the `/(.*)` catch-all so HTML routes hit `/api/index.js` instead of `/index.html`. Static `/assets/*` and direct file requests must keep their fast paths
- `api/index.js` — current Vercel Express handler (build artifact)
- `script/build.mjs` — server build pipeline; verify the new middleware ships into `dist/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`client/src/hooks/use-seo.ts`** — full reference for tag list, og:image absolute-URL normalization, and JSON-LD shape; reuse as the contract for what server emits. Consider extracting `buildLocalBusinessSchema()` and the og:image absolutifier into `shared/` utilities consumed by both client and server.
- **`server/routes/company.ts` `publicCompanySettingsFallback`** — already defines a "safe defaults" object for missing `companySettings`; align the empty-fallback contract (D-07) with this so client and server have one notion of "empty".
- **`server/lib/sanitize.ts`** (`sanitizeHomepageContent`) — established pattern for sanitizing admin-entered content before it leaves the server; D-06 attribute escaping should follow the same defensive-by-default style.
- **In-memory caching pattern** — repo already does light caching elsewhere (e.g., `server/lib/seeds.ts`, `public-data-fallback.ts`). Pick the pattern most consistent with existing code rather than introducing a new cache library.

### Established Patterns
- **Singleton companySettings**: every consumer treats missing row as "empty defaults", never as an error. The injector follows this pattern.
- **Storage layer is authoritative**: all DB reads go through `server/storage.ts` (`storage.getCompanySettings()`); the injector calls the storage method, not raw SQL.
- **Type safety**: `CompanySettings` type from `shared/schema.ts` is the canonical shape. Injector parameters are typed against it.
- **Express middleware order**: `server/index.ts` registers routes via `registerRoutes` then mounts static / vite. New HTML injection middleware must register BEFORE `serveStatic` (prod) and BEFORE Vite's catch-all (dev).

### Integration Points
- **vercel.json rewrites** (D-01) — the single deployment switch that makes everything else reachable in prod.
- **`server/static.ts`** — needs a new HTML route registered before the catch-all `app.use("*")`, OR the catch-all itself replaced by the injecting handler.
- **`server/vite.ts:46-52`** — between `transformIndexHtml` and `res.end(page)`, run the injector on the transformed string.
- **`storage.getCompanySettings()`** — likely already exists from Phase 15; verify and use as the cache source-of-truth.
- **Admin save path** for company settings (PATCH/PUT in `server/routes/company.ts`) — emit a cache-invalidation event after successful write so the next HTML request re-fetches.

### Constraints from Architecture
- **No SSR framework** — this is a Vite SPA, not Next.js. The injector is a plain string-template middleware, not React renderToString.
- **Vercel serverless cold start** — every HTML request hitting Express on a cold instance pays the cold start. The companySettings cache mitigates ongoing cost; first request after deploy will be slower (acceptable trade-off).
- **No automated test runner** (per `AGENTS.md`/codebase TESTING.md) — verification will rely on `curl` checks per success criteria #1–#5 and admin-side smoke tests.

</code_context>

<specifics>
## Specific Ideas

- The injector's input contract = (req: Request, html: string, settings: CompanySettings | null) → string. Pure function (modulo cache read inside the wrapper) — easy to unit-test mentally and trivially swappable.
- Token list in D-04 is a starting list, not exhaustive — planning may add tokens for `<meta name="keywords">`, `<meta name="author">`, `<meta name="theme-color">`, etc. as needed by REQUIREMENTS spot-checks.
- The "no static 'Skleanings'" verification (SEO-05) is a literal grep test: `grep -i "skleanings" client/index.html` must return zero matches. Add this as a one-line check the verifier can run.

</specifics>

<deferred>
## Deferred Ideas

- **Per-page dynamic meta** (route-aware titles, e.g., `/blog/<slug>` distinct og:image from blog post record). Phase 16 goal can be read as requiring this, but the success criteria explicitly only test homepage/site-wide values. Belongs in a future "SEO per-page" phase if customer demand emerges.
- **Sitemap.xml and robots.txt generation** (already routed via `vercel.json` to `/api/index.js`, but no implementation yet inspected) — separate concern from meta injection. Track for a future SEO-completeness phase.
- **Multi-locale meta** (hreflang variants for non-en-US tenants) — current `companySettings` has no locale list; would require schema additions. Defer.
- **Schema.org types other than LocalBusiness** (Organization, Service, Product) — the JSONB column technically supports any `@type`, but Phase 16 commits only to LocalBusiness as success criterion #4 specifies.
- **Cache-Control headers for HTML responses** — adjacent to D-03 caching but a different layer. Default to `no-cache, must-revalidate` until a real CDN strategy is decided.

</deferred>

---

*Phase: 16-seo-meta-injection*
*Context gathered: 2026-04-29*
