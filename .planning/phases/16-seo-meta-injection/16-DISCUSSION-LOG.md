# Phase 16: SEO Meta Injection — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 16-seo-meta-injection
**Areas discussed:** Per-route vs single global meta, token replacement strategy, settings caching strategy, JSON-LD source

---

## Per-route vs Single Global Meta

| Option | Description | Selected |
|--------|-------------|----------|
| Single global tenant meta | One set applied to ALL routes | ✓ |
| Per-route customization | Page-specific titles like "Services \| Company" | |

**User's choice:** "next" → recommended default
**Notes:** Per-route titles deferred to a future phase. Phase 16 success criterion #1 says "any page URL" — single global meta satisfies this. Adds simplicity now; per-route is a clean follow-up later.

---

## Token Replacement Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder tokens + string-replace | `{{companyName}}` in HTML, simple String.replaceAll | ✓ |
| Cheerio/jsdom DOM manipulation | Parse HTML, walk tree, set attributes | |
| Programmatic template builder | Construct response from scratch | |

**User's choice:** "next" → recommended default
**Notes:** Zero new dependencies. Microsecond performance for ~4KB template. Easy to audit visually.

---

## Settings Caching Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Read DB every request | Simple, ~5–20ms per HTML request | |
| 60s TTL in-memory cache | Simple invalidation, max 60s lag for admin edits | ✓ |
| Cache + invalidation on POST | Zero stale window, more code | |

**User's choice:** "next" → recommended default
**Notes:** SEO meta change is not time-critical for admins. 60s lag acceptable. No invalidation hooks needed.

---

## JSON-LD Source

| Option | Description | Selected |
|--------|-------------|----------|
| `schemaLocalBusiness` jsonb (admin-owned) | Admin controls full structured-data object | ✓ |
| Auto-construct from individual fields | Less admin flexibility, more guardrails | |

**User's choice:** "next" → recommended default
**Notes:** Auto-fill `name` from `companyName` when jsonb is empty (D-10) — guarantees SEO-04 compliance even when admin hasn't customized. When BOTH empty: omit script entirely (D-11).

---

## Claude's Discretion

- Module file path: `server/lib/seo-meta.ts` vs `server/middleware/seo.ts`
- Token naming convention (`{{seoTitle}}`, `{{COMPANY_NAME}}`, `<!--SEO_TITLE-->`)
- Cache implementation (object literal vs Map vs LRU)
- Whether to template og:image:alt and twitter:image:alt or leave static

## Deferred Ideas

- Per-route page titles ("Services | Company")
- Per-page og:image overrides
- Sitemap auto-generation
- Per-tenant robots.txt
- Cache invalidation on admin write
- Hreflang per-tenant
- Twitter @handle field
