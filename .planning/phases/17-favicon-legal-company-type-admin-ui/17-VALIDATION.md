---
phase: 17
slug: favicon-legal-company-type-admin-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js assert (ESM test harness — custom, no jest/vitest) |
| **Config file** | none — run directly |
| **Quick run command** | `npx tsx tests/seo/inject.test.mjs` |
| **Full suite command** | `npx tsx tests/seo/inject.test.mjs && npx tsx tests/seo/jsonld-parity.test.mjs && npm run check` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsx tests/seo/inject.test.mjs`
- **After every plan wave:** Run `npx tsx tests/seo/inject.test.mjs && npx tsx tests/seo/jsonld-parity.test.mjs && npm run check`
- **Before `/gsd:verify-work`:** Full suite green + manual smoke of legal pages and favicon in browser tab
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| FAV-02 test | 01 | 0 | FAV-02 | unit | `npx tsx tests/seo/inject.test.mjs` | ❌ Wave 0 | ⬜ pending |
| FAV-03 test | 01 | 0 | FAV-03 | unit | `npx tsx tests/seo/inject.test.mjs` | ❌ Wave 0 | ⬜ pending |
| FAV-01 | 01 | 1 | FAV-01 | manual | navigate to admin > Company > Legal & Branding | N/A | ⬜ pending |
| WLTYPE-02 | 02 | 1 | WLTYPE-02 | manual | navigate to admin > Company > Legal & Branding | N/A | ⬜ pending |
| LEGAL-02 | 02 | 1 | LEGAL-02 | manual | navigate to admin > Company > Legal & Branding | N/A | ⬜ pending |
| LEGAL-03 | 03 | 2 | LEGAL-03 | smoke | `curl http://localhost:5000/privacy-policy` | N/A | ⬜ pending |
| LEGAL-04 | 03 | 2 | LEGAL-04 | manual | clear privacyPolicyContent, visit `/privacy-policy` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/seo/inject.test.mjs` — add `{{FAVICON_URL}}` token test cases:
  - Case: `faviconUrl` set → token expands to custom URL (FAV-02)
  - Case: `faviconUrl` empty → token expands to `/favicon.png` (FAV-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin upload saves faviconUrl to DB, favicon appears in browser tab | FAV-01 | Requires browser + Supabase upload flow | Navigate to Admin > Company Settings > Legal & Branding, upload a favicon, save, reload page — check browser tab |
| Service delivery model radio saves and persists on refresh | WLTYPE-02 | Requires DB write + page reload check | Select a model, save, refresh — verify selection is retained |
| Legal textarea saves content | LEGAL-02 | Requires DB write + page reload check | Paste content in textarea, save, reload — verify content persists |
| `/privacy-policy` renders DB content after admin edit | LEGAL-03 | Requires browser visual check | Edit privacy policy in admin, save, visit `/privacy-policy` — verify new content appears |
| Empty legal field shows placeholder (not blank/broken) | LEGAL-04 | Requires browser visual check | Clear privacyPolicyContent, save, visit `/privacy-policy` — verify placeholder card rendered |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
