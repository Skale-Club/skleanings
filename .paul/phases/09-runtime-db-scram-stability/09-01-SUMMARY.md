---
phase: 09-runtime-db-scram-stability
plan: 01
subsystem: runtime-db-auth
tags: [postgres, scram, vercel, auth, cold-start]

requires:
  - phase: 08-production-db-stability
    provides: pooled serverless runtime path

provides:
  - Redacted DB bootstrap diagnostics for selected runtime URL source and first warmup failure
  - One-time serverless SCRAM fallback from pooled URL to alternate DB URL during cold start
  - Auth flow now surfaces DB bootstrap failures as server errors instead of false auth failures

affects: []

tech-stack:
  added: []
  patterns:
    - "Serverless DB bootstrap warms the selected connection once before targeted DB-backed requests"
    - "Cold-start SCRAM failures retry once with an alternate configured runtime URL"
    - "Auth endpoints must not downgrade DB/runtime failures into 401/403 responses"

key-files:
  modified:
    - server/db.ts
    - server/lib/auth.ts
    - server/routes/blog.ts

key-decisions:
  - "Keep POSTGRES_URL as the primary Vercel runtime candidate, but log the chosen source and host fingerprint"
  - "On a first warmup SCRAM signature failure, wait 300ms and switch once to the next configured URL candidate"
  - "Require DB warmup before auth/user lookup and blog cron generation so transient bootstrap failures are handled centrally"
  - "Let auth bootstrap failures surface as 5xx so the client does not clear a valid local session and enter a redirect loop"

patterns-established:
  - "Use ensureDatabaseReady() before targeted cold-start-sensitive DB flows"

duration: ~25min
started: 2026-04-04T00:00:00Z
completed: 2026-04-04T00:00:00Z
---

# Phase 9 Plan 01: Runtime DB SCRAM Stability - Summary

Implemented targeted DB bootstrap hardening for the two failing cold-start paths. The runtime now logs which DB URL source won, performs a warmup query, and if the first serverless warmup fails with the known SCRAM signature error, it retries once against the next configured URL candidate before the auth or cron flow proceeds.

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Failure is reproducible and classified | Partial | Added source/host/failure diagnostics in `server/db.ts`; production log capture still required |
| AC-2: Runtime DB path is hardened against current SCRAM failure mode | Pass (code) | `ensureDatabaseReady()` warms the selected client and performs one alternate-URL retry on SCRAM failure |
| AC-3: Autopost and login flows are both green | Pending | Manual production verification still required |
| AC-4: Login does not redirect-loop after successful auth | Pass (code) / Pending (manual) | DB bootstrap/auth failures now surface as 5xx instead of 401, so the client should not clear a valid session on transient startup issues |

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `server/db.ts` | Modified | Add redacted diagnostics, connection candidate ordering, warmup, and one-time SCRAM fallback |
| `server/lib/auth.ts` | Modified | Ensure DB warmup before user lookup and stop masking runtime DB failures as auth failures |
| `server/routes/blog.ts` | Modified | Ensure cron generation waits for DB bootstrap before starting job creation |

## Verification Notes

- `npm run check` could not be completed in this workspace because the local TypeScript toolchain is not installed (`tsc` was not found on PATH and `node_modules` is absent).
- Manual/UAT steps from `.planning/phases/09-runtime-db-scram-stability/09-UAT.md` remain outstanding.

## Next Steps

1. Deploy and inspect the new `[DB] Boot`, `[DB] Warmup ok`, and `[DB] Warmup failed` logs to confirm the actual production URL path.
2. Run one cold and one warm login attempt for `skleanings@gmail.com` and confirm `/api/auth/me` no longer returns transient 401/403 during startup.
3. Trigger `/api/blog/cron/generate` from a cold start and confirm either success or an expected skipped response with no SCRAM signature error.
