# Phase 15: Schema Foundation & Detokenization — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 15-schema-foundation-detokenization
**Areas discussed:** Browser tab title, localStorage key derivation, openrouter.ts injection, fallback defaults scope

---

## Browser Tab Title (DETOK-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ThemeContext | Add companyName/companyEmail to ThemeContext; set document.title there | |
| useEffect in App.tsx | Add a single effect after the existing useCompanySettings() call | ✓ |
| Extend useSEO hook | Make the existing useSEO hook update document.title | |

**User's choice:** Move forward (auto-selected recommended default)
**Notes:** ThemeContext is theme-only; CompanySettingsContext already handles company data from API. Minimal change: one useEffect in App.tsx.

---

## localStorage Key Derivation (DETOK-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on isReady + derive from slug | Wait for CompanySettingsContext to load, use slug-based key, export getVisitorIdKey helper | ✓ |
| Window origin namespace | Use window.location.hostname as key prefix — no async dependency | |
| Env var configurable key | Keep key hardcoded in code but override via env var | |
| Fallback-then-migrate | Use temp key until settings load, then migrate localStorage entry | |

**User's choice:** Move forward (auto-selected recommended default)
**Notes:** Gate on isReady acceptable — UTM capture completes before any meaningful user action. ThemeContext's 'skleanings-admin-theme' key intentionally excluded (admin-only, not a display string, changing forces admin theme reset).

---

## openrouter.ts Injection (SERV-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Parameter injection | Add companyName param to blog-gen function; caller passes from DB | ✓ |
| DB fetch inside utility | openrouter.ts fetches companySettings from storage itself | |
| Env var override layer | Keep env var but add DB-read override when available | |

**User's choice:** Move forward (auto-selected recommended default)
**Notes:** Keeps openrouter.ts as a pure utility. Cleaner for testing. Caller already has DB access (cron job / route handler context).

---

## Fallback Defaults Scope (DETOK-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with empty string | || "" — show nothing when unconfigured | ✓ |
| Generic placeholder | || "Company Name" / || "contact@company.com" | |
| Remove fallback entirely | Trust DB always has values | |
| Keep Skleanings fallback | Leave as-is, only fix display components | |

**User's choice:** Move forward (auto-selected recommended default)
**Notes:** White-label principle: empty > wrong name. Server-side files (telegram.ts, thumbtack.ts) excluded — success criteria targets client/src/ React component files only.

---

## Claude's Discretion

- Exact migration file timestamp
- Column order within migration
- Whether to add `slug` column or derive key from `companyName` (researcher to verify)
- File order of changes across the plan

## Deferred Ideas

- ThemeContext `'skleanings-admin-theme'` storage key — admin-only, non-display, intentionally excluded
- Telegram/Thumbtack server strings — deferred to future cleanup
- Per-page document.title routing — Phase 16 SEO meta injection territory
