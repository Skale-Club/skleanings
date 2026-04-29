# Phase 16: SEO Meta Injection — Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Express middleware reads `companySettings` at request time and rewrites `<title>`, canonical URL, Open Graph tags, Twitter Card tags, and a schema.org JSON-LD `<script>` block in the HTML response — replacing the hardcoded "Skleanings" meta currently embedded in `client/index.html`.

**In scope:**
- New SEO middleware (or transform function) that runs in BOTH dev (`server/vite.ts`) and prod (`server/static.ts`) paths
- Single tenant-derived meta set applied globally to all routes
- `client/index.html` rewritten to use placeholder tokens (e.g., `{{seoTitle}}`)
- In-memory cache (60s TTL) of the resolved meta payload to avoid per-request DB hits
- JSON-LD sourced from `companySettings.schemaLocalBusiness` (jsonb), with `name` auto-filled from `companyName` when the jsonb is empty
- Zero `"Skleanings"` matches in `client/index.html` (SEO-05)

**Out of scope (other phases):**
- Per-route page titles (e.g., "Services | Company") — deferred, not in v2.0 milestone
- Favicon dynamic serving — Phase 17
- Admin UI for editing SEO fields — already exists for `seoTitle`, `seoDescription`, `ogImage`; Phase 17 adds favicon + legal
- Sitemap generation, robots.txt customization, hreflang per-tenant
- Per-page Open Graph image overrides

</domain>

<decisions>
## Implementation Decisions

### Meta Coverage Model
- **D-01:** Single tenant-derived meta set applied to ALL routes — no per-route customization in this phase. Every route serves the same `<title>`, og:*, twitter:*, JSON-LD derived from `companySettings`. Per-route titles ("Services | Company") are deferred to a future phase.
- **D-02:** All 6 success-criterion meta groups injected: `<title>`, canonical, og:* (title/description/image/site_name/url/type/locale), twitter:* (card/title/description/image), and JSON-LD LocalBusiness `<script>` block.

### Token Replacement Strategy
- **D-03:** `client/index.html` uses placeholder tokens with `{{handlebars-style}}` syntax — example: `<title>{{seoTitle}}</title>`, `<meta property="og:title" content="{{ogTitle}}">`. The middleware reads the file template and runs simple `String.replaceAll` per token.
- **D-04:** No new dependency added (no cheerio, jsdom, handlebars, eta). String-replace is fast enough for the few-dozen tokens involved and matches the project's lean-stack philosophy.
- **D-05:** Token list (canonical names) is centralized in a single TypeScript source file (e.g., `server/lib/seo-meta.ts`) so the dev path (`server/vite.ts`), prod path (`server/static.ts`), and the static `client/index.html` template stay in sync.

### Caching Strategy
- **D-06:** In-memory cache of the resolved meta payload with **60-second TTL**. First request after expiry hits the DB; subsequent requests hit cache. No invalidation on `POST /api/company-settings` — admin accepts up to 60s lag for SEO meta changes.
- **D-07:** Cache key is the rendered meta object (one row, one tenant) — single global key, no per-tenant or per-route partitioning. Cache stored as a module-level variable in `server/lib/seo-meta.ts`.
- **D-08:** Cache is populated lazily on first HTML request, NOT pre-warmed at server startup. If `companySettings` row is missing or all SEO fields empty, the cache stores the empty/default payload and tokens resolve to empty strings.

### JSON-LD Source
- **D-09:** Read `companySettings.schemaLocalBusiness` (jsonb) directly and inject as the JSON-LD body — admin owns the entire structured-data object.
- **D-10:** When `schemaLocalBusiness` is empty `{}` or missing `name`, auto-fill `name` from `companySettings.companyName`. This guarantees SEO-04 ("LocalBusiness schema whose `name` matches `companySettings.companyName`") is satisfied even when admin hasn't edited the jsonb.
- **D-11:** When BOTH `schemaLocalBusiness` and `companyName` are empty, omit the entire `<script type="application/ld+json">` block from the response (don't render `{}` or `{"name":""}` — empty schema is worse than no schema).

### Static File Treatment
- **D-12:** `client/index.html` strips ALL hardcoded "Skleanings" / "https://skleanings.com" / brand-specific meta values. Replaced with token placeholders. Net result: `grep -n "Skleanings" client/index.html` returns ZERO matches (SEO-05).
- **D-13:** `<link rel="icon">` is left as-is in `client/index.html` for Phase 16 — favicon dynamic serving is Phase 17. The static `/favicon.png` reference remains.
- **D-14:** Non-brand static elements (Google Fonts preconnect, format-detection meta, `<div id="root">`, initial loader divs) remain unchanged.

### Middleware Wiring
- **D-15:** SEO transform is implemented as a SHARED function `applySeoMeta(template: string): Promise<string>` in `server/lib/seo-meta.ts` — called by both `server/vite.ts` (dev) and `server/static.ts` (prod) so the transform logic has one source of truth.
- **D-16:** In dev (`server/vite.ts`), the transform runs AFTER the existing `vite.transformIndexHtml(url, template)` call — Vite's transform handles HMR injection; SEO transform handles brand tokens. Order: read file → vite transform → SEO transform → respond.
- **D-17:** In prod (`server/static.ts`), the transform runs in a custom Express middleware registered BEFORE `app.use(express.static(distPath))` — this middleware intercepts requests for `/`, `/index.html`, and the catch-all `*`. The middleware reads `dist/public/index.html` once at startup, applies the SEO transform per request (with cache), and responds with the rewritten HTML. Static asset requests (`/assets/*`, images, etc.) bypass the middleware via path-prefix matching.
- **D-18:** Cache: even though the transformed output could be cached, only the META PAYLOAD (the resolved `companySettings` values) is cached. The string-replace on the template runs per request because the template is small and the operation is microsecond-cheap.

### Empty/Missing Data Handling
- **D-19:** White-label principle (carried from Phase 15 D-11): when a SEO field is empty, render an empty string in its meta tag rather than a brand-specific fallback. Example: `<meta property="og:title" content="">`. Never inject "Skleanings" as a fallback.
- **D-20:** Exception for SEO hygiene: if `seoTitle` is empty BUT `companyName` is set, fall back `<title>` to `companyName`. An empty `<title>` is bad for SEO; a tenant name is better than nothing.

### Claude's Discretion
- Exact module file path: `server/lib/seo-meta.ts` (recommended) vs `server/middleware/seo.ts` — planner picks
- Exact token names (`{{seoTitle}}` vs `{{COMPANY_NAME}}` vs `<!--SEO_TITLE-->`) — planner picks; consistent throughout
- Cache implementation: simple `{ value, expiresAt }` object vs `Map` vs LRU — planner picks (60s TTL with one key, simplest is fine)
- Exact set of canonical URL tags (`<link rel="canonical">`, hreflang variants) — researcher to confirm SEO best practice; planner picks reasonable defaults
- Whether to also strip Twitter image:alt and og:image:alt or leave as static — planner decides

### Folded Todos
None — backlog has no Phase 16 candidates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` Phase 16 (lines 171–181) — goal + 5 success criteria
- `.planning/REQUIREMENTS.md` SEO-01 through SEO-05 — full requirement text

### Schema (already in place from Phase 15)
- `shared/schema.ts:656` — `seoTitle`, `seoDescription`, `ogImage` columns (text, default '')
- `shared/schema.ts:672` — `schemaLocalBusiness` (jsonb, default `{}`)
- `shared/schema.ts:633+` — full `companySettings` table; check for any other SEO-relevant columns (canonical URL, og:site_name, twitter handle)

### Files to modify
- `client/index.html` — replace ALL brand-specific meta with token placeholders (SEO-05)
- `server/vite.ts` lines 34–57 — dev mode handler; integrate SEO transform between `vite.transformIndexHtml` and the response (D-16)
- `server/static.ts` lines 10–49 — prod mode static serving; add SEO middleware before `express.static` (D-17)
- `server/lib/seo-meta.ts` — NEW file; shared `applySeoMeta(template)` function + token list + cache (D-15)

### Storage layer
- `server/storage.ts` `getCompanySettings()` (line ~891) — full-row select confirmed in Phase 15 Risk 1; the SEO middleware can use this directly

### Phase 15 carry-forward
- `.planning/phases/15-schema-foundation-detokenization/15-CONTEXT.md` D-11 — empty over wrong tenant name (white-label principle)
- `.planning/phases/15-schema-foundation-detokenization/15-VERIFICATION.md` — DETOK-03 left zero "Skleanings" in `client/src/`; Phase 16 extends the assertion to `client/index.html`

### Build constraint (carried from earlier phases)
- `companySettings` is a singleton row — middleware MUST handle missing row with safe defaults (no crash)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`getCompanySettings()` storage method** (server/storage.ts:891) — full-row select; the only DB call the SEO middleware needs.
- **Existing schema fields ready for SEO:** `seoTitle`, `seoDescription`, `ogImage`, `schemaLocalBusiness` (jsonb), `companyName`. No new columns needed.
- **`server/vite.ts:34` catch-all** — already reads `client/index.html` from disk per request and runs `vite.transformIndexHtml`. Drop-in extension point for the SEO transform.
- **`server/static.ts:43,46` static serving** — `express.static(distPath)` + catch-all SPA fallback. The SEO middleware sits in front of both.

### Established Patterns
- **Lean stack** — no new deps. String-replace + a small in-memory cache fit this philosophy.
- **Module-level singletons** — server-side modules use module-level variables for caches (e.g., `db.ts` connection). Same pattern for the SEO meta cache.
- **Async middleware** — Express handlers in this project are async functions returning HTML. The SEO transform is async because the storage call is async; cache hit returns synchronously inside the async fn.

### Integration Points
- **Dev middleware order:** Vite middlewares (HMR, asset serving) → catch-all `app.use("*", ...)` → response. SEO transform fits inside the catch-all.
- **Prod middleware order:** routes → `/assets` static (cached) → `express.static(distPath)` → catch-all. SEO middleware MUST register BEFORE `express.static` to intercept `/` and `/index.html`. Use a path filter to avoid intercepting other static files.
- **No service worker / no SSR framework** — this is plain Vite + Express with hand-rolled SPA shell. No Next.js, no Remix, no special meta API.

### Constraints
- The SEO middleware runs on EVERY HTML request. Performance budget: <5ms per request including cache lookup. String-replace on a ~4KB template is microseconds; DB call is the only slow operation, and it's cached.
- Vite dev mode adds HMR script tags to the HTML. The SEO transform must NOT strip those — run AFTER Vite's transform per D-16.
- The static path resolver in `server/static.ts:12-17` tries multiple paths (Vercel, local, build). The SEO middleware must use the SAME resolved path to read the prod template.

</code_context>

<specifics>
## Specific Ideas

- The existing `client/index.html` has a `<script id="ld-localbusiness" type="application/ld+json">` block (line ~28). Phase 16 replaces its body with the token-resolved JSON-LD object. The script tag itself remains; only its content is templated.
- The hardcoded `<link rel="canonical" href="https://skleanings.com/">` line MUST be replaced with token. Researcher should verify whether `companySettings` has a `canonicalBaseUrl` column or if we use `req.protocol + req.get('host')` to derive it.
- `<meta property="og:url">` should reflect the actual URL of the page being served (per OG spec) — researcher confirms whether to derive from `req.originalUrl` or use a static value.

</specifics>

<deferred>
## Deferred Ideas

- **Per-route page titles** ("Services | Company", "Privacy | Company") — natural extension once tenant meta is wired; defer to v2.x or a polish phase.
- **Per-page og:image overrides** — admin sets a different OG image per page (e.g., the services hero on `/services`). Defer.
- **Sitemap auto-generation** — sitemap.xml served from DB.
- **robots.txt per-tenant** — tenant choice between index/noindex; not in v2.0 scope.
- **Cache invalidation on admin write** — current 60s TTL is acceptable; instant invalidation can be added later if admins complain about lag.
- **Hreflang per-tenant** — currently hardcoded `en-US`; multi-locale is a future capability.
- **Twitter `@handle` field** — not in current `companySettings` schema; not in Phase 16 success criteria.

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 16-seo-meta-injection*
*Context gathered: 2026-04-29*
