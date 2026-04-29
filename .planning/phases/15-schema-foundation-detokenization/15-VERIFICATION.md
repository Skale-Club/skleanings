---
phase: 15
slug: schema-foundation-detokenization
status: human_needed
verified_at: 2026-04-29
plans_complete: 3
plans_total: 3
verifier: inline (orchestrator after gsd-plan-checker hit usage limit)
---

# Phase 15: Schema Foundation & Detokenization — Verification

## Phase Goal

> The database schema supports all white-label configurable fields and no hardcoded "Skleanings" strings remain in the frontend or server codebase — new tenant configuration is consumed from DB at runtime.

## Goal-Backward Verification

### Success Criterion 1 — Migration + columns exist

**Status:** ✓ FILE-LEVEL PASS / ⚠ DB APPLY PENDING (user action)

- Migration file created: `supabase/migrations/20260428000000_add_white_label_columns.sql` ✓
- Three columns present in migration SQL (`ADD COLUMN IF NOT EXISTS`):
  - `service_delivery_model TEXT DEFAULT 'at-customer'` ✓
  - `privacy_policy_content TEXT DEFAULT ''` ✓
  - `terms_of_service_content TEXT DEFAULT ''` ✓
- Drizzle schema extended at `shared/schema.ts:682-684` ✓
- TypeScript compiles cleanly with new columns (`npm run check` PASS) ✓
- `getCompanySettings` confirmed full-row select at `server/storage.ts:891` (Risk 1 mitigated) ✓
- **Pending operator action:** `supabase db push` to apply migration to live DB. Tracked in STATE.md blockers.

### Success Criterion 2 — Browser tab title from companyName

**Status:** ✓ AUTOMATED PASS / Manual smoke test pending

- `App.tsx:29` contains `document.title = settings?.companyName || "";` ✓
- D-03 honored: `ThemeContext.tsx` unchanged (theme-only) ✓
- **Manual smoke test:** Set `companyName='TestTenant'` in DB row, reload customer site, observe browser tab title.

### Success Criterion 3 — localStorage key derived from slug

**Status:** ✓ AUTOMATED PASS / Manual smoke test pending

- `client/src/lib/visitor-key.ts` created with `getVisitorIdKey(slug)` helper ✓
- `useUTMCapture` rewired to derive key from `companyName`-slugified, gated on `isReady` ✓
- All 3 read sites consume the helper:
  - `use-utm-capture.ts` ✓
  - `client/src/components/chat/ChatWidget.tsx` ✓
  - `client/src/pages/BookingPage.tsx` ✓
- Negative grep `skleanings_visitor_id` in `client/src/`: **zero matches** ✓
- **Manual smoke test:** Change `companyName` in DB, reload, verify localStorage key prefix changes (`acme-cleaners_visitor_id`, etc.)

### Success Criterion 4 — Zero "Skleanings" in React component files

**Status:** ✓ AUTOMATED PASS

- `grep -rn '"Skleanings"' client/src/ --include="*.tsx" --include="*.ts"`: **zero matches** ✓
- D-08 preserved: `THEME_STORAGE_KEY = 'skleanings-admin-theme'` intact in `client/src/context/ThemeContext.tsx:15` ✓
- All `|| "Skleanings"` and `|| "contact@skleanings.com"` fallbacks replaced with `|| ""` per D-11 ✓
- D-13 honored: `server/routes/integrations/telegram.ts` and `thumbtack.ts` untouched ✓

### Success Criterion 5 — openrouter.ts reads from companyName

**Status:** ✓ AUTOMATED PASS / Manual smoke test pending

- `server/lib/openrouter.ts` line 22 + 47: `process.env.OPENROUTER_APP_TITLE || companyName || ""` ✓
- Both exported functions accept optional `companyName?: string` parameter ✓
- D-10 honored: `grep -n 'import.*storage' server/lib/openrouter.ts` returns zero matches ✓
- All callers updated:
  - `server/routes/integrations/ai.ts:203,227` — fetch companyName from storage, pass through ✓
  - `server/routes/chat/message-handler.ts:1095` — fetch companyName before chatDeps call ✓
- Risk 6 mitigated: optional parameter keeps existing callers compiling ✓
- **Manual smoke test:** Trigger openrouter call (e.g. blog generation), intercept outbound request, confirm `X-Title: TestTenant` header.

## Requirements Coverage

| REQ-ID | Plan | Status |
|--------|------|--------|
| WLTYPE-01 | 15-01 | ✓ Verified (schema + migration) |
| LEGAL-01 | 15-01 | ✓ Verified (schema + migration) |
| DETOK-01 | 15-02 | ✓ Verified (App.tsx document.title) |
| DETOK-02 | 15-02 | ✓ Verified (visitor-key helper, all 3 read sites) |
| DETOK-03 | 15-02 | ✓ Verified (zero "Skleanings" in client/src/) |
| SERV-01 | 15-03 | ✓ Verified (openrouter param + all callers) |

**Coverage: 6/6 requirement IDs verified at file-level**

## Plan Completion

| Plan | Status | Final Commit |
|------|--------|--------------|
| 15-01 | ✓ Complete | `a8b5fd4` |
| 15-02 | ✓ Complete | `e87a4b0` |
| 15-03 | ✓ Complete | `62337f0` |

## Locked Decision Compliance

| Decision | Plan | Status |
|----------|------|--------|
| D-01 (3 columns w/ defaults) | 15-01 | ✓ Honored |
| D-02 (Drizzle schema extension) | 15-01 | ✓ Honored |
| D-03 (no ThemeContext changes) | 15-02 | ✓ Honored |
| D-04 (App.tsx useEffect) | 15-02 | ✓ Honored |
| D-05/06/07 (slug-derived key, isReady gate, getVisitorIdKey helper) | 15-02 | ✓ Honored |
| D-08 (THEME_STORAGE_KEY unchanged) | 15-01/02 | ✓ Honored |
| D-09 (companyName param) | 15-03 | ✓ Honored |
| D-10 (no storage import in openrouter.ts) | 15-03 | ✓ Honored |
| D-11 (`\|\| ""` fallbacks) | 15-02 | ✓ Honored |
| D-12 (zero "Skleanings" matches) | 15-02 | ✓ Honored |
| D-13 (telegram.ts/thumbtack.ts deferred) | 15-03 | ✓ Honored |

## Risk Mitigation

| Risk | Status |
|------|--------|
| Risk 1 (getCompanySettings whitelist) | ✓ Verified — full-row select at server/storage.ts:891 |
| Risk 6 (back-compat — optional param) | ✓ Optional `companyName?: string` keeps callers compiling |
| Pitfall (attribution disconnect for existing visitors) | Accepted per CONTEXT line 127 |

## Human Verification Required

Five runtime behaviors require manual smoke testing before phase can be considered fully verified:

1. **Apply migration to live DB.** Set `POSTGRES_URL_NON_POOLING` in `.env`, run `supabase db push` from project root. Confirm columns exist via `psql -c "\d company_settings"`.
2. **Browser tab title updates from companyName.** Set `companyName='TestTenant'` in DB → reload site → verify tab title shows "TestTenant".
3. **localStorage key migrates with slug change.** Set `companyName='Acme Cleaners'` → reload → inspect localStorage key prefix `acme-cleaners_visitor_id`.
4. **Privacy/Terms pages render with empty companyName.** Set `companyName=''` → load `/privacy-policy` and `/terms-of-service` → confirm pages render without "Skleanings" anywhere.
5. **OpenRouter X-Title header reflects companyName.** Trigger blog generation with `companyName='TestTenant'` → intercept network request → confirm `X-Title: TestTenant` header.

These items are listed in `15-VALIDATION.md` Manual-Only Verifications section.

## Verdict

**File-level: PASS** — all 6 grep-based acceptance criteria pass, TypeScript clean, all locked decisions honored.

**Runtime: human_needed** — 5 manual smoke tests pending (DB apply + 4 browser/network behaviors).

The phase delivers the schema foundation and full detokenization. Runtime verification is gated on the operator applying the migration to the live database.
