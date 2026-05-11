# Phase 16: SEO Meta Injection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 16-seo-meta-injection
**Areas discussed:** Production rendering pipeline, Caching strategy, Template strategy, Empty/day-one fallback, JSON-LD source, Client hook coexistence

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Production rendering pipeline | How HTML requests reach the meta-injection layer in production. Vercel rewrites currently bypass Express. CRITICAL — affects feasibility of every other decision. | ✓ |
| index.html template & empty fallback | What the static template looks like once "Skleanings" is removed (SEO-05). Token markers, empty content, or stripped tags. Plus day-one tenant fallback policy. | ✓ |
| JSON-LD schema source | Use schemaLocalBusiness JSONB as-is, merge with computed defaults, or rebuild from individual fields. | ✓ |
| Per-page vs site-wide meta | Different meta per /blog/<slug>, /services/<slug>, etc. or one site-wide set. | ✗ (skipped — borderline scope creep, deferred) |

**User's choice:** "faca o recomendado" — interpreted as: discuss the three essential areas (production pipeline, template, JSON-LD) and skip the borderline-scope per-page question.

---

## Client Hook Coexistence

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both — defense in depth | Server authoritative on first paint; client `useSEO` keeps tags correct after route changes / settings reloads. Idempotent. | ✓ |
| Remove useSEO entirely | Server-side becomes only source of truth. Loses dynamic per-page updates. | |
| Slim useSEO to dynamic-only | Server handles initial paint; client only handles per-page changes. | |
| You decide | Defer to Claude. | |

**User's choice:** Keep both — defense in depth (Recommended)
**Notes:** Captured as D-11/D-12 in CONTEXT.md; client and server JSON-LD logic must stay in sync (extract shared helper or duplicate, decided in planning).

---

## Production Rendering Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Reroute HTML to Express on Vercel | Update vercel.json so non-asset HTML hits /api/index.js. Express middleware reads index.html, injects from DB, returns rendered. Matches roadmap's literal "Express middleware reads at request time" goal. | ✓ |
| Vercel Edge Middleware | Use middleware.ts at edge. Faster but adds a separate runtime calling back to /api for DB. | |
| Build-time injection only | Pre-render index.html at build. Fast but breaks white-label promise (one build per tenant). | |
| Express middleware with dev parity | Same as option 1 with explicit dev/prod injector parity called out. | (folded into D-02) |

**User's choice:** Reroute HTML to Express on Vercel (Recommended)
**Notes:** Decision captured as D-01. Dev parity (option 4 idea) folded in as D-02 — same injector function mounted in both `server/vite.ts` and the new prod Express HTML route.

---

## Caching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory companySettings cache, fresh HTML per request | Cache singleton row 30-60s with admin-save invalidation. Re-render HTML on each request (cheap string replace). | ✓ |
| Cache rendered HTML with ETag | Cache full HTML keyed by updated_at. Faster but more invalidation complexity. | |
| No caching | DB hit per HTML request. Unnecessary for a singleton. | |
| You decide | Defer to Claude. | |

**User's choice:** In-memory companySettings cache, fresh HTML per request (Recommended)
**Notes:** Captured as D-03. TTL exact value within 30-60s range left to planning (Claude's discretion).

---

## Template Strategy (SEO-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Token markers replaced by middleware | `{{SEO_TITLE}}`, `{{OG_IMAGE}}`, `{{JSON_LD}}` etc. Naive string replacement. Easy to audit (grep `{{`). | ✓ |
| Empty content attributes filled by selectors | Empty `content=""` filled via DOM parse. Heavier; static file looks broken if served unfilled. | |
| Strip all SEO meta from index.html, middleware injects fresh | Index.html has only structural tags; middleware injects entire `<!--SEO_BLOCK-->`. Cleanest separation but brittle if injection fails. | |

**User's choice:** Token markers replaced by middleware (Recommended)
**Notes:** Captured as D-04 (token list) and D-05 (replacement mechanism). HTML-attribute escaping requirement added as D-06 to prevent admin-entered values breaking markup or enabling XSS.

---

## Empty / Day-One Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Generic industry fallbacks | Title from `industry` field, generic description, omit og:image, valid empty LocalBusiness schema. Site indexable and presentable. | ✓ |
| Empty strings everywhere | Emit `<title></title>` if seoTitle missing. Honest but looks broken until configured. | |
| Use companyName as universal fallback | When seoTitle missing fall back to companyName. Lighter than industry fallbacks. | |
| You decide | Defer to Claude. | |

**User's choice:** Generic industry fallbacks (Recommended)
**Notes:** Captured as D-07 (fallback chain per field) and D-08 (no empty tags ever). Exact literal text for ultimate-fallback strings (when industry is also empty) is Claude's discretion in planning.

---

## JSON-LD Source

| Option | Description | Selected |
|--------|-------------|----------|
| Merge: computed defaults overridden by schemaLocalBusiness | Build base from individual fields, deep-merge JSONB on top. Default-correct, admin-overridable. | ✓ |
| schemaLocalBusiness as-is, ignore individual fields | Total admin control. Day-one emits `{}` — fails SC #4. | |
| Always rebuild from individual fields, ignore schemaLocalBusiness | Mirrors current useSEO. Simplest. Makes JSONB column dead weight. | |
| You decide | Defer to Claude. | |

**User's choice:** Merge: computed defaults overridden by schemaLocalBusiness (Recommended)
**Notes:** Captured as D-09 (merge contract with explicit base shape) and D-10 (success criterion #4 satisfied by default). Planning must decide whether to extract a shared `buildLocalBusinessSchema()` used by both server middleware and `client/src/hooks/use-seo.ts` so they don't drift.

---

## Claude's Discretion

- Exact token-marker syntax (`{{SEO_TITLE}}` vs HTML-comment-style `<!--SEO_TITLE-->`).
- Cache TTL within the 30–60s range.
- Whether shared util `buildLocalBusinessSchema()` is extracted or duplicated.
- Whether vercel.json rewrites for HTML go to a dedicated function file or reuse the existing `api/index.js` Express handler.
- Default industry-fallback literals (when both seoTitle AND industry are empty).
- Final exhaustive token list — D-04 starting list may grow during planning.

## Deferred Ideas

- Per-page dynamic meta (route-aware titles for blog posts, services).
- Sitemap.xml / robots.txt generation (already routed but unimplemented).
- Multi-locale hreflang variants.
- Schema.org types beyond LocalBusiness.
- Cache-Control header strategy for HTML responses.
