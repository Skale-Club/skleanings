---
phase: 16-seo-meta-injection
plan: "01"
subsystem: seo
tags: [seo, server-side-injection, schema-builder, cache, token-replacement]
dependency_graph:
  requires: []
  provides:
    - shared/seo.ts (buildLocalBusinessSchema, deepMerge, isPlainObject)
    - server/lib/seo-injector.ts (injectSeoMeta, escape helpers, TTL cache)
    - tests/seo/ (Wave 0 harnesses)
  affects:
    - server/routes/company.ts (cache invalidation on admin save)
    - plan 16-02 (dev/prod pipeline mount points)
    - plan 16-03 (client useSEO hook migration to shared builder)
tech_stack:
  added: []
  patterns:
    - "Token-based server-side HTML injection ({{TOKEN}} markers, replaceAll with function replacer)"
    - "In-memory TTL cache (45s) with explicit invalidation"
    - "D-07 conditional tag-block emission (whole cluster omitted on empty ogImage)"
    - "Pure function injector + thin cache wrapper separation"
key_files:
  created:
    - shared/seo.ts
    - server/lib/seo-injector.ts
    - tests/seo/inject.test.mjs
    - tests/seo/curl-checks.sh
    - tests/seo/check-jsonld.mjs
  modified:
    - server/routes/company.ts
decisions:
  - "replaceAll uses function replacer (()=>v) to prevent $ special patterns corrupting JSON-LD values"
  - "escapeJsonLd uses String.fromCharCode(0x2028/0x2029) to avoid literal U+2028/U+2029 in source"
  - "OG_IMAGE_BLOCK/TWITTER_IMAGE_BLOCK are whole-tag tokens per D-07 (absent when ogImage empty)"
  - "ogImageAbsolute computed once at injector top, shared with both og:image block and schema builder"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-29"
  tasks_completed: 4
  files_modified: 6
---

# Phase 16 Plan 01: SEO Foundation (Injector + Cache + Wave 0 Tests) Summary

Built the complete server-side SEO injection foundation: a shared pure schema builder, the token-replacement injector with D-07 conditional image-block emission, a 45-second TTL cache wired to admin save invalidation, and a 7-case pure-function test harness proving escaping, fallbacks, JSONB merge, and D-07 compliance.

## What Was Built

### shared/seo.ts

Pure schema builder shared between server injector and client useSEO hook (D-12).

**Exports:**

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `isPlainObject(v)` | `(unknown) => v is Record<string,unknown>` | Guard for recursive merge traversal |
| `deepMerge(base, override)` | `<T>(T, unknown) => T` | 2-level recursive merge; arrays replace; null replaces; non-objects return base |
| `buildLocalBusinessSchema(settings, canonicalUrl)` | `(CompanySettings\|null, string) => Record<string,unknown>` | Builds LocalBusiness schema from settings + JSONB override |

**Fallback chain for `name`:** `companyName || ogSiteName || industry || "Local Business"`

### server/lib/seo-injector.ts

**Exports:**

| Symbol | Signature | Purpose |
|--------|-----------|---------|
| `escapeAttr(value)` | `(string) => string` | HTML attribute escape: `& < > " '` → `&amp; &lt; &gt; &quot; &#39;` |
| `escapeJsonLd(value)` | `(string) => string` | Escapes `</script` (case-insensitive) and U+2028/U+2029 line separators |
| `buildCanonicalUrl(settings, req)` | `(CompanySettings\|null, InjectorReq) => string` | Returns `seoCanonicalUrl` or `protocol://host/path` (trailing slash removed) |
| `injectSeoMeta(html, settings, req)` | `(string, CompanySettings\|null, InjectorReq) => string` | Pure token replacement function (14 tokens from D-04) |
| `invalidateSeoCache()` | `() => void` | Clears module-level cache; next call re-fetches |
| `getCachedSettings()` | `() => Promise<CompanySettings\|null>` | TTL cache: 45s, Vercel branch, error returns null |
| `InjectorReq` | `interface` | `{ protocol, host, originalUrl }` |

**Cache:** Module-level `let cached` variable (single-instance cache). TTL_MS = 45,000 (45 seconds, middle of D-03 range). Vercel branch calls `getFallbackCompanySettings()`; otherwise calls `storage.getCompanySettings()`. Errors caught and return null.

**Cache invalidation call site:** `server/routes/company.ts` PUT `/api/company-settings` — called AFTER `await storage.updateCompanySettings(validatedData)` succeeds, BEFORE `res.json(...)`. Not called on Zod validation error or DB failure.

## 14-Token Map (D-04)

| Token | Source Field | Empty-Tenant Fallback | Notes |
|-------|-------------|----------------------|-------|
| `{{SEO_TITLE}}` | `settings.seoTitle` | `${companyName} \| ${industry}` | Attribute-escaped |
| `{{SEO_DESCRIPTION}}` | `settings.seoDescription` | `Professional ${industry.toLowerCase()} for your home or business.` | Attribute-escaped |
| `{{CANONICAL_URL}}` | `settings.seoCanonicalUrl` | `req.protocol://req.host/req.originalUrl` | Attribute-escaped, trailing slash removed |
| `{{OG_IMAGE_BLOCK}}` | `settings.ogImage` → absolutized | EMPTY STRING (whole cluster omitted) | **Whole-tag block, NOT attribute token** — D-07 compliance |
| `{{TWITTER_IMAGE_BLOCK}}` | `settings.ogImage` → absolutized | EMPTY STRING (whole cluster omitted) | **Whole-tag block, NOT attribute token** — D-07 compliance |
| `{{OG_TYPE}}` | `settings.ogType` | `"website"` | Attribute-escaped |
| `{{OG_SITE_NAME}}` | `settings.ogSiteName` | `companyName` (or industry) | Attribute-escaped |
| `{{OG_LOCALE}}` | hardcoded | `"en_US"` | Attribute-escaped |
| `{{TWITTER_CARD}}` | `settings.twitterCard` | `"summary_large_image"` | Attribute-escaped |
| `{{TWITTER_SITE}}` | `settings.twitterSite` | `""` | Attribute-escaped |
| `{{TWITTER_CREATOR}}` | `settings.twitterCreator` | `""` | Attribute-escaped |
| `{{ROBOTS}}` | `settings.seoRobotsTag` | `"index, follow"` | Attribute-escaped |
| `{{COMPANY_NAME_ALT}}` | `settings.companyName` | industry | Attribute-escaped; reserved for Phase 17 favicon |
| `{{JSON_LD}}` | `buildLocalBusinessSchema(settingsForSchema, canonicalUrl)` | Valid LocalBusiness with fallback name | `escapeJsonLd` applied, NOT attribute-escaped |

## D-07 Compliance: Absent on Empty

When `settings.ogImage` is empty/falsy:
- `{{OG_IMAGE_BLOCK}}` → empty string → `<meta property="og:image">` and `<meta property="og:image:alt">` are **entirely absent** from rendered HTML
- `{{TWITTER_IMAGE_BLOCK}}` → empty string → `<meta name="twitter:image">` and `<meta name="twitter:image:alt">` are **entirely absent**

This guarantees crawlers see the tags **absent** (not present-with-empty-content), per D-07.

When `settings.ogImage` is non-empty:
- Relative paths are absolutized: `${req.protocol}://${req.host}${settings.ogImage}`
- Absolute paths (`startsWith("http")`) used as-is
- Same absolutized URL used in BOTH the og/twitter image blocks AND the JSON-LD `image` field (Pitfall 3 fix)

## Wave 0 Test Harnesses

### Run pure-function unit tests (no server needed)
```bash
npx tsx tests/seo/inject.test.mjs
```
7 cases: full-settings, null-settings-fallback, req-derived-canonical, JSONB-merge-override, HTML-attribute-XSS-escape, JSON-LD-XSS-escape, og-image-absolutification, D-07-absent-on-empty.

### Run curl assertions (requires running dev server)
```bash
# Start server first:
npm run dev

# In another terminal:
BASE_URL=http://localhost:5000 bash tests/seo/curl-checks.sh
```
5 assertions covering SEO-01..05. Note: the curl script requires Plan 16-02 (index.html retemplating + pipeline wiring) to be complete before SEO-01..04 pass. SEO-05 (no "Skleanings" in index.html) can be checked standalone via:
```bash
grep -ci skleanings client/index.html
```

### JSON-LD parser (used by curl script)
```bash
# Standalone usage:
curl -s http://localhost:5000/ | node tests/seo/check-jsonld.mjs "Expected Company Name"
```
Exits 0 with `OK:<name>` on success; exits 1-3 with diagnostic on failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] String.prototype.replaceAll interprets `$$` in replacement string as literal `$`**
- **Found during:** Task 3 test execution (case 4 — JSONB merge with `priceRange: "$$$"`)
- **Issue:** `out.replaceAll(k, v)` where `v` contains `"$$$"` — JavaScript's replaceAll replacement string interprets `$$` as a literal `$`, so `"$$$"` becomes `"$$"` in output, silently corrupting JSON-LD values containing dollar signs
- **Fix:** Changed `out.replaceAll(k, v)` to `out.replaceAll(k, () => v)` — function replacers bypass special `$` pattern interpretation entirely
- **Files modified:** `server/lib/seo-injector.ts` (commit `a0b8358`)
- **Impact:** Correctness fix for any tenant using `$` in `priceRange`, `description`, or any other schema field; no behavioral change for values without `$`

**2. [Rule 2 - Implementation] Used `String.fromCharCode(0x2028/0x2029)` instead of literal U+2028/U+2029 in escapeJsonLd**
- **Found during:** Task 2 implementation
- **Issue:** The plan specified using JS regex Unicode-escape forms (` `, ` `) but embedding these as `new RegExp(' ', 'g')` would embed literal code points via string escaping; source files with literal U+2028/U+2029 can cause issues in some environments
- **Fix:** Used `new RegExp(String.fromCharCode(0x2028), "g")` and `String.fromCharCode(0x2029)` — avoids any possibility of literal code points in source while achieving identical runtime behavior
- **Files modified:** `server/lib/seo-injector.ts`

## Known Stubs

None. This plan creates pure infrastructure (no UI, no API responses, no data sources). The injector functions are wired correctly to their inputs, and the cache invalidation is wired to the admin save path. Plans 16-02 and 16-03 will mount the injector into dev/prod pipelines and retemplate index.html — those plans define the full completion surface for the SEO injection feature.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| shared/seo.ts | FOUND |
| server/lib/seo-injector.ts | FOUND |
| tests/seo/inject.test.mjs | FOUND |
| tests/seo/curl-checks.sh | FOUND |
| tests/seo/check-jsonld.mjs | FOUND |
| 16-01-SUMMARY.md | FOUND |
| Commit 7eb6814 (shared/seo.ts) | FOUND |
| Commit cd48d52 (seo-injector.ts) | FOUND |
| Commit a0b8358 (Wave 0 tests + bug fix) | FOUND |
| Commit fcd8753 (cache invalidation wiring) | FOUND |
| `npm run check` exits 0 | PASSED |
| `npx tsx tests/seo/inject.test.mjs` — all 7 cases | PASSED |
