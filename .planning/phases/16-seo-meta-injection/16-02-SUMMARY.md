---
phase: 16-seo-meta-injection
plan: "02"
subsystem: seo
tags: [seo, server-side-injection, pipeline-wiring, index-html-template, vercel]
dependency_graph:
  requires:
    - 16-01 (injectSeoMeta, getCachedSettings, InjectorReq from server/lib/seo-injector.ts)
  provides:
    - client/index.html (tokenized HTML template — brand-free, 12 attribute tokens + 2 D-07 block tokens)
    - server/vite.ts (dev pipeline mount: injectSeoMeta after transformIndexHtml)
    - server/static.ts (prod pipeline mount: injecting catch-all replacing raw sendFile)
    - vercel.json (HTML traffic routed through Express via /api/index.js catch-all)
  affects:
    - All HTML responses from dev and prod servers
    - Vercel deployment routing for SPA routes
    - api/handler.ts (calls serveStatic — inherits static.ts changes automatically)
    - plan 16-03 (client useSEO hook migration — picks up server-injected tags)
tech_stack:
  added: []
  patterns:
    - "Dev pipeline: vite.transformIndexHtml → getCachedSettings → injectSeoMeta → res.end (order critical)"
    - "Prod pipeline: fs.readFile(index.html) → getCachedSettings → injectSeoMeta → res.end (with sendFile fallback on error)"
    - "Vercel filesystem-before-rewrites: /assets/* served by CDN; /(.*) catch-all fires only for SPA routes"
key_files:
  created: []
  modified:
    - client/index.html
    - server/vite.ts
    - server/static.ts
    - vercel.json
    - tests/seo/curl-checks.sh
decisions:
  - "Injector call order in vite.ts: AFTER vite.transformIndexHtml (Pitfall 1 — HMR scripts already injected)"
  - "Static.ts catch-all: replaced entirely with injecting async handler; sendFile preserved ONLY in error-catch fallback"
  - "vercel.json: only /(.*) destination changed (/index.html -> /api/index.js); all other rules unchanged"
  - "SEO-01 curl check updated: detect unreplaced {{TOKEN}} markers instead of literal 'Skleanings' (bug fix — Skleanings is a valid DB company name)"
metrics:
  duration: "~6 minutes"
  completed: "2026-04-29"
  tasks_completed: 4
  files_modified: 5
---

# Phase 16 Plan 02: Pipeline Wiring (Dev + Prod SEO Injection) Summary

Wired the Plan 16-01 SEO injector into the live request pipeline. Every HTML response from `npm run dev` and from the Vercel-hosted Express handler is now the result of `injectSeoMeta(template, settings, req)`. No code path serves the raw `client/index.html` to a browser.

## What Was Built

### Task 1: client/index.html retemplated

Replaced all hardcoded brand strings with `{{TOKEN}}` markers per D-04 and D-07.

**Token inventory (per-attribute tokens — 12 used in template):**

| Token | Count in template | Locations |
|-------|------------------|-----------|
| `{{SEO_TITLE}}` | 3 | `<title>`, `og:title`, `twitter:title` |
| `{{SEO_DESCRIPTION}}` | 3 | `<meta name="description">`, `og:description`, `twitter:description` |
| `{{CANONICAL_URL}}` | 4 | `<link rel="canonical">`, `hreflang` x2, `og:url` |
| `{{ROBOTS}}` | 1 | `<meta name="robots">` |
| `{{OG_TYPE}}` | 1 | `<meta property="og:type">` |
| `{{OG_LOCALE}}` | 1 | `<meta property="og:locale">` (NEW — not in original template) |
| `{{OG_SITE_NAME}}` | 1 | `<meta property="og:site_name">` |
| `{{TWITTER_CARD}}` | 1 | `<meta name="twitter:card">` |
| `{{TWITTER_SITE}}` | 1 | `<meta name="twitter:site">` |
| `{{TWITTER_CREATOR}}` | 1 | `<meta name="twitter:creator">` |
| `{{JSON_LD}}` | 1 | `<script id="ld-localbusiness" type="application/ld+json">` body |
| `{{COMPANY_NAME_ALT}}` | 0 | Reserved for Phase 17 favicon; injector no-ops on zero matches |

**D-07 block tokens (2 — whole-element clusters):**

| Token | Expands to | When absent |
|-------|-----------|-------------|
| `{{OG_IMAGE_BLOCK}}` | `<meta property="og:image">` + `<meta property="og:image:alt">` | Empty string when `ogImage` is empty |
| `{{TWITTER_IMAGE_BLOCK}}` | `<meta name="twitter:image">` + `<meta name="twitter:image:alt">` | Empty string when `ogImage` is empty |

**Lines left static (not tokenized):**
- `<meta charset="UTF-8">`
- `<meta name="viewport" ...>`
- `<meta name="googlebot" ...>` (content hardcoded to max crawl settings)
- `<meta name="google-site-verification" content="">` (admin tooling deferred to Phase 17)
- `<link rel="icon" href="/favicon.png">` (Pitfall 2 — Vite rewrites icon href; Phase 17 owns favicon)
- Google Fonts `<link>` tags
- `<link rel="stylesheet" href="/loader.css">`
- `<script type="module" src="/src/main.tsx">`

SEO-05 satisfied: `grep -ci skleanings client/index.html` = 0.

### Task 2: server/vite.ts and server/static.ts — injector mount points

**server/vite.ts (dev pipeline):**

```typescript
import { injectSeoMeta, getCachedSettings } from "./lib/seo-injector";

// In the app.use("*", ...) handler, AFTER vite.transformIndexHtml:
const page = await vite.transformIndexHtml(url, template);
// Phase 16: server-side SEO meta injection (must run AFTER transformIndexHtml — Pitfall 1)
const settings = await getCachedSettings();
const injected = injectSeoMeta(page, settings, {
  protocol: req.protocol,
  host: req.get("host") || "",
  originalUrl: req.originalUrl,
});
res.status(200).set({ "Content-Type": "text/html" }).end(injected);
```

Order: transformIndexHtml (line 83) runs BEFORE injectSeoMeta (line 86). Verified via awk order check.

**server/static.ts (prod pipeline):**

```typescript
import { injectSeoMeta, getCachedSettings } from "./lib/seo-injector";

// Catch-all replaced from raw sendFile to injecting async handler:
app.use("*", async (req, res) => {
  try {
    const indexPath = path.resolve(distPath!, "index.html");
    const template = await fs.promises.readFile(indexPath, "utf-8");
    const settings = await getCachedSettings();
    const injected = injectSeoMeta(template, settings, {
      protocol: req.protocol,
      host: req.get("host") || "",
      originalUrl: req.originalUrl,
    });
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(injected);
  } catch (err) {
    console.error("[static] SEO injection failed; falling back to raw file", err);
    res.sendFile(path.resolve(distPath!, "index.html"));
  }
});
```

Graceful fallback: `res.sendFile` preserved only in the `catch` branch — availability maintained if injector fails. `fs` and `path` imports already present; no new imports added beyond the seo-injector.

### Task 3a: vercel.json catch-all updated (D-01)

Only the last rewrite rule's destination was changed:

```diff
- { "source": "/(.*)", "destination": "/index.html" }
+ { "source": "/(.*)", "destination": "/api/index.js" }
```

All 5 rules preserved in order: `/robots.txt`, `/sitemap.xml`, `/upload`, `/api/(.*)`, `/(.*)`.
Filesystem precedence: `/assets/*`, `/favicon.png`, `/loader.css` served by Vercel CDN — no explicit rules needed.

### Task 3b: End-to-end curl smoke test

Curl harness output against `npm run dev` (server at http://localhost:5000):

```
PASS: SEO-01: <title> populated (<title>Skleanings | Your 5-Star Cleaning Company</title>)
PASS: SEO-02: og:* + canonical present (4 tags)
PASS: SEO-03: twitter:* present (3 tags)
PASS: SEO-04: JSON-LD LocalBusiness name=companyName (OK:Skleanings; expected="")
PASS: SEO-05: client/index.html free of 'Skleanings'

Summary: 5 passed, 0 failed
```

**Tenant-data observations:**
- Dev DB has `seoTitle: "Skleanings | Your 5-Star Cleaning Company"` and `companyName: "Skleanings"` — injector correctly uses DB values (not fallbacks)
- `ogImage` is empty in dev DB — `{{OG_IMAGE_BLOCK}}` and `{{TWITTER_IMAGE_BLOCK}}` correctly absent from rendered HTML (D-07 compliant)
- Canonical URL from DB: `https://skleanings.com/` (configured `seoCanonicalUrl`)
- Twitter handle fields populated: `twitterSite: "@skleanings"`, `twitterCreator: "@skale.club"`
- SEO-04: `expected=""` because `/api/company-settings` endpoint returned empty companyName (API sanitization behavior, pre-existing); injector reads from `storage.getCompanySettings()` which returns the actual DB value. The `check-jsonld.mjs` helper accepts any non-empty name when `expected=""`.

**Pending production verification (deferred to phase verify-work):**
- Vercel preview deploy + opengraph.xyz / twitter card validator
- Browser rendering check for social sharing preview cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SEO-01 curl check falsely failed when DB company name is 'Skleanings'**
- **Found during:** Task 3b (curl harness run)
- **Issue:** The original SEO-01 check tested `grep -qi 'skleanings'` against the title — designed to detect when raw template was served (pre-retemplating, the title was `<title>Skleanings | Professional Cleaning Services</title>`). After retemplating, the injector correctly replaces `{{SEO_TITLE}}` with the DB value `"Skleanings | Your 5-Star Cleaning Company"`, but the check incorrectly flagged this as injection failure.
- **Fix:** Changed SEO-01 check to `grep -qF '{{'` — detects unreplaced token markers instead of checking brand name. If injection is active, `{{` never appears in the response; if injection is broken, `{{SEO_TITLE}}` appears literally.
- **Files modified:** `tests/seo/curl-checks.sh`
- **Commit:** `59e9d8b`
- **Impact:** Correctness fix for any tenant whose name matches the old brand literal; test now correctly validates injection semantics.

## Known Stubs

None. All token markers in `client/index.html` are replaced at request time by the injector. No empty placeholders or hardcoded fallback UI. The `{{COMPANY_NAME_ALT}}` token is in the injector's token map but has zero emit sites in `client/index.html` — the injector's `replaceAll` is a no-op for it, which is intentional (Phase 17 will add emit sites for favicon alt text).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `client/index.html` | FOUND |
| `server/vite.ts` | FOUND |
| `server/static.ts` | FOUND |
| `vercel.json` | FOUND |
| `tests/seo/curl-checks.sh` | FOUND |
| `16-02-SUMMARY.md` | FOUND |
| Commit eebc95e (client/index.html) | FOUND |
| Commit 91f529f (vite.ts + static.ts) | FOUND |
| Commit fccd3f0 (vercel.json) | FOUND |
| Commit 59e9d8b (curl-checks.sh fix) | FOUND |
| `grep -ci skleanings client/index.html` = 0 | PASSED |
| `npm run check` exits 0 | PASSED |
| `bash tests/seo/curl-checks.sh` — 5 passed, 0 failed | PASSED |
| `npx tsx tests/seo/inject.test.mjs` — 7/7 cases | PASSED |
