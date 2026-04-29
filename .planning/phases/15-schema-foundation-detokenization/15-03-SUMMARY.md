---
phase: 15
plan: 03
subsystem: schema-foundation-detokenization
tags: [server, detokenization, openrouter, white-label, dependency-injection]
requirements:
  completed: [SERV-01]
dependency-graph:
  requires:
    - "Plan 15-01 (schema foundation) — companySettings.companyName field already existed and is read via storage.getCompanySettings()"
  provides:
    - "Detokenized server/lib/openrouter.ts factory functions with optional companyName parameter injection"
    - "OpenRouter X-Title header now reflects actual tenant identity (or is omitted when unset) instead of hardcoded \"Skleanings\""
  affects:
    - "Operator deployments — OPENROUTER_APP_TITLE env var still wins when set (preserved precedence)"
    - "Multi-tenant ops — each tenant's outbound OpenRouter calls are correctly attributed via X-Title"
tech-stack:
  added: []
  patterns:
    - "Optional second positional parameter (companyName?: string) for back-compat across all existing callers (Risk 6 mitigation)"
    - "Title precedence chain: process.env.OPENROUTER_APP_TITLE || companyName || \"\" (env > arg > empty-omit-header)"
    - "Pure utility module — D-10 enforced: openrouter.ts has zero storage/DB imports; callers fetch companySettings and inject"
    - "DI typeof alias auto-tracks signature changes — dependencies.ts required NO code change (typeof defaultGetOpenRouterClient propagates the new optional param)"
key-files:
  created: []
  modified:
    - "server/lib/openrouter.ts (both exported functions get optional 2nd param; literal removed)"
    - "server/routes/integrations/ai.ts (2 caller sites in /openrouter/test and /openrouter/models route handlers)"
    - "server/routes/chat/message-handler.ts (1 caller site at line 1095, threads company?.companyName via chatDeps DI)"
decisions:
  - "Used Option A (reuse existing 'company' variable from line 936) for message-handler.ts — avoids redundant DB fetch in a single chat request"
  - "Two separate storage.getCompanySettings() calls in ai.ts because the two openrouter callers live in DIFFERENT route handlers (different request scopes); cannot share a single fetch"
  - "?? undefined fallback (not ?? '') — passes through cleanly to optional parameter contract; openrouter title chain handles both equivalently but undefined is more idiomatic"
  - "dependencies.ts required NO modification — typeof defaultGetOpenRouterClient automatically tracks the new (apiKey?, companyName?) signature"
  - "D-13 honored: server/routes/integrations/{telegram,thumbtack}.ts left untouched (out of scope per phase boundary)"
metrics:
  duration: "3m 23s"
  completed: "2026-04-29"
  tasks: 3
  files: 3
---

# Phase 15 Plan 03: Server Detokenization (openrouter.ts) Summary

Detokenized `server/lib/openrouter.ts` so the OpenRouter `X-Title` header reflects the actual tenant identity by adding an optional `companyName?: string` parameter to both exported factory functions and updating all three caller sites to fetch `companyName` from `storage.getCompanySettings()` and pass it through.

## What Was Done

### Task 1: openrouter.ts factory functions

**File:** `server/lib/openrouter.ts`
**Commit:** `a28aec1`

Both exported factory functions gained an optional second parameter and a parameter-injected title resolution:

```typescript
// Before:
export function getOpenRouterClient(apiKey?: string) { ...
  const title = process.env.OPENROUTER_APP_TITLE || "Skleanings";
}
export async function listOpenRouterModels(apiKey?: string): Promise<OpenRouterModelInfo[]> { ...
  const title = process.env.OPENROUTER_APP_TITLE || "Skleanings";
}

// After:
export function getOpenRouterClient(apiKey?: string, companyName?: string) { ...
  const title = process.env.OPENROUTER_APP_TITLE || companyName || "";
}
export async function listOpenRouterModels(apiKey?: string, companyName?: string): Promise<OpenRouterModelInfo[]> { ...
  const title = process.env.OPENROUTER_APP_TITLE || companyName || "";
}
```

Title precedence: env var (operator override) > companyName param (per-tenant from DB) > empty string (existing `(title ? { "X-Title": title } : {})` guard at lines 29 and 53 omits the header when empty).

D-10 enforced: zero `storage` or DB imports — the file remains a pure utility.

### Task 2: ai.ts route callers

**File:** `server/routes/integrations/ai.ts`
**Commit:** `483ad1f`

Two caller sites updated. Each lives in a **different** route handler, so each fetches its own `companySettings`:

```typescript
// /openrouter/test handler (~line 203):
const cs = await storage.getCompanySettings();
const client = getOpenRouterClient(keyToUse, cs?.companyName ?? undefined);

// /openrouter/models handler (~line 228):
const cs = await storage.getCompanySettings();
const models = await listOpenRouterModels(keyToUse, cs?.companyName ?? undefined);
```

`storage` was already imported. No new error-handling wrapping (existing route middleware catches throws).

### Task 3: chat DI surface + message-handler

**Files:** `server/routes/chat/dependencies.ts` (no change), `server/routes/chat/message-handler.ts`
**Commit:** `aa8b9d2`

**dependencies.ts:** No code change required. `ChatDependencies.getOpenRouterClient` is typed as `typeof defaultGetOpenRouterClient`. When the underlying signature gained the optional second parameter in Task 1, the `typeof` alias automatically propagated the new contract through the DI surface — verified by clean `npm run check` after Task 3.

**message-handler.ts:** Used Option A (reuse existing settings load). The handler already fetches `const company = await chatDeps.storage.getCompanySettings()` at line 936 and uses it throughout for the system prompt. The single openrouter call at line 1095 was updated:

```typescript
// Before:
? chatDeps.getOpenRouterClient(apiKey)

// After:
? chatDeps.getOpenRouterClient(apiKey, company?.companyName ?? undefined)
```

No redundant DB call; reuses the already-loaded `company` row.

## SERV-01 Acceptance Verification

| Check | Command | Result |
| ----- | ------- | ------ |
| Negative grep — literal removed | `grep -n '"Skleanings"' server/lib/openrouter.ts` | PASS (0) |
| Positive grep — companyName present | `grep -n "companyName" server/lib/openrouter.ts` | PASS (4) |
| D-10 — no storage import | `grep -n 'import.*storage' server/lib/openrouter.ts` | PASS (0) |
| Both signatures use optional 2nd param | `grep -c "companyName?: string" server/lib/openrouter.ts` | PASS (2) |
| Title precedence chain | `grep -c "OPENROUTER_APP_TITLE \|\| companyName" server/lib/openrouter.ts` | PASS (2) |
| X-Title guard preserved | `grep -c "X-Title" server/lib/openrouter.ts` | PASS (2) |
| ai.ts callers updated | `grep -c "getCompanySettings" server/routes/integrations/ai.ts` | PASS (2) |
| message-handler.ts caller updated | `grep -c "chatDeps.getOpenRouterClient(apiKey, " server/routes/chat/message-handler.ts` | PASS (1) |
| D-13 — telegram untouched | `git diff HEAD~5 -- server/routes/integrations/telegram.ts` | PASS (no diff) |
| D-13 — thumbtack untouched | `git diff HEAD~5 -- server/routes/integrations/thumbtack.ts` | PASS (no diff) |
| TypeScript clean (server/) | `npm run check` for server/shared paths | PASS (0 errors) |

## Caller Update Strategy Recap

| Site | Strategy | Rationale |
| ---- | -------- | --------- |
| `ai.ts:203` (/openrouter/test) | Fresh fetch | Different route handler scope from /models |
| `ai.ts:228` (/openrouter/models) | Fresh fetch | Different route handler scope from /test |
| `message-handler.ts:1095` | Option A (reuse `company` from line 936) | Single chat request — avoids redundant DB call |
| `dependencies.ts` | No code change | `typeof defaultGetOpenRouterClient` auto-tracks new signature |

## Backward Compatibility

The new `companyName` parameter is optional (`companyName?: string`), so the change is non-breaking:

- Any external consumer importing `getOpenRouterClient(apiKey)` (one-arg) still compiles — Risk 6 mitigation from RESEARCH.md.
- Any internal call site not yet updated would also compile — but all three known call sites in this codebase have been updated in this plan.
- `OPENROUTER_APP_TITLE` env var still reads first in the precedence chain — operator override preserved.
- When both env and companyName are unset, `title` is `""` and the existing `(title ? { "X-Title": title } : {})` guard omits the header gracefully (no empty-string header sent).

## Deviations from Plan

None — plan executed exactly as written.

### Auto-fixes Applied

None.

### Out-of-Scope Observations (deferred)

- During `npm run build` smoke, TypeScript reported errors in `client/src/pages/BookingPage.tsx` (lines 48, 105) about `companySettings` being redeclared. These are uncommitted modifications from the **parallel 15-02 executor** that owns `client/`. Per the parallel_execution contract for this plan, files under `client/` are strictly out of scope. The 15-02 wave-completion validator will resolve these in its own commit chain. Server-only `npm run check` of `server/` and `shared/` paths is clean (zero errors from this plan's changes).

## D-13 Traceability

Confirmed via git diff: `server/routes/integrations/telegram.ts` and `server/routes/integrations/thumbtack.ts` were NOT modified in this plan. Their literal `"Skleanings"` strings remain (telegram.ts:98, thumbtack.ts:45) — explicitly out of scope per CONTEXT.md D-13 ("Server-side integration files... are out of scope for this phase — DETOK-03 success criteria targets `client/src/` React component files only").

## Operator Smoke Tests (Manual — per VALIDATION.md)

The following manual checks remain for the operator (network-level header verification cannot be grep-asserted):

1. **Tenant identity in X-Title** — Set `companyName='TestTenant'` in `company_settings`. Invoke `/api/integrations/openrouter/test`. Use mitmproxy/Charles/DevTools to intercept the outbound request. Confirm `X-Title: TestTenant` header.
2. **Empty companyName, env unset** — Set `companyName=''` in DB; ensure `OPENROUTER_APP_TITLE` env is unset. Trigger an openrouter call. Confirm no error and `X-Title` header is **omitted** (not empty-string) due to the preserved guard.
3. **Env override precedence** — Set both `OPENROUTER_APP_TITLE='OpsLabel'` (env) and `companyName='TenantA'` (DB). Trigger call. Confirm `X-Title: OpsLabel` (env wins).

## Self-Check: PASSED

- File `server/lib/openrouter.ts` (modified): FOUND
- File `server/routes/integrations/ai.ts` (modified): FOUND
- File `server/routes/chat/message-handler.ts` (modified): FOUND
- File `server/routes/chat/dependencies.ts` (no change required, verified): FOUND
- Commit `a28aec1` (Task 1 — openrouter.ts): FOUND
- Commit `483ad1f` (Task 2 — ai.ts): FOUND
- Commit `aa8b9d2` (Task 3 — message-handler.ts): FOUND
- All SERV-01 grep assertions: PASS
- D-13 (telegram, thumbtack untouched): PASS
- Server-side TypeScript: PASS (0 errors in server/ and shared/)
- D-10 (no storage import in openrouter.ts): PASS
