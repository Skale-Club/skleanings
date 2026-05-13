---
phase: 35-blog-cron-migration
plan: "01"
subsystem: blog-cron
tags: [blog, cron, github-actions, auth, dual-auth]
dependency_graph:
  requires: []
  provides: [blog-cron-auth, blog-generate-endpoint]
  affects: [server/routes/blog.ts, .github/workflows]
tech_stack:
  added: []
  patterns: [dual-auth bearer + session, GitHub Actions cron]
key_files:
  created:
    - .github/workflows/blog-cron.yml
  modified:
    - server/routes/blog.ts
  deleted:
    - .github/workflows/blog-autopost.yml
decisions:
  - "Dual-auth pattern: BLOG_CRON_TOKEN bearer checked first; invalid bearer returns 401 immediately without leaking to session path"
  - "/cron/generate handler fully removed — only called by old blog-autopost.yml"
  - "blog-cron.yml and blog-autopost.yml swapped atomically in single commit to prevent double-spend window"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-11"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 35 Plan 01: Blog Cron Migration — Dual-Auth and Workflow Replacement Summary

**One-liner:** Replaced hourly CRON_SECRET blog-autopost workflow with daily BLOG_CRON_TOKEN blog-cron workflow and added dual-auth (bearer token + admin session) to POST /api/blog/generate.

## What Was Built

### server/routes/blog.ts — Dual-auth /generate handler

The old `router.post("/generate", requireAdmin, ...)` handler was replaced with a new handler that:

1. Reads `process.env.BLOG_CRON_TOKEN`
2. If a valid bearer token matches — runs generation as cron (manual: false), returns `{ status, postId }`
3. If a bearer token is present but does NOT match — returns 401 immediately (no session path leak)
4. If no bearer token at all — delegates to `requireAdmin(req, res, callback)` for UI-triggered generation

The old `router.post("/cron/generate", ...)` handler (lines 224–260) was fully deleted — it was only called by `blog-autopost.yml` which no longer exists.

### Exact dual-auth logic shape (for future reference)

```typescript
router.post("/generate", async (req, res) => {
  const cronToken = process.env.BLOG_CRON_TOKEN;
  const authHeader = req.headers.authorization;
  const providedToken = authHeader?.replace("Bearer ", "");

  if (cronToken && providedToken === cronToken) {
    // cron path: manual: false, returns { status, postId }
  }

  if (providedToken && providedToken.length > 0) {
    return res.status(401).json({ message: "Unauthorized" }); // invalid token
  }

  return requireAdmin(req, res, async () => {
    // admin UI path: manual: true, autoPublish from body
  });
});
```

### .github/workflows/blog-cron.yml

- Schedule: `0 9 * * *` (09:00 UTC daily — was `0 * * * *` hourly)
- Secret: `BLOG_CRON_TOKEN` (was `CRON_SECRET`)
- Endpoint: `/api/blog/generate` (was `/api/blog/cron/generate`)
- Timeout: 10 minutes (was 5 minutes)
- Retry: once on 5xx after 10s sleep (same behavior)
- Skipped-status detection preserved

### .github/workflows/blog-autopost.yml

Deleted. The old hourly workflow calling `/api/blog/cron/generate` with `CRON_SECRET` no longer exists.

### vercel.json

Confirmed: no `crons` key present. No edit needed.

## Deviations from Plan

None - plan executed exactly as written.

## Action Required Before First Scheduled Run

`BLOG_CRON_TOKEN` must be added to the GitHub repository:
**Settings > Secrets and variables > Actions > New repository secret**

Name: `BLOG_CRON_TOKEN`
Value: Any strong random string (e.g., `openssl rand -hex 32`)

Until this secret is set, the scheduled workflow will fail at the "BLOG_CRON_TOKEN secret is not configured" check. The admin UI path continues to work independently (uses session auth, not the token).

## Self-Check: PASSED

- server/routes/blog.ts — modified, committed at 3734c42
- .github/workflows/blog-cron.yml — created, committed at 25031a3
- .github/workflows/blog-autopost.yml — deleted, committed at 25031a3
- npm run check — passes (tsc exits 0)
- `grep -n "cron/generate" server/routes/blog.ts` — no results (handler removed)
- `grep -n "BLOG_CRON_TOKEN" server/routes/blog.ts` — 3 hits (token check present)
