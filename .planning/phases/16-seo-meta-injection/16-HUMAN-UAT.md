---
status: partial
phase: 16-seo-meta-injection
source: [16-VERIFICATION.md]
started: 2026-04-29T23:00:00.000Z
updated: 2026-04-29T23:00:00.000Z
---

## Current Test

[awaiting human testing — requires npm run dev + live database]

## Tests

### 1. SEO-01 — Title injection
expected: `curl http://localhost:5000/` returns HTML where `<title>` contains the value from `companySettings.seoTitle`, not a `{{TOKEN}}` placeholder and not "Skleanings"
result: [pending]

### 2. SEO-02 — Open Graph tags
expected: curl response includes `og:title`, `og:description`, `link rel="canonical"` all with non-empty content from companySettings; `og:image` is ABSENT when `companySettings.ogImage` is empty (D-07)
result: [pending]

### 3. SEO-03 — Twitter Card tags
expected: curl response includes `twitter:card`, `twitter:title`, `twitter:description` all present with DB values
result: [pending]

### 4. SEO-04 — JSON-LD LocalBusiness schema
expected: curl response `<script type="application/ld+json">` body parses to valid JSON with `@type === "LocalBusiness"` and `name === companySettings.companyName`
result: [pending]

### 5. Cache invalidation
expected: after saving a new `seoTitle` in admin Company Settings, the next `curl /` request reflects the new title within 45 seconds
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
