---
phase: 16
slug: seo-meta-injection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth: `16-RESEARCH.md` § Validation Architecture (lines 531–573).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — repo has no automated test runner (per `AGENTS.md` / codebase TESTING.md). Verification is Node-assert scripts + `curl` + `grep`. |
| **Config file** | none |
| **Quick run command** | `npx tsx tests/seo/inject.test.mjs && grep -ci skleanings client/index.html` |
| **Full suite command** | `bash tests/seo/curl-checks.sh` (requires `npm run dev` running on :5000) |
| **Estimated runtime** | Quick: <1s. Full: ~3s (5 curl requests + parse). |

> Note on the runner: tests/seo/inject.test.mjs and tests/seo/jsonld-parity.test.mjs are ESM `.mjs` files but import `.ts` source files (`server/lib/seo-injector.ts`, `shared/seo.ts`). Plain `node` cannot resolve `.ts` extensions — `npx tsx` must be used. `tsx` is already a devDependency for `npm run dev`. All Phase 16 plan `<verify>` blocks consistently use `npx tsx` for these test files.

---

## Sampling Rate

- **After every task commit:** Run quick command (`npx tsx tests/seo/inject.test.mjs && grep -ci skleanings client/index.html`).
- **After every plan wave:** Run full suite against `npm run dev`.
- **Before `/gsd:verify-work`:** Full suite green AND a Vercel preview deploy URL also passes the 5 curl assertions.
- **Max feedback latency:** ~1 second after task commit (pure-function tests are file-only, no server).

---

## Per-Task Verification Map

> Final task IDs are assigned in PLAN.md frontmatter; rows below are pre-allocated against the SEO-01..05 requirement set so the planner can drop task IDs into the table.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-XX | 01 | 1 | (Wave 0) | unit harness | `npx tsx tests/seo/inject.test.mjs` | ❌ W0 | ⬜ pending |
| 16-01-XX | 01 | 1 | (Wave 0) | shell harness | `bash tests/seo/curl-checks.sh` (existence + executable) | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | SEO-01 | curl + grep | `curl -s http://localhost:5000/ \| grep -oE '<title>[^<]+</title>'` (assert non-empty, no `Skleanings`) | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | SEO-02 | curl + grep | `curl -s http://localhost:5000/ \| grep -E 'property="og:(title\|description\|url)"\|rel="canonical"'` (assert all 4 present, content non-empty; og:image may be absent per D-07) | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | SEO-03 | curl + grep | `curl -s http://localhost:5000/ \| grep -E 'name="twitter:(card\|title\|description)"'` (assert all 3 present) | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | SEO-04 | curl + ESM parser | Fetch `/api/company-settings` to get expected companyName, then pipe rendered HTML through `node tests/seo/check-jsonld.mjs "<expected>"` and assert `OK:` prefix | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | SEO-05 | grep | `grep -ci skleanings client/index.html` (assert exit `1` / count `0`) | ✅ existing repo | ⬜ pending |
| 16-XX-XX | XX | XX | (cache) | curl + DB poke | After admin save: `curl /api/company-settings` returns updated value within 60s + HTML re-render reflects it. | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | (fallback) | DB reset + curl | Set companySettings to `{}` row → curl `/` → `<title>` is industry-fallback string, never empty `<title></title>`. | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | (XSS-attr) | unit (case 5a) | seoTitle = `</script><script>alert(1)` → assert escaped to `&lt;/script&gt;&lt;script&gt;alert(1)` in `<title>` and og/twitter:title `content`; literal payload absent. | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | (XSS-jsonld) | unit (case 5b) | companyName = `</script><script>alert(1)</script>` → assert no literal `</script>` in JSON-LD body, escaped `<\/script>` present, JSON.parse succeeds, parsed.name equals original. | ❌ W0 | ⬜ pending |
| 16-XX-XX | XX | XX | (D-07 absence) | unit (case 7) | settings.ogImage = "" → rendered HTML has NO `og:image` substring AT ALL and NO `twitter:image` substring AT ALL (block-token emits empty string). | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/seo/inject.test.mjs` — pure-function unit harness for `injectSeoMeta(html, settings, req)` covering: full settings, null settings (industry fallback), missing canonical (req-derived), JSONB deep-merge over base, **HTML attribute escape (5a)**, **JSON-LD escape (5b)**, og:image absolute-URL handling, **D-07 absent-on-empty (case 7)**.
- [ ] `tests/seo/curl-checks.sh` — POSIX shell script running the 5 curl-based assertions against `$BASE_URL` (default `http://localhost:5000`) for SEO-01..05. SEO-04 fetches expected `companyName` from `/api/company-settings` and delegates JSON-LD parsing to `tests/seo/check-jsonld.mjs`.
- [ ] `tests/seo/check-jsonld.mjs` — explicit ESM module file invoked as `node tests/seo/check-jsonld.mjs "<expected_name>"` over piped HTML. Avoids ESM/CJS ambiguity that `node -e` invocations risk in a `"type": "module"` project.
- [ ] `tests/seo/jsonld-parity.test.mjs` (Plan 16-03) — TWO real assertions: (A) server-rendered JSON-LD body == direct `buildLocalBusinessSchema(...)` call for three fixtures; (B) `client/src/hooks/use-seo.ts` source contains no inline `"@type": "LocalBusiness"` literal.
- [ ] No framework install needed — Node `assert` (built-in) + `curl` + `grep` + `tsx` (already devDep) only.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Crawler/social rendering of og: and twitter: tags | SEO-02, SEO-03 | Real social preview rendering happens on Twitter / Facebook / LinkedIn — local curl proves the tags exist; only the live previewer proves they render. | After Vercel preview deploys, paste preview URL into https://www.opengraph.xyz/ and https://cards-dev.twitter.com/validator. Confirm card thumbnail uses `companySettings.ogImage`. |
| Vercel filesystem precedence for `/assets/*` and `/favicon.png` | (D-01) | Filesystem precedence behavior is environment-specific to Vercel; only verifiable on a real Vercel deploy. | After Vercel preview deploys, run `curl -I https://<preview>.vercel.app/assets/<built-asset>.js` and confirm response is direct CDN (not Express). Then `curl -I https://<preview>.vercel.app/` and confirm response is dynamic (no immutable cache headers, served by Express). |
| Admin save → cache invalidation in production | (D-03) | Requires admin UI interaction (no automated path); cache TTL also makes it timing-dependent. | Edit `companySettings.seoTitle` in admin → save → curl `/` immediately → assert new value present in `<title>` (no stale value within ~1s of cache.invalidate()). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies declared in plan frontmatter
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/seo/inject.test.mjs`, `tests/seo/curl-checks.sh`, `tests/seo/check-jsonld.mjs`, `tests/seo/jsonld-parity.test.mjs`)
- [ ] All `.mjs` test runners use `npx tsx` (NOT plain `node`) — they import `.ts` source files
- [ ] No watch-mode flags (no test runner present)
- [ ] Feedback latency < 5s (quick: <1s, full: ~3s)
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 lands and per-task verification map is filled by planner

**Approval:** pending
