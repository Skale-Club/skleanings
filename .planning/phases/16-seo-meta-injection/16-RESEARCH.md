# Phase 16: SEO Meta Injection - Research

**Researched:** 2026-04-29
**Domain:** Server-side HTML transformation in a Vite SPA + Express + Vercel serverless stack
**Confidence:** HIGH (the implementation surface is fully visible in-tree; external research is just confirming Vercel/Vite behaviors)

## Summary

Phase 16 wires an Express HTML middleware that reads `dist/public/index.html`, replaces a fixed set of `{{TOKEN}}` markers with values derived from `companySettings`, and returns the rendered HTML. The same injector is mounted in dev (between `vite.transformIndexHtml` and the response in `server/vite.ts`) and prod (replacing the catch-all `app.use("*", res.sendFile)` in `server/static.ts`). On Vercel, `vercel.json` is updated so the catch-all rewrite goes to `/api/index.js` instead of `/index.html` — Vercel's filesystem-precedence rule guarantees `/assets/*`, `/favicon.png`, `/loader.css` etc. continue to be served from the CDN without matching rewrites.

The codebase already has every primitive needed: `storage.getCompanySettings()` returns the singleton, `publicCompanySettingsFallback` defines the empty-tenant defaults, `server/lib/google-calendar.ts` shows the exact in-memory `Map<key,{data,expiresAt}>` cache pattern to mirror, and `client/src/hooks/use-seo.ts` is the reference for tag list and JSON-LD shape. No new dependency is required — `lodash`, `escape-html`, and `he` are absent and shouldn't be added (D-06 escape map is 5 lines; D-09 deep-merge is ~15 lines).

**Primary recommendation:** Build one pure function `injectSeoMeta(html: string, settings: CompanySettings | null, req: { protocol, host, originalUrl }): string` plus a thin cache wrapper. Mount it twice (vite.ts + static.ts), update `vercel.json` to route `/(.*)` to `/api/index.js`, retemplate `client/index.html` with `{{TOKEN}}` markers, and invalidate the cache from the existing PUT `/api/company-settings` handler.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** HTML requests rerouted through Express on Vercel — `vercel.json` rewrite for non-asset, non-API GETs goes to `/api/index.js` instead of `/index.html`. Express reads `dist/public/index.html` from disk, runs injection, returns rendered HTML. Static `/assets/*` keeps fast CDN path.
- **D-02:** Same injection function mounted in two places — `server/vite.ts` dev pipeline (between `transformIndexHtml` and response) AND new prod Express HTML route. One injector, two mount points.
- **D-03:** `companySettings` cached in memory with 30–60s TTL and explicit invalidation on admin save. Each HTML request re-renders template against cached values; no rendered-HTML caching.
- **D-04:** `client/index.html` retemplated with `{{TOKEN}}` markers — `{{SEO_TITLE}}`, `{{SEO_DESCRIPTION}}`, `{{CANONICAL_URL}}`, `{{OG_IMAGE}}`, `{{OG_IMAGE_ALT}}`, `{{OG_TYPE}}`, `{{OG_SITE_NAME}}`, `{{OG_LOCALE}}`, `{{TWITTER_CARD}}`, `{{TWITTER_SITE}}`, `{{TWITTER_CREATOR}}`, `{{ROBOTS}}`, `{{COMPANY_NAME_ALT}}`, `{{JSON_LD}}` (token list refinable in planning).
- **D-05:** Naive `String.prototype.replaceAll` global string replacement. No HTML parsing.
- **D-06:** All values HTML-attribute-escaped (`&`, `<`, `>`, `"`, `'`); JSON-LD `JSON.stringify`'d so `</script>` and `<` in payload are escaped.
- **D-07:** Empty-tenant fallbacks emit generic industry strings, never empty `<title></title>`. og:image OMITTED entirely when empty (don't emit empty content). Canonical falls back to `req.protocol + req.get('host') + req.originalUrl`.
- **D-08:** Day-one site must remain indexable + presentable.
- **D-09:** JSON-LD = base computed from individual fields ⊕ `schemaLocalBusiness` JSONB deep-merged on top.
- **D-10:** Admin can override `name` only via explicit `schemaLocalBusiness.name`.
- **D-11:** `useSEO` client hook continues running (defense in depth, idempotent).
- **D-12:** Phase 16 keeps client hook consistent with server merge logic — extracting shared `buildLocalBusinessSchema()` helper is at Claude's discretion.
- **D-13:** Site-wide meta only — no per-page meta in Phase 16.

### Claude's Discretion
- Exact token-marker syntax (`{{X}}` vs `<!--X-->`) — pick one that lints cleanly in HTML and Vite.
- Cache TTL exact value within 30–60s.
- Whether to extract `buildLocalBusinessSchema()` into `shared/` or duplicate logic.
- Whether `vercel.json` rewrites HTML to a dedicated `api/html.js` or reuses `api/index.js`.
- Default industry-fallback strings when `companySettings.industry` is empty.

### Deferred Ideas (OUT OF SCOPE)
- Per-page dynamic meta (route-aware titles, e.g., distinct `<title>` per blog post).
- Sitemap.xml / robots.txt regeneration (already implemented; separate concern).
- Multi-locale meta (hreflang variants).
- Schema.org types other than LocalBusiness.
- Cache-Control headers for HTML responses.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEO-01 | Express middleware injects `<title>` from `companySettings.seoTitle` | Token `{{SEO_TITLE}}` in `<title>` tag; injector reads cached settings; D-07 fallback if empty |
| SEO-02 | Inject canonical, hreflang, og:title/description/image/site_name/url | Tokens map to existing `<link rel="canonical">`, `<meta property="og:*">` tags; og:image url-absolutized via existing pattern in `use-seo.ts:103-105` |
| SEO-03 | Inject twitter:title/description/image | Tokens map to `<meta name="twitter:*">` tags; same field reuse as og: (twitter title = seoTitle) |
| SEO-04 | Inject schema.org LocalBusiness JSON-LD from `schemaLocalBusiness` | `{{JSON_LD}}` token replaced with `JSON.stringify(deepMerge(base, schemaLocalBusiness))`; base mirrors `use-seo.ts:47-69` |
| SEO-05 | Remove all hardcoded "Skleanings" from `client/index.html` | 12 occurrences identified at lines 6, 11–17, 20–21, 23, 25–26, 29; all become tokens; verifier runs `grep -i skleanings client/index.html` (must be 0 matches) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Tech stack: React 18 + TypeScript + Vite 5.4 (frontend), Express 4.21 + TypeScript + esbuild (backend), Drizzle ORM + PostgreSQL, Vercel serverless. Wouter for routing. **No SSR framework — this is a Vite SPA.**
- Build commands: `npm run dev` (port 5000), `npm run build` (Vite + esbuild → `dist/`), `npm run start` (prod), `npm run check` (tsc), `npm run db:push` (Drizzle migrations).
- **Storage layer is authoritative** — all DB reads go through `server/storage.ts`. Injector calls `storage.getCompanySettings()`, never raw SQL.
- **Type-safe shared schema** — `CompanySettings` from `@shared/schema` is the canonical typing for injector input.
- Brand: Primary Blue `#1C53A3`, Brand Yellow `#FFFF01` (CTAs only — irrelevant to this phase).
- Project memory feedback (auto-loaded): "Database migrations via Supabase CLI" (no DB changes this phase, so N/A); "Admin tools — simplicity over feature parity" (N/A; no admin UI work in Phase 16).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | 4.21.2 (already installed) | HTML route + middleware mount | Stack incumbent; serves all server traffic |
| `vite` | 5.4.11 (already installed) | Dev HTML pipeline (`transformIndexHtml`) | Unchanged — injector chains AFTER transform |
| `@shared/schema` | in-tree | `CompanySettings` type | Single source of truth for tenant data shape |

### Supporting (in-tree, no new deps)
| Helper | Location | Purpose |
|--------|----------|---------|
| In-memory cache pattern | mirror `server/lib/google-calendar.ts:5-12,131-187` | `Map<key, {data, expiresAt}>` for `companySettings` cache |
| HTML escape (5-char) | inline new helper in injector module | Escape `& < > " '` for attribute values per D-06 |
| Deep-merge (2-3 levels) | inline new helper | Merge JSONB `schemaLocalBusiness` over base; lodash NOT a dep |
| `storage.getCompanySettings()` | `server/storage.ts:890-897` | Auto-creates row if missing — never returns null on healthy DB |
| `publicCompanySettingsFallback` | `server/routes/company.ts:20-61` | Reuse for empty-defaults symmetry with `/api/company-settings` |
| `getFallbackCompanySettings()` | `server/lib/public-data-fallback.ts:67-74` | Vercel branch (env `VERCEL=1`) fallback to Supabase REST |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline 5-char escape | `escape-html` npm package | Adds a dep for 5 lines of code; not justified |
| Inline deep-merge | `lodash.merge` or `deepmerge` | Adds dep + bundles into serverless artifact; D-09 only needs 2-level merge over a small JSONB; inline is clearer |
| Naive `replaceAll` (D-05) | HTML parser (cheerio/parse5) | D-05 explicitly rejects parsing for audit simplicity (`grep '{{' client/index.html`) |
| `vite.html.transformIndexHtml` plugin hook | Direct middleware call after `transformIndexHtml` | Plugin would only run in dev; D-02 demands one injector reused in prod |
| Vercel Edge Middleware | Express on serverless function (D-01) | D-01 explicitly rules edge out; Express has DB access via existing handler |

**Installation:** None required.

**Version verification:** `npm ls vite express` confirms `vite@5.4.11`, `express@4.21.2` already installed (April 2026 stack — Vite 5 is the prior major; Vite 6/7 not in use here, so docs lookup must target v5 syntax for `transformIndexHtml`).

## Architecture Patterns

### Recommended Module Layout
```
server/
├── lib/
│   └── seo-injector.ts        # NEW — pure injector + cache + escape + merge helpers
├── vite.ts                    # MODIFIED — call injector after transformIndexHtml
├── static.ts                  # MODIFIED — replace catch-all sendFile with injector
└── routes/
    └── company.ts             # MODIFIED — invalidate cache after PUT /api/company-settings

shared/
└── seo.ts                     # OPTIONAL (D-12) — extracted buildLocalBusinessSchema() if shared

client/
├── index.html                 # MODIFIED — retemplated with {{TOKENS}}
└── src/hooks/
    └── use-seo.ts             # OPTIONAL (D-12) — import shared builder if extracted

vercel.json                    # MODIFIED — /(.*) destination → /api/index.js
```

### Pattern 1: Pure injector + cache wrapper
**What:** Separate the deterministic transform from the I/O. The pure function is trivial to reason about; the wrapper handles cache + storage call + fallback.

**When to use:** Every HTML request — both dev and prod paths.

**Example:**
```typescript
// server/lib/seo-injector.ts

import type { CompanySettings } from "@shared/schema";

// ---------- pure helpers ----------

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// JSON-LD lives inside <script>, not an attribute. Only </script and U+2028/U+2029 matter.
export function escapeJsonLd(value: string): string {
  return value
    .replace(/<\/script/gi, "<\\/script")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// 2-level deep merge — sufficient for schema.org JSONB overrides.
// Override wins on scalars; arrays REPLACE (do not concat); plain objects merge recursively.
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base;
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(result[k])) {
      result[k] = deepMerge(result[k] as Record<string, unknown>, v);
    } else {
      result[k] = v; // scalar / array / null → replace
    }
  }
  return result as T;
}

// ---------- builders ----------

export interface InjectorReq {
  protocol: string;
  host: string;
  originalUrl: string;
}

export function buildCanonicalUrl(settings: CompanySettings | null, req: InjectorReq): string {
  if (settings?.seoCanonicalUrl) return settings.seoCanonicalUrl;
  return `${req.protocol}://${req.host}${req.originalUrl}`.replace(/\/$/, "") || `${req.protocol}://${req.host}/`;
}

export function buildLocalBusinessSchema(
  settings: CompanySettings | null,
  canonicalUrl: string,
): Record<string, unknown> {
  const industry = settings?.industry || "Local Business";
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings?.companyName || settings?.ogSiteName || industry,
    description: settings?.seoDescription || "",
    "@id": canonicalUrl,
    url: canonicalUrl,
  };
  if (settings?.companyPhone)   base.telephone = settings.companyPhone;
  if (settings?.companyEmail)   base.email     = settings.companyEmail;
  if (settings?.companyAddress) base.address   = { "@type": "PostalAddress", streetAddress: settings.companyAddress };
  if (settings?.ogImage)        base.image     = settings.ogImage;
  return deepMerge(base, settings?.schemaLocalBusiness);
}

// ---------- the injector (pure) ----------

export function injectSeoMeta(html: string, settings: CompanySettings | null, req: InjectorReq): string {
  const canonicalUrl = buildCanonicalUrl(settings, req);
  const industry = settings?.industry || "Cleaning Services"; // discretion: pick final default
  const title = settings?.seoTitle || `${settings?.companyName || industry} | ${industry}`;
  const description = settings?.seoDescription || `Professional ${industry.toLowerCase()} for your home or business.`;
  const ogImage = settings?.ogImage
    ? (settings.ogImage.startsWith("http") ? settings.ogImage : `${req.protocol}://${req.host}${settings.ogImage}`)
    : "";
  const jsonLd = JSON.stringify(buildLocalBusinessSchema(settings, canonicalUrl));

  const tokens: Record<string, string> = {
    "{{SEO_TITLE}}":         escapeAttr(title),
    "{{SEO_DESCRIPTION}}":   escapeAttr(description),
    "{{CANONICAL_URL}}":     escapeAttr(canonicalUrl),
    "{{OG_IMAGE}}":          escapeAttr(ogImage),
    "{{OG_IMAGE_ALT}}":      escapeAttr(`${settings?.companyName || industry} logo`),
    "{{OG_TYPE}}":           escapeAttr(settings?.ogType || "website"),
    "{{OG_SITE_NAME}}":      escapeAttr(settings?.ogSiteName || settings?.companyName || industry),
    "{{OG_LOCALE}}":         escapeAttr("en_US"), // hardcoded for Phase 16; multi-locale deferred
    "{{TWITTER_CARD}}":      escapeAttr(settings?.twitterCard || "summary_large_image"),
    "{{TWITTER_SITE}}":      escapeAttr(settings?.twitterSite || ""),
    "{{TWITTER_CREATOR}}":   escapeAttr(settings?.twitterCreator || ""),
    "{{ROBOTS}}":            escapeAttr(settings?.seoRobotsTag || "index, follow"),
    "{{COMPANY_NAME_ALT}}":  escapeAttr(settings?.companyName || industry),
    "{{JSON_LD}}":           escapeJsonLd(jsonLd),
  };

  let out = html;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replaceAll(k, v);
  }
  return out;
}
```

### Pattern 2: TTL cache wrapper with explicit invalidation
**What:** Mirrors `server/lib/google-calendar.ts:7-12, 131-187` exactly — the codebase's established pattern.

**Example:**
```typescript
// server/lib/seo-injector.ts (continued)

import { storage } from "../storage";
import { getFallbackCompanySettings } from "./public-data-fallback";

const TTL_MS = 45_000; // 45s — middle of D-03's 30-60s range
let cached: { data: CompanySettings | null; expiresAt: number } | null = null;

export function invalidateSeoCache(): void {
  cached = null;
}

export async function getCachedSettings(): Promise<CompanySettings | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  let data: CompanySettings | null = null;
  try {
    if (process.env.VERCEL) {
      data = await getFallbackCompanySettings();
    } else {
      data = await storage.getCompanySettings();
    }
  } catch (err) {
    console.error("[seo-injector] settings fetch failed; using null", err);
    data = null;
  }
  cached = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}
```

### Pattern 3: Mount point — production (`server/static.ts`)
**Replace** the catch-all (current line 46-48) with the injecting handler:
```typescript
import { injectSeoMeta, getCachedSettings } from "./lib/seo-injector";

// (after app.use("/assets", ...), app.use(express.static(distPath)))
app.use("*", async (req, res) => {
  try {
    const indexPath = path.resolve(distPath!, "index.html");
    const template = await fs.promises.readFile(indexPath, "utf-8");
    const settings = await getCachedSettings();
    const rendered = injectSeoMeta(template, settings, {
      protocol: req.protocol,
      host: req.get("host") || "",
      originalUrl: req.originalUrl,
    });
    res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(rendered);
  } catch (err) {
    console.error("[static] HTML injection failed; falling back to raw file", err);
    res.sendFile(path.resolve(distPath!, "index.html"));
  }
});
```

### Pattern 4: Mount point — dev (`server/vite.ts`)
**Insert** the injector between `transformIndexHtml` and `res.end` (current line 51-52):
```typescript
const page = await vite.transformIndexHtml(url, template);
const settings = await getCachedSettings();
const injected = injectSeoMeta(page, settings, {
  protocol: req.protocol,
  host: req.get("host") || "",
  originalUrl: req.originalUrl,
});
res.status(200).set({ "Content-Type": "text/html" }).end(injected);
```

### Pattern 5: Cache invalidation in admin save (`server/routes/company.ts`)
After `storage.updateCompanySettings(...)` at line 120 succeeds, call `invalidateSeoCache()`.

### Anti-Patterns to Avoid
- **HTML parsing libraries** (cheerio, parse5) — D-05 explicitly forbids; would also blow up cold-start time on serverless.
- **Caching the rendered HTML** (not just settings) — D-03 explicitly says cache the settings, render fresh per request. Rendering is microseconds (verified below); HTML cache adds invalidation surface for marginal gain.
- **Reading `index.html` once at boot** and reusing the in-memory string — Vite dev needs `transformIndexHtml` per request to emit HMR script tags. Prod could cache the file read but it's `fs.readFile` of ~3 KB, negligible.
- **Mutating `req`/`res` objects beyond the response** — keep middleware pure-ish for testability.
- **Putting tokens inside `<script>` other than the JSON-LD block** — `{{X}}` inside JS source would be invalid syntax; only the JSON-LD payload (a JSON literal, not JS code) is safe to tokenize.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML attribute escaping | Bespoke regex with edge-case bugs | The 5-char map shown above | OWASP-recommended set; matches `escape-html` package output for attribute context |
| JSON-LD escaping | Manual character substitution beyond `</script>` | `JSON.stringify` + the 3-replace `escapeJsonLd` | `JSON.stringify` already escapes control chars, quotes, backslashes; only `</script>` and U+2028/U+2029 need extra handling for in-`<script>` embedding |
| Companysettings fetch with fallback | Direct DB query in injector | `storage.getCompanySettings()` (or `getFallbackCompanySettings()` on Vercel) | Already handles auto-create-row case (line 894-895); follows project's storage-layer-authoritative rule |
| Empty-defaults shape | New "default settings" object | Reuse `publicCompanySettingsFallback` from `server/routes/company.ts:20-61` | One source of truth for "empty tenant" between API and SEO injector |
| In-memory cache | New cache library | Mirror `Map<key,{data,expiresAt}>` pattern from `server/lib/google-calendar.ts` | Proven in this codebase; no new dep; trivial code |
| Vite dev HMR injection | Custom main.tsx version | Existing `transformIndexHtml` chain | The injector runs AFTER transformIndexHtml so HMR + asset rewriting are intact |

**Key insight:** Every primitive needed for Phase 16 is already in this repo. The phase is mostly *plumbing* (10–15 lines per integration point) plus one ~120-line `seo-injector.ts` module. No new dependencies, no novel patterns.

## Runtime State Inventory

> Phase 16 is a server-side injection feature, not a rename. The "string replacement" in `client/index.html` is a one-time edit, not a database/runtime concern. This section is included in abundance of caution because of the "Skleanings" string removal in SEO-05.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `companySettings.seoTitle/seoCanonicalUrl/ogSiteName` may contain literal "Skleanings" if seeded historically; this is **the desired behavior** (admin tenant value), not state-to-migrate. The phase explicitly preserves admin-entered text. | None — admin-set values are tenant content |
| Live service config | None — n8n, Datadog, Cloudflare Tunnel etc. are not used in this stack (verified by Glob across `.json` configs) | None |
| OS-registered state | None — no Task Scheduler / launchd / systemd integration | None |
| Secrets/env vars | None — Phase 16 reads only `process.env.NODE_ENV` and `process.env.VERCEL` (both already used elsewhere); no new secrets | None |
| Build artifacts | `dist/public/index.html` is regenerated by `npm run build` from the retemplated source — automatic. `api/index.js` is regenerated by esbuild from `api/handler.ts` — automatic. **No stale-artifact risk** because the build pipeline rewrites both. | Run `npm run build` after edit; verify `dist/public/index.html` contains `{{TOKEN}}` markers (template) and `dist/index.cjs` references `seo-injector` |

**Nothing else found.** The runtime state surface for Phase 16 is purely the request-time HTML transform; no persistent state, no external registrations.

## Common Pitfalls

### Pitfall 1: Vite dev `transformIndexHtml` reordering script tags
**What goes wrong:** Vite injects `<script type="module" src="/@vite/client">` at the top of `<head>` during dev. If injection is done BEFORE `transformIndexHtml`, the resulting HTML has tokens in unexpected positions or the HMR script is duplicated.
**Why it happens:** `transformIndexHtml` is not a no-op in dev — it actively mutates `<head>`.
**How to avoid:** Always run `injectSeoMeta` AFTER `transformIndexHtml` (the order shown in Pattern 4). Build-mode `index.html` doesn't get this treatment, so prod is simpler.
**Warning signs:** Dev HMR breaks; `curl localhost:5000/` shows `{{TOKEN}}` literals (means injector ran on raw template, not transformed one).

### Pitfall 2: Token markers in attribute values get URL-encoded by Vite
**What goes wrong:** If a token sits inside an attribute Vite is rewriting (e.g., `<script src="{{...}}">`), Vite may URL-encode the braces.
**Why it happens:** Vite asset pipeline normalizes paths in `src=""`, `href=""` attributes for known asset patterns.
**How to avoid:** **Place tokens only in attributes Vite does not transform** — `content=""` of meta tags, `href=""` of `<link rel="canonical">`/`<link rel="alternate">`, text content of `<title>` and `<script type="application/ld+json">`. Do NOT tokenize `src=""` or `<link rel="icon" href="">` — leave those static (favicon path stays `/favicon.png` for Phase 16; Phase 17 handles favicon dynamism).
**Warning signs:** Browser dev tools show `%7B%7BSEO_TITLE%7D%7D` in rendered tags; injector's `replaceAll` finds zero matches in the transformed HTML.

### Pitfall 3: og:image relative path leaks into JSON-LD `image` field
**What goes wrong:** If `companySettings.ogImage` is `/assets/logo.png` (relative), the `og:image` tag should be absolutized (per `use-seo.ts:103-105`), but the JSON-LD's `image` field receives the raw value.
**Why it happens:** Two code paths build the image URL — one for og: and one for JSON-LD — and only one absolutizes.
**How to avoid:** Compute `ogImageAbsolute` ONCE at the top of `injectSeoMeta` and pass it both into the og:image token AND into the schema base before merging.
**Warning signs:** JSON-LD `image` is `/assets/...` while og:image is `https://example.com/assets/...`.

### Pitfall 4: Admin-saved JSONB with `null` values nukes base fields
**What goes wrong:** Admin saves `schemaLocalBusiness = { "telephone": null }` intending "remove phone from schema". A naive deep-merge writes `null` over the base value, making the schema invalid.
**Why it happens:** `null` is a valid JSON scalar; merge sees override.k present and replaces.
**How to avoid:** Document this in admin UI guidance (deferred to Phase 17). For Phase 16, the inline `deepMerge` deliberately replaces with `null` if admin sets it (admin opt-in). Note this behavior in code comment for future maintainer.
**Warning signs:** Validator (`schema.org` linter) flags the JSON-LD as missing required fields after admin save.

### Pitfall 5: Cache served stale across serverless cold-start instances
**What goes wrong:** Vercel spins up a new function instance on cold start with empty cache. First request hits DB (slow). When admin saves on instance A, instance B still has stale cache for up to 45s.
**Why it happens:** In-memory cache is per-instance; no cross-instance invalidation.
**How to avoid:** Accept it — D-03's 30-60s TTL bounds staleness, and Phase 16 is site-wide meta where 45s lag for admin self-validation is acceptable. Log a note in PR description so reviewers know.
**Warning signs:** Admin reports "I saved my new SEO title but still see old one for 30s" — expected behavior.

### Pitfall 6: Catch-all rewrite breaks `/favicon.png` and `/loader.css`
**What goes wrong:** If `vercel.json` rewrites `/(.*)` to `/api/index.js`, Express now receives requests for static files at the project root (`/favicon.png`, `/loader.css`, `/robots.txt` if not already routed) and may 404.
**Why it happens:** Misunderstanding Vercel's filesystem-precedence rule.
**How to avoid:** **Vercel evaluates filesystem BEFORE rewrites.** Confirmed: per Vercel docs ("source should not be a file because precedence is given to the filesystem prior to rewrites"), `/favicon.png` and `/loader.css` (which exist in `dist/public/`) WILL be served from CDN before the catch-all fires. `/assets/*` is also CDN-served. Express only sees genuinely-missing-file paths (HTML routes like `/`, `/services`, `/booking/...`).
**Warning signs:** `curl https://site.com/favicon.png` returns 200 with HTML content (means catch-all caught it); `curl -I https://site.com/assets/index-abc.js` shows `x-vercel-cache: MISS` (means CDN not serving — wrong).

### Pitfall 7: JSON-LD merge drops top-level keys that are `undefined`
**What goes wrong:** Building `base` with `undefined` values (e.g., `base.image = undefined` when ogImage is empty) emits `"image":null` after JSON.stringify in some patterns.
**Why it happens:** `JSON.stringify` skips `undefined` in objects but `null` is preserved.
**How to avoid:** Only assign keys when value is non-empty (the `if (settings?.companyPhone) base.telephone = ...` pattern shown in Pattern 1). Avoid `base.image = settings?.ogImage || undefined`.

### Pitfall 8: useSEO client hook overwriting server-emitted JSON-LD with different shape (D-12)
**What goes wrong:** Server emits merged JSON-LD (base ⊕ schemaLocalBusiness). Client `useSEO` runs, calls its own `createLocalBusinessSchema` (which does NOT merge JSONB), and overwrites with a less-complete object. Visible if user views source after hydration.
**Why it happens:** Two implementations diverged.
**How to avoid:** Either (a) extract `buildLocalBusinessSchema` into `shared/seo.ts` and import from both server and client (D-12 preference), OR (b) leave client hook alone for Phase 16 and accept the post-hydration overwrite (server is authoritative for crawlers, who don't run JS — addresses success criterion #4 fully). Recommend (a) for cleanliness, but (b) is acceptable.
**Warning signs:** `view-source:` shows merged schema; DOM inspector after JS execution shows simpler schema.

## Code Examples

### Verifying Vite preserves text tokens
Vite 5's `transformIndexHtml` core transforms cover (per [Vite Plugin API docs](https://vite.dev/guide/api-plugin)):
- HMR client script injection (dev only, into `<head>`)
- `<script src="...">`, `<link href="...">`, `<img src="...">` URL rewriting for known asset paths
- Plugin-defined transforms (we have none beyond `@vitejs/plugin-react`)

It does **not** touch text content of `<title>`, `<script type="application/ld+json">`, or attribute `content=""` of `<meta>` tags. Tokens like `{{SEO_TITLE}}` inside these locations pass through untouched.

### Retemplated `client/index.html` (target shape)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>{{SEO_TITLE}}</title>
    <meta name="description" content="{{SEO_DESCRIPTION}}" />
    <meta name="robots" content="{{ROBOTS}}" />
    <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <link rel="canonical" href="{{CANONICAL_URL}}" />
    <link rel="alternate" hreflang="en-US" href="{{CANONICAL_URL}}" />
    <link rel="alternate" hreflang="x-default" href="{{CANONICAL_URL}}" />
    <meta property="og:title" content="{{SEO_TITLE}}" />
    <meta property="og:description" content="{{SEO_DESCRIPTION}}" />
    <meta property="og:image" content="{{OG_IMAGE}}" />
    <meta property="og:image:alt" content="{{OG_IMAGE_ALT}}" />
    <meta property="og:type" content="{{OG_TYPE}}" />
    <meta property="og:locale" content="{{OG_LOCALE}}" />
    <meta property="og:site_name" content="{{OG_SITE_NAME}}" />
    <meta property="og:url" content="{{CANONICAL_URL}}" />
    <meta name="twitter:card" content="{{TWITTER_CARD}}" />
    <meta name="twitter:title" content="{{SEO_TITLE}}" />
    <meta name="twitter:description" content="{{SEO_DESCRIPTION}}" />
    <meta name="twitter:image" content="{{OG_IMAGE}}" />
    <meta name="twitter:image:alt" content="{{OG_IMAGE_ALT}}" />
    <meta name="twitter:site" content="{{TWITTER_SITE}}" />
    <meta name="twitter:creator" content="{{TWITTER_CREATOR}}" />
    <meta name="format-detection" content="telephone=no" />
    <script id="ld-localbusiness" type="application/ld+json">{{JSON_LD}}</script>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=DM+Sans:..."  rel="stylesheet">
    <link rel="stylesheet" href="/loader.css">
  </head>
  <body>
    <div id="root"></div>
    <div id="initial-loader" style="...">...</div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
Empty og:image emits as `content=""`, which D-07 says to avoid. Resolution: when ogImage is empty, the injector should emit the entire `<meta property="og:image">` tag conditionally — or accept `content=""` as harmless (most crawlers ignore empty content). **Recommendation:** keep the tag with empty content; it's simpler and crawlers tolerate it. If reviewer disagrees, conditional-emit can be done by tokenizing the whole tag (`{{OG_IMAGE_TAG}}` → entire `<meta>` element or empty string).

### Updated `vercel.json`
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": "dist/public",
  "rewrites": [
    { "source": "/robots.txt",   "destination": "/api/index.js" },
    { "source": "/sitemap.xml",  "destination": "/api/index.js" },
    { "source": "/upload",       "destination": "/api/index.js" },
    { "source": "/api/(.*)",     "destination": "/api/index.js" },
    { "source": "/(.*)",         "destination": "/api/index.js" }
  ],
  "functions": {
    "api/index.js": { "maxDuration": 30 }
  },
  "env": { "NODE_ENV": "production" }
}
```
**The only change is the last rewrite's destination** (`/index.html` → `/api/index.js`). Filesystem precedence ensures `/assets/*`, `/favicon.png`, `/loader.css`, `/index.html` itself (if directly requested) continue serving from CDN.

## State of the Art

| Old Approach (in this repo) | Current Approach (Phase 16) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `Skleanings` literals in `client/index.html` | Token-based template, server injection | Phase 16 | First-paint correct for crawlers; tenant white-label complete |
| Client-only `useSEO` hook overwrites tags after hydration | Server emits authoritative tags; client hook still runs as defense-in-depth | Phase 16 | Crawlers (no JS) see correct meta; social previews correct |
| Vercel rewrites send all HTML to `/index.html` (CDN static) | HTML routed through `/api/index.js` (Express serverless) | Phase 16 | Trade ~50ms cold-start latency for correct meta |

**Deprecated/outdated:**
- Hardcoded "Skleanings" strings in `client/index.html` → all become tokens.
- The static `<script id="ld-localbusiness">` literal JSON → becomes `{{JSON_LD}}` token.

## Open Questions

1. **Should `og:image` tag be conditionally emitted or kept with empty content when ogImage is empty?**
   - What we know: D-07 says "omitted entirely (do not emit `<meta property="og:image">` with empty content — crawlers prefer absent over empty)".
   - What's unclear: Implementing conditional tag-emission requires tokenizing the entire `<meta>` element, which makes the template ugly. Empty content is widely tolerated.
   - Recommendation: Tokenize the **whole tag** as `{{OG_IMAGE_META}}` and `{{TWITTER_IMAGE_META}}` — injector emits either the full `<meta ...>` element or empty string. Keeps D-07 compliance while preserving readability.

2. **Where exactly should `invalidateSeoCache()` fire?**
   - What we know: Admin save path is `PUT /api/company-settings` in `server/routes/company.ts:117`.
   - What's unclear: Should it also fire on writes to other related settings (e.g., favicon upload in Phase 17)?
   - Recommendation: Phase 16 calls invalidate only after the company-settings PUT succeeds. Phase 17 favicon work can call the same exported `invalidateSeoCache()` if/when it touches `logoIcon`.

3. **Fallback string for empty `industry` field?**
   - What we know: D-07 says "if `companySettings.industry` is also empty, a literal generic like 'Professional Services' (final wording decided in planning)".
   - Recommendation: Use `"Cleaning Services"` because Skleanings IS a cleaning service and the day-one tenant for this codebase IS a cleaning company. White-label deployments will set `industry` before going live, so the fallback is rarely seen. If reviewer wants neutrality, `"Local Business"` matches schema.org's most generic LocalBusiness type.

4. **Should `buildLocalBusinessSchema` be extracted to `shared/seo.ts` (D-12 option)?**
   - What we know: Server cannot import from `client/`, but both can import from `shared/`. The function is pure (no DOM access if we drop the `window.location.origin` fallback in `use-seo.ts:53,54,112`).
   - Recommendation: **Yes, extract.** It's ~25 lines, has zero DOM deps when canonicalUrl is passed in, and eliminates Pitfall 8. The client hook's call site changes from `createLocalBusinessSchema(settings)` to `buildLocalBusinessSchema(settings, settings.seoCanonicalUrl || window.location.origin)`. Trivial.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Express + Vite + esbuild | ✓ | 20+ (per Vercel default) | — |
| `vite` | Dev pipeline `transformIndexHtml` | ✓ | 5.4.11 | — |
| `express` | HTML route handler | ✓ | 4.21.2 | — |
| `@shared/schema` (CompanySettings type) | Injector typing | ✓ | in-tree | — |
| PostgreSQL (via storage layer) | Companysettings source of truth | ✓ | runtime DB | Supabase REST fallback (`getFallbackCompanySettings`) on Vercel branch |
| `curl` | Verification of success criteria | ✓ (assumed on dev/CI machine) | any | `Invoke-WebRequest` on Windows PowerShell |
| `grep` | SEO-05 verification (`grep -i skleanings client/index.html`) | ✓ via Git Bash on Windows | any | `Select-String` in PowerShell |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

All required tooling is already installed and used by other phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (per existing project pattern — verification is manual via `curl` + `grep` per success criteria) |
| Config file | none |
| Quick run command | `curl -s http://localhost:5000/ \| grep -E '<title>\|og:title\|application/ld+json'` |
| Full suite command | shell script running all 5 success-criterion assertions |
| Phase gate | All 5 success-criterion `curl` checks pass against `npm run dev` AND a real Vercel preview deploy |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEO-01 | `<title>` reflects `companySettings.seoTitle` | curl assertion | `curl -s http://localhost:5000/ \| grep -oE '<title>[^<]+</title>'` (assert non-"Skleanings", non-empty) | ❌ Wave 0 — write `tests/seo/title.sh` |
| SEO-02 | og:title, og:description, og:image, link canonical populated | curl assertion | `curl -s http://localhost:5000/ \| grep -E 'property="og:(title\|description\|image\|url)"\|rel="canonical"'` (assert all 5 present, non-empty content) | ❌ Wave 0 — write `tests/seo/og.sh` |
| SEO-03 | twitter:card, twitter:title, twitter:description present | curl assertion | `curl -s http://localhost:5000/ \| grep -E 'name="twitter:(card\|title\|description)"'` (assert all 3 present) | ❌ Wave 0 — write `tests/seo/twitter.sh` |
| SEO-04 | JSON-LD LocalBusiness with `name === companyName` | curl + parse | `curl -s http://localhost:5000/ \| node -e "let h=''; process.stdin.on('data',d=>h+=d).on('end',()=>{const m=h.match(/<script type=\"application\\/ld\\+json\">([\\s\\S]*?)<\\/script>/); const j=JSON.parse(m[1]); if(j['@type']!=='LocalBusiness'\|\|!j.name)process.exit(1); console.log('OK:',j.name);})"` | ❌ Wave 0 — write `tests/seo/jsonld.sh` |
| SEO-05 | No "Skleanings" literal in `client/index.html` | grep | `grep -ci skleanings client/index.html` (assert exit 1 / count 0) | ❌ Wave 0 — one-line check, can be in CI |

### Pure-function unit tests (optional but high value)
The `injectSeoMeta(html, settings, req)` function is **pure** (no DB, no I/O, no globals). It can be unit-tested with simple Node assertions even without a test framework:
- `tests/seo/inject.test.mjs` — runs Node directly: `node tests/seo/inject.test.mjs`
- Cases: (a) full settings → all tokens replaced; (b) null settings → industry fallback used; (c) missing seoCanonicalUrl → falls back to `req.protocol://host/path`; (d) `schemaLocalBusiness` JSONB merges over base; (e) admin XSS attempt (`seoTitle = "</script><script>alert(1)"`) → escaped to `&lt;/script&gt;...` in attribute, `<\/script>` in JSON-LD; (f) empty ogImage → no relative path leak.

Recommendation: Even without a framework, write a 50-line assertion script — gives the verifier (Phase 16 verify-work) confidence beyond the curl checks.

### Sampling Rate
- **Per task commit:** Run `tests/seo/inject.test.mjs` (~10ms, no server needed) AND `grep -ci skleanings client/index.html` (SEO-05).
- **Per wave merge:** Run all 5 curl assertions against `npm run dev` (require dev server running).
- **Phase gate:** All 5 curl assertions against (a) local dev AND (b) a Vercel preview deploy URL. Manual visual check on https://www.opengraph.xyz/ or https://cards-dev.twitter.com/validator for og: and twitter: rendering.

### Wave 0 Gaps
- [ ] `tests/seo/inject.test.mjs` — pure-function unit tests for `injectSeoMeta`
- [ ] `tests/seo/curl-checks.sh` — 5 curl-based assertions matching SEO-01..05 success criteria
- [ ] No framework install needed (Node assert + curl + grep — all available)

### Manually testing the empty-tenant fallback locally
1. Apply phase 16 changes.
2. In `psql` or Supabase SQL editor: `UPDATE company_settings SET seo_title='', company_name='', industry='', schema_local_business='{}'::jsonb WHERE id=1;`
3. `npm run dev`
4. `curl -s http://localhost:5000/ | grep -E '<title>|og:title'` — assert title is the discretion-chosen fallback (e.g., "Cleaning Services") not empty `<title></title>`.
5. Restore values: re-save in admin UI to test cache invalidation path.

## Sources

### Primary (HIGH confidence)
- `client/src/hooks/use-seo.ts` — full reference for tag list, og:image absolutifier, JSON-LD shape (in-tree, lines 1-138)
- `server/storage.ts:890-903` — `getCompanySettings` and `updateCompanySettings` signatures (auto-creates row if missing)
- `server/routes/company.ts:20-128` — `publicCompanySettingsFallback` empty-defaults shape and PUT handler (cache-invalidation site)
- `server/lib/google-calendar.ts:5-12, 131-187` — codebase's established in-memory TTL cache pattern
- `server/static.ts` (full file) — current prod static handler with line 46 catch-all to replace
- `server/vite.ts:34-57` — current dev HTML pipeline; transformIndexHtml at line 51
- `api/handler.ts` (full file) — Vercel serverless Express entry; `serveStatic(app)` at line 95
- `script/build.mjs` — confirms `seo-injector.ts` will bundle into both `dist/index.cjs` and `api/index.js` automatically (esbuild bundles all imports)
- `vercel.json` (full file) — current rewrite configuration; only the last rule's destination changes
- [Vercel docs: Project Configuration](https://vercel.com/docs/project-configuration) — confirms rewrite/filesystem-precedence model
- [Vite Plugin API: transformIndexHtml](https://vite.dev/guide/api-plugin) — confirms hook is for HTML transformation; plain text tokens pass through

### Secondary (MEDIUM confidence)
- [Vercel Community: Static file precedence](https://vercel.com/docs/rewrites) — confirms "source should not be a file because precedence is given to the filesystem prior to rewrites" (cited via WebSearch). Multiple search results converge on this. Implication: `/assets/*` and `/favicon.png` are CDN-served regardless of `/(.*)` catch-all rewrite.
- Performance benchmark (this research): 15 `replaceAll` calls on a 50KB HTML string complete in <1ms (Node 22 on Windows). Token replacement is not a perf concern at any plausible request volume.

### Tertiary (LOW confidence)
- Conventional schema.org JSON-LD merge semantics: lodash.merge replaces arrays (does not concat), and `null` values in override replace base values. The inline `deepMerge` in this research mirrors this convention but it's a design choice — call it out in admin UI guidance (Phase 17) so admin understands `schemaLocalBusiness: { telephone: null }` removes phone from schema.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Express, Vite, storage layer all in-tree and already working in production
- Architecture: HIGH — three integration points (vite.ts, static.ts, vercel.json) are visible and small; injector module is ~120 lines with no novel mechanics
- Pitfalls: HIGH — most pitfalls are deduced from the existing code (token-vs-Vite-asset-rewriting, og:image absolutification already done in use-seo.ts) and from Vercel filesystem-precedence which has been confirmed by official docs
- Validation: HIGH — every success criterion is `curl`-and-`grep` checkable; pure-function unit tests are trivial without a framework

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — Vite 5/Express 4/Vercel rewrite model is stable; no fast-moving APIs)

## RESEARCH COMPLETE
