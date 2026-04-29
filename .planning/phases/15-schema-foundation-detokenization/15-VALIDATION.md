---
phase: 15
slug: schema-foundation-detokenization
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project has no automated test suite (per `.planning/codebase/STACK.md`: "Testing: Not configured (manual testing per AGENTS.md)") |
| **Config file** | none |
| **Quick run command** | `npm run check` (TypeScript-only) |
| **Full suite command** | `npm run check && npm run build` |
| **Estimated runtime** | ~30s for `check`, ~60s for `check && build` |

**Approach for Phase 15:** Grep-based assertions + manual smoke tests. No test framework introduction — this phase is structural (schema + detokenization) and the project's existing convention is manual verification per AGENTS.md.

---

## Sampling Rate

- **After every task commit:** Run `npm run check` (catches missing companyName parameter, broken type inference for new schema columns)
- **After every plan wave:** Run `npm run check && npm run build` (full TS + bundle build; verifies esbuild has no leftover references to removed strings)
- **Before `/gsd:verify-work`:** All 6 grep assertions + 6 manual smoke tests below pass
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | Manual Step |
|--------|----------|-----------|-------------------|-------------|
| **WLTYPE-01** | `companySettings` has `serviceDeliveryModel` field | Schema grep | `grep -n "service_delivery_model" supabase/migrations/20260428000000_add_white_label_columns.sql && grep -n "serviceDeliveryModel" shared/schema.ts` — both ≥1 match | `psql -c "\d company_settings"` confirms column post-migration |
| **LEGAL-01** | `companySettings` has `privacyPolicyContent` and `termsOfServiceContent` text fields | Schema grep | `grep -n "privacy_policy_content\|terms_of_service_content" supabase/migrations/20260428000000_add_white_label_columns.sql && grep -n "privacyPolicyContent\|termsOfServiceContent" shared/schema.ts` — both ≥1 match | `psql -c "\d company_settings"` confirms columns post-migration |
| **DETOK-01** | `document.title` set from `settings.companyName` (no ThemeContext modification per D-03) | Code-presence grep | `grep -n "document.title" client/src/App.tsx` returns ≥1 match referencing `settings.companyName` | Load site with `companyName="TestTenant"` in DB, observe browser tab title shows "TestTenant" |
| **DETOK-02** | localStorage visitor key derived from slug, not literal `"skleanings_visitor_id"` | Negative grep | `grep -rn "'skleanings_visitor_id'\|\"skleanings_visitor_id\"" client/src/` returns **zero** matches | Change `companyName` in DB, reload, verify localStorage key prefix changes |
| **DETOK-03** | All `"Skleanings"` literals in React components removed | Negative grep | `grep -rn '"Skleanings"\|'\''Skleanings'\''' client/src/ --include="*.tsx" --include="*.ts"` returns **zero** matches in display/logic positions | Load `/privacy-policy` and `/terms-of-service` with `companyName=""` in DB, confirm pages render without "Skleanings" |
| **SERV-01** | `server/lib/openrouter.ts` reads app title from parameter, not hardcoded literal | Negative grep + signature check | `grep -n '"Skleanings"' server/lib/openrouter.ts` returns **zero** matches; `grep -n "companyName" server/lib/openrouter.ts` returns ≥2 matches | Invoke `/api/integrations/openrouter/test` with seeded `companyName="TestTenant"`, intercept request, confirm `X-Title: TestTenant` header |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Per-task IDs will be filled in by the planner once plan task IDs are assigned.

---

## Wave 0 Requirements

- [x] **None** — project has no test framework. The grep + manual approach matches the established AGENTS.md convention.

*If the planner introduces tests for this phase, it would be a first for the project. **Do not introduce tests in Phase 15** — defer test-framework selection to a dedicated infrastructure phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser tab title updates from DB | DETOK-01 | Cannot grep-assert runtime DOM mutation | (1) Set `companyName='TestTenant'` in `company_settings` row. (2) Hard-reload customer site. (3) Inspect browser tab title. (4) Expect: "TestTenant" |
| localStorage key migrates with slug change | DETOK-02 | Runtime localStorage key is dynamic | (1) Set `companyName='Acme Cleaners'` in DB. (2) Load site. (3) Open devtools → Application → localStorage. (4) Expect key prefix `acme-cleaners_visitor_id`. (5) Change `companyName='Beta Co'`. (6) Reload. (7) Expect new key `beta-co_visitor_id` |
| Privacy and Terms pages render with empty companyName | DETOK-03 | Runtime React render | (1) Set `companyName=''` in DB. (2) Load `/privacy-policy`. (3) Confirm page does not show "Skleanings" anywhere. (4) Repeat for `/terms-of-service` |
| OpenRouter X-Title header reflects companyName | SERV-01 | Network-level header check | (1) Set `companyName='TestTenant'`. (2) Invoke `/api/integrations/openrouter/test` (or trigger blog generation). (3) Use Charles Proxy / DevTools / mitmproxy to intercept. (4) Confirm outbound request `X-Title: TestTenant` |
| Migration applies cleanly | WLTYPE-01, LEGAL-01 | DB-level validation | (1) `supabase db push` from project root. (2) Confirm migration applied without error. (3) `psql $DATABASE_URL -c "\d company_settings"` shows the three new columns with correct types and defaults |
| Empty companyName does not crash openrouter | SERV-01 | Edge case for tenant with no name set | (1) Set `companyName=''`. (2) Trigger blog generation. (3) Confirm no error thrown. (4) Confirm `X-Title` header is empty or omitted gracefully |

---

## Validation Sign-Off

- [ ] All tasks have grep-verifiable acceptance criteria OR mapped to a Manual-Only entry
- [ ] No new test framework introduced (matches project convention)
- [ ] Sampling continuity: every task commit triggers `npm run check`
- [ ] Wave 0 (none required) is documented as such
- [ ] All 6 phase requirements (WLTYPE-01, LEGAL-01, DETOK-01, DETOK-02, DETOK-03, SERV-01) covered above
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter when planner approves

**Approval:** pending
