---
phase: 16-seo-meta-injection
plan: "03"
subsystem: seo
tags: [seo, client-hook, shared-builder, parity-test, json-ld]
dependency_graph:
  requires:
    - shared/seo.ts (buildLocalBusinessSchema — Plan 16-01)
    - server/lib/seo-injector.ts (injectSeoMeta — Plan 16-01)
  provides:
    - client/src/hooks/use-seo.ts (refactored — delegates JSON-LD to shared builder)
    - tests/seo/jsonld-parity.test.mjs (parity test — 3 server fixtures + 1 regression guard)
  affects:
    - Client hydration JSON-LD shape now matches server-emitted JSON-LD (Pitfall 8 closed)
tech_stack:
  added: []
  patterns:
    - "Structural subset cast: SeoSettings as unknown as CompanySettings (safe — builder reads optional fields only)"
    - "@shared/seo alias import in client hook (tsconfig paths + vite alias both confirmed)"
key_files:
  created:
    - tests/seo/jsonld-parity.test.mjs
  modified:
    - client/src/hooks/use-seo.ts
decisions:
  - "@shared/seo alias used (not relative path fallback) — confirmed in tsconfig.json paths AND vite.config.ts aliases before editing"
  - "Type cast SeoSettings as unknown as CompanySettings — safe because buildLocalBusinessSchema reads optional fields only"
  - "industry and schemaLocalBusiness added to SeoSettings interface so the structural subset cast is sound for JSONB merge path"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-29T23:36:39Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 16 Plan 03: Client Hook Migration to Shared Builder Summary

Closed Pitfall 8 by replacing the inline `createLocalBusinessSchema` object literal in `client/src/hooks/use-seo.ts` with a thin wrapper calling `buildLocalBusinessSchema` from `@shared/seo` — the same shared util the server injector uses. Server and client now produce identical JSON-LD shape for the same `companySettings` input. A parity test with 3 server-render fixtures plus a client-source regression guard proves this by construction.

## What Was Built

### client/src/hooks/use-seo.ts (refactored)

**Import form used:** `@shared/seo` alias (confirmed available in both `tsconfig.json` paths and `vite.config.ts` aliases — no relative-path fallback needed).

**New imports added:**
```typescript
import { buildLocalBusinessSchema } from '@shared/seo';
import type { CompanySettings } from '@shared/schema';
```

**Two fields added to SeoSettings interface:**
- `industry?: string | null` — used by `buildLocalBusinessSchema`'s fallback chain so client and server agree on the fallback name
- `schemaLocalBusiness?: unknown` — JSONB override; matches shared `CompanySettings` shape for deep-merge semantics

**Final createLocalBusinessSchema wrapper (4 lines):**
```typescript
function createLocalBusinessSchema(settings: SeoSettings): string {
  const canonicalUrl = settings.seoCanonicalUrl || window.location.origin;
  const schema = buildLocalBusinessSchema(
    settings as unknown as CompanySettings,
    canonicalUrl,
  );
  return JSON.stringify(schema);
}
```

**Hardcoded literals removed:**
- `priceRange: "$$"` — gone; admins control this via `schemaLocalBusiness` JSONB
- `serviceType: "Cleaning Service"` — gone; same

**All other hook behaviors preserved unchanged:**
- `setMetaTag`, `setLinkTag`, `setJsonLdSchema` functions
- `useSEO` exported hook, `useQuery` with `queryKey: ['/api/company-settings']`
- Full `useEffect` body: `document.title`, og:*/twitter:* setMetaTag calls, favicon update, dep array `[settings]`

### tests/seo/jsonld-parity.test.mjs (created)

**Assertion A — Server-render parity (3 fixtures):**

| Fixture | Input | Key assertion |
|---------|-------|--------------|
| A1 — Full settings | companyName, email, phone, address, ogImage, JSONB={} | rendered JSON-LD === direct shared-builder call; name==="Acme Cleaning" |
| A2 — Null settings | null | rendered JSON-LD === direct shared-builder call; name==="Local Business" |
| A3 — JSONB admin override | schemaLocalBusiness.name="Override Co", priceRange="$$$", nested openingHours | rendered matches; name==="Override Co"; priceRange==="$$$"; nested merged |

**Assertion B — Client regression guard:**
- Reads `client/src/hooks/use-seo.ts` as text
- Asserts NO `"@type": "LocalBusiness"` or `"@type":"LocalBusiness"` substring (inline builder reintroduction guard)
- Asserts `buildLocalBusinessSchema` IS present (positive guard against silent revert)

## Test Output

```
PASS fixture-A1 — full settings; server output matches shared builder
PASS fixture-A2 — null settings; server output matches shared builder
PASS fixture-A3 — JSONB admin overrides; server output matches shared builder
PASS guard-B — client hook delegates to shared builder; no inline schema literal

All jsonld-parity.test.mjs assertions PASSED.
```

## Deviations from Plan

None — plan executed exactly as written. The `@shared/seo` alias was confirmed available before editing (tsconfig.json paths `"@shared/*": ["./shared/*"]` and `vite.config.ts` `resolve.alias["@shared"]`), so the relative-path fallback was not needed.

## Known Stubs

None. The refactored hook fully delegates to the shared builder with live JSONB merge semantics. No hardcoded values remain in the client hook's JSON-LD path.

## Phase 16 Sign-Off Readiness

All five SEO-01..05 success criteria are green:

| Criterion | Status | Evidence |
|-----------|--------|----------|
| SEO-01 — title/description/og:* in HTML response | Green | Plan 16-02 pipeline mount; curl-checks.sh passes |
| SEO-02 — og:image absent when empty | Green | D-07 OG_IMAGE_BLOCK token; inject.test.mjs case7 |
| SEO-03 — canonical URL from settings or req | Green | buildCanonicalUrl in injector; inject.test.mjs case3 |
| SEO-04 — JSON-LD LocalBusiness with name===companyName | Green | buildLocalBusinessSchema fallback chain; parity test A1/A2 |
| SEO-05 — no hardcoded "Skleanings" in index.html | Green | Plan 16-02 retemplating (confirmed in 16-02-PLAN.md scope) |

Client/server JSON-LD parity (Pitfall 8) closed by construction: both sides call the same `buildLocalBusinessSchema(settings, canonicalUrl)` on the same `companySettings` data. Ready for `/gsd:verify-work`.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| client/src/hooks/use-seo.ts | FOUND |
| tests/seo/jsonld-parity.test.mjs | FOUND |
| Commit 1b921eb (use-seo.ts refactor) | FOUND |
| Commit df558fb (parity test) | FOUND |
| `npm run check` exits 0 | PASSED |
| `npx tsx tests/seo/inject.test.mjs` — all 7 cases | PASSED |
| `npx tsx tests/seo/jsonld-parity.test.mjs` — all 4 assertions | PASSED |
| grep "@type.*LocalBusiness" client/src/hooks/use-seo.ts = 0 | PASSED |
