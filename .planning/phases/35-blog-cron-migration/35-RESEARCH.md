# Phase 35: Blog Cron Migration - Research

**Researched:** 2026-05-11
**Domain:** GitHub Actions cron scheduling, Express auth middleware, Drizzle ORM schema cleanup, Supabase migration
**Confidence:** HIGH

## Summary

Phase 35 is a focused cleanup and migration phase. The project already has a working GitHub Actions blog workflow (`blog-autopost.yml`) and a cron-auth endpoint (`POST /api/blog/cron/generate`). The work is to rename the workflow to `blog-cron.yml`, reconcile the endpoint path to `/api/blog/generate`, replace `CRON_SECRET` with a dedicated `BLOG_CRON_TOKEN` env var (per requirements), and remove the `systemHeartbeats` table completely.

The pattern is already proven: three other GitHub Actions cron workflows in the repo use the same shape (CRON_SECRET, APP_URL, curl + 401-check). The main concern is the endpoint naming discrepancy — requirements specify `POST /api/blog/generate` and `BLOG_CRON_TOKEN`, but the existing workflow calls `/api/blog/cron/generate` using `CRON_SECRET`. The plan must resolve this clearly.

The `systemHeartbeats` table exists in `shared/schema.ts` and in the legacy migrations folder (`migrations/0013_system_heartbeats.sql`), but there is NO storage method importing it and NO route referencing it. Removal is purely a schema-and-migration drop — no application logic to untangle.

**Primary recommendation:** Create `blog-cron.yml` that calls `POST /api/blog/generate` with `BLOG_CRON_TOKEN`. Add auth guard to the existing `/generate` endpoint (currently admin-session-only), remove `vercel.json` cron block (already absent), drop `systemHeartbeats` from schema and add a Supabase migration to DROP TABLE.

## Project Constraints (from CLAUDE.md)

- DB migrations: always via Supabase CLI (`supabase db push`), NEVER `drizzle-kit push` (TTY prompt issues — from MEMORY.md)
- Admin tools: lean; don't replicate customer-side flows
- Stack: Express.js, TypeScript, Drizzle ORM, PostgreSQL; shared/schema.ts is source of truth
- Brand and styling conventions not applicable to this phase (server-only changes)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLOG-01 | `.github/workflows/blog-cron.yml` triggers `POST /api/blog/generate` daily at 09:00 UTC with Bearer `BLOG_CRON_TOKEN` | Existing `blog-autopost.yml` is the direct template. Needs rename + endpoint path + secret name change. |
| BLOG-02 | `POST /api/blog/generate` rejects requests without `Authorization: Bearer <BLOG_CRON_TOKEN>` with 401 | Endpoint exists at `router.post("/generate", requireAdmin, ...)` — currently guarded by admin session. Needs a parallel token-auth path before the session check. |
| BLOG-03 | Vercel cron config for blog generation removed from `vercel.json` | Already absent — `vercel.json` has no `crons` key. Verification-only task. |
| BLOG-04 | `systemHeartbeats` table and all references removed from schema, migrations, storage, routes | Table defined in `shared/schema.ts:403`. Legacy migration in `migrations/0013_system_heartbeats.sql`. No storage methods, no routes reference it. Needs schema deletion + Supabase DROP TABLE migration. |
</phase_requirements>

## Current State Audit

### What exists vs. what requirements specify

| Requirement | Specified | Current State | Gap |
|-------------|-----------|---------------|-----|
| Workflow file | `blog-cron.yml` | `blog-autopost.yml` | Rename/replace |
| Endpoint path | `POST /api/blog/generate` | `POST /api/blog/cron/generate` (cron) AND `POST /api/blog/generate` (admin-session) | Add BLOG_CRON_TOKEN auth to existing `/generate` |
| Secret name | `BLOG_CRON_TOKEN` | `CRON_SECRET` used in blog-autopost.yml | New dedicated secret |
| vercel.json cron | Removed | Already absent | Confirm only |
| systemHeartbeats | Removed | In schema.ts, migrations/0013, api/index.js (compiled) | Drop from schema + migration |

### Endpoint analysis

**`POST /api/blog/cron/generate`** (line 225, `server/routes/blog.ts`):
- Reads `process.env.CRON_SECRET` for auth
- Returns 401 on mismatch
- Calls `BlogGenerator.startDailyPostGeneration`

**`POST /api/blog/generate`** (line 423, `server/routes/blog.ts`):
- Guarded by `requireAdmin` (session-based admin check)
- Used by admin UI for manual generation
- Same underlying generator call

The requirements want cron auth on `/api/blog/generate`. The cleanest approach: add a token-based auth path to `/generate` that checks `BLOG_CRON_TOKEN` BEFORE `requireAdmin`. This keeps the admin UI working and satisfies BLOG-02.

Alternatively: keep `/cron/generate` and change the workflow to use `BLOG_CRON_TOKEN` instead of `CRON_SECRET`. But requirements explicitly state `/api/blog/generate` so we must use that path.

### systemHeartbeats scope

References found:
- `shared/schema.ts:403` — table definition and type export (`SystemHeartbeat`)
- `migrations/0013_system_heartbeats.sql` — legacy Drizzle migration (the `migrations/` folder is legacy, not Supabase)
- `api/index.js` — compiled bundle (regenerated on build, not manually edited)

References NOT found:
- `server/storage.ts` — no import of `systemHeartbeats`
- Any route file — no heartbeat endpoint
- `supabase/migrations/` — no Supabase migration for this table

This means the table may not exist in the live Supabase DB (never migrated via Supabase CLI). The DROP TABLE migration must use `DROP TABLE IF EXISTS` to be safe.

### vercel.json

Current `vercel.json` has no `crons` array — the Vercel Cron config is already absent. BLOG-03 is a verification-only task.

### blog-autopost.yml (existing workflow)

- Runs hourly (`0 * * * *`) — the new workflow should run daily at 09:00 UTC (`0 9 * * *`)
- Calls `/api/blog/cron/generate` — must change to `/api/blog/generate`
- Uses `CRON_SECRET` — must change to `BLOG_CRON_TOKEN`
- Has retry logic on 5xx, skipped-status detection — keep this
- Has `workflow_dispatch` for manual trigger — keep this

## Standard Stack

No new libraries. This phase uses only existing project infrastructure:

| Component | Current Usage | Phase Use |
|-----------|---------------|-----------|
| GitHub Actions `schedule:` | Already in 4 existing workflows | blog-cron.yml trigger |
| `curl` in GH Actions step | Already in all existing workflows | HTTP call to app |
| `process.env.BLOG_CRON_TOKEN` | New env var | Auth check in endpoint |
| Drizzle ORM `pgTable` | schema.ts | Remove systemHeartbeats export |
| Supabase CLI | Used for all migrations | DROP TABLE migration |

**No npm installs required.**

## Architecture Patterns

### Pattern 1: GitHub Actions Cron Workflow (established pattern)

All existing cron workflows follow this exact structure:

```yaml
name: Blog Generation

on:
  schedule:
    - cron: '0 9 * * *'   # 09:00 UTC daily
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for manual trigger'
        required: false
        default: 'Manual trigger'

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Generate Blog Post
        env:
          BLOG_CRON_TOKEN: ${{ secrets.BLOG_CRON_TOKEN }}
          APP_URL: ${{ vars.APP_URL }}
        run: |
          if [ -z "$BLOG_CRON_TOKEN" ]; then
            echo "ERROR: BLOG_CRON_TOKEN secret is not configured"
            exit 1
          fi
          if [ -z "$APP_URL" ]; then
            echo "ERROR: APP_URL variable is not configured"
            exit 1
          fi

          APP_URL="${APP_URL%/}"
          echo "Using APP_URL: $APP_URL"

          call_generate() {
            curl -L -s -w "\n%{http_code}" -X POST \
              "${APP_URL}/api/blog/generate" \
              -H "Authorization: Bearer ${BLOG_CRON_TOKEN}" \
              -H "Content-Type: application/json" \
              --max-time 120
          }

          echo "Triggering blog generation at $(date -u)"
          RESPONSE=$(call_generate)
          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | sed '$d')

          if [ "$HTTP_CODE" -ge 500 ]; then
            echo "Received HTTP $HTTP_CODE. Retrying once after 10s..."
            sleep 10
            RESPONSE=$(call_generate)
            HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
            BODY=$(echo "$RESPONSE" | sed '$d')
          fi

          echo "Response: $BODY"
          echo "HTTP Status: $HTTP_CODE"

          if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
            echo "Blog generation request succeeded"
          else
            echo "Blog generation request failed with HTTP $HTTP_CODE"
            STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1)
            if echo "$STATUS" | grep -q '"skipped"'; then
              echo "Generation was skipped (expected behavior)"
              exit 0
            fi
            exit 1
          fi
```

Source: `.github/workflows/blog-autopost.yml` (existing, verified)

### Pattern 2: Cron Token Auth on Existing Endpoint

The endpoint at `POST /api/blog/generate` currently uses `requireAdmin`. To satisfy BLOG-02 without breaking admin UI manual generation, add a cron token check before the session guard:

```typescript
// In server/routes/blog.ts — POST /generate handler

router.post("/generate", async (req, res) => {
  // Check cron token first (allows GitHub Actions to call this endpoint)
  const cronToken = process.env.BLOG_CRON_TOKEN;
  const authHeader = req.headers.authorization;
  const providedToken = authHeader?.replace("Bearer ", "");

  if (cronToken && providedToken === cronToken) {
    // Cron-authenticated path — skip admin session check
    const { manual = false, autoPublish = false } = req.body || {};
    try {
      const result = await withColdStartDbRetry(() =>
        BlogGenerator.startDailyPostGeneration({ manual, autoPublish })
      );
      // ... existing response logic
    } catch (error: any) {
      // ... existing error handling
    }
    return;
  }

  // Fall through to admin session check for UI-triggered generation
  return requireAdmin(req, res, async () => {
    // ... existing admin handler body
  });
});
```

**Alternative (simpler, no restructure):** Make `requireAdmin` tolerate cron token auth by checking the header inside `requireAdmin`. But that would bleed blog-specific logic into a generic auth utility. Better to keep the check local to the route.

### Pattern 3: Removing systemHeartbeats from Schema

```typescript
// shared/schema.ts — DELETE these lines:
// export const systemHeartbeats = pgTable("system_heartbeats", { ... });
// export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
```

Then create a Supabase migration:

```sql
-- supabase/migrations/20260514000000_remove_system_heartbeats.sql
DROP TABLE IF EXISTS public.system_heartbeats;
```

Use `IF EXISTS` because the table was never added via Supabase CLI migrations — it may not exist in the live DB.

### Pattern 4: Supabase Migration Naming

Existing migration timestamps follow `YYYYMMDDHHMMSS` or `YYYYMMDD000000` format. The next sequential slot after `20260512000000` is `20260514000000` (using today's date: 2026-05-11, but next available is 20260514000000 — check the actual latest to confirm). Actually the latest is `20260512000000_add_calendar_sync_queue.sql` so use `20260513000000`.

Apply via:
```bash
supabase db push
```
Never use `drizzle-kit push` (per MEMORY.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Cron scheduling | Custom HTTP polling loop | GitHub Actions `schedule:` |
| Bearer token extraction | Custom header parsing | Standard `req.headers.authorization?.replace("Bearer ", "")` |
| DB migration | `drizzle-kit push` | Supabase CLI `supabase db push` |

## Runtime State Inventory

> Included because this is a remove/cleanup phase.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `system_heartbeats` table in Supabase DB (may or may not exist — never migrated via Supabase CLI) | DROP TABLE IF EXISTS in new Supabase migration |
| Live service config | `blog-autopost.yml` runs hourly via GH Actions schedule | Replaced by `blog-cron.yml` (daily 09:00 UTC); old workflow deleted |
| OS-registered state | None | None |
| Secrets/env vars | `CRON_SECRET` used by blog-autopost.yml; `BLOG_CRON_TOKEN` is new and not yet set | Add `BLOG_CRON_TOKEN` to GitHub repo secrets; `CRON_SECRET` remains for other workflows |
| Build artifacts | `api/index.js` compiled bundle contains `system_heartbeats` string | Regenerated on next `npm run build` — no manual action |

**Key note on CRON_SECRET vs BLOG_CRON_TOKEN:** The existing cron workflows (email reminders, calendar sync, recurring bookings) all use the shared `CRON_SECRET`. The new blog workflow uses a dedicated `BLOG_CRON_TOKEN`. Both secrets will coexist in GitHub secrets. BLOG_CRON_TOKEN must be added to the repo before the new workflow is active.

**Key note on old workflow:** `blog-autopost.yml` must be deleted (or replaced) when `blog-cron.yml` is created. If both exist simultaneously, blog generation will fire hourly (old) AND daily at 09:00 (new), double-spending on OpenRouter.

## Common Pitfalls

### Pitfall 1: Double Blog Generation if Old Workflow Not Deleted
**What goes wrong:** `blog-autopost.yml` runs hourly. If `blog-cron.yml` is added without removing the old file, both run concurrently.
**Why it happens:** GH Actions runs all `.yml` files in `.github/workflows/` that have a matching schedule.
**How to avoid:** Delete `blog-autopost.yml` in the same commit that adds `blog-cron.yml`. Never create the new file without removing the old one.
**Warning signs:** Two workflow runs on the Actions tab per day, duplicate blog posts.

### Pitfall 2: Endpoint Path Mismatch
**What goes wrong:** The new workflow calls `/api/blog/generate` but BLOG_CRON_TOKEN auth is only added to `/api/blog/cron/generate`.
**Why it happens:** The existing cron endpoint is at `POST /api/blog/cron/generate` not `/api/blog/generate`.
**How to avoid:** Add the BLOG_CRON_TOKEN auth check to the `router.post("/generate", ...)` handler — the one currently using `requireAdmin`.

### Pitfall 3: Breaking Admin Manual Generation
**What goes wrong:** Replacing `requireAdmin` entirely on `/generate` breaks the admin UI trigger.
**Why it happens:** Admin panel calls `POST /api/blog/generate` using admin session cookie, not a bearer token.
**How to avoid:** Use a dual-auth pattern — check cron token first, then fall through to `requireAdmin`.

### Pitfall 4: DROP TABLE Fails if Table Never Existed
**What goes wrong:** `DROP TABLE system_heartbeats` errors if the table was never created in the live DB (the Drizzle migration in `migrations/` was never run via Supabase CLI).
**Why it happens:** `migrations/0013_system_heartbeats.sql` is a legacy Drizzle file, not a Supabase migration.
**How to avoid:** Always use `DROP TABLE IF EXISTS public.system_heartbeats`.

### Pitfall 5: Forgetting to Add BLOG_CRON_TOKEN to GitHub Secrets
**What goes wrong:** Workflow runs but gets 401 from the endpoint because `BLOG_CRON_TOKEN` env var is empty.
**Why it happens:** GitHub secrets must be added manually in the repo settings UI.
**How to avoid:** Treat this as a human action step in the plan. The workflow can be committed, but the first run will fail until the secret is set.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| GitHub Actions | BLOG-01 (workflow) | Already in use | N/A | None needed |
| Supabase CLI | BLOG-04 (migration) | Yes (used in Phase 32) | Current | None — required |
| `CRON_SECRET` GH secret | Existing workflows | Already set | N/A | N/A |
| `APP_URL` GH variable | All cron workflows | Already set | N/A | N/A |
| `BLOG_CRON_TOKEN` GH secret | BLOG-01, BLOG-02 | NOT YET SET | N/A | Human action required |

**Missing dependencies with no fallback:**
- `BLOG_CRON_TOKEN` GitHub secret — must be added manually in repo Settings > Secrets and variables > Actions before the workflow's first run will succeed. This is a human action step, not code.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No automated test framework detected in this project |
| Config file | None |
| Quick run command | `npm run check` (TypeScript type check) |
| Full suite command | `npm run build` (build validation) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLOG-01 | Workflow file exists with correct trigger and endpoint | Manual verification | `cat .github/workflows/blog-cron.yml` | Created in Wave 1 |
| BLOG-02 | POST /api/blog/generate returns 401 without valid token | Manual curl test | `curl -X POST http://localhost:5000/api/blog/generate` → expect 401 | Code change in Wave 1 |
| BLOG-03 | vercel.json has no cron entry | Manual verification | `cat vercel.json \| grep cron` → expect no output | Already absent |
| BLOG-04 | systemHeartbeats removed from TypeScript and DB | Type check + migration | `npm run check` → no SystemHeartbeat types; `supabase db push` | Code change + migration |

### Wave 0 Gaps
- No new test files required — this phase has no testable business logic (cron auth is verified manually via curl or workflow_dispatch)
- TypeScript compilation (`npm run check`) serves as the primary automated gate for schema changes

## Code Examples

### Auth dual-path pattern in blog route

```typescript
// Source: Derived from existing pattern in server/routes/blog.ts:225
// and server/routes/booking-email-reminders.ts (same CRON_SECRET pattern)

router.post("/generate", async (req, res) => {
  const cronToken = process.env.BLOG_CRON_TOKEN;
  const authHeader = req.headers.authorization;
  const providedToken = authHeader?.replace("Bearer ", "");

  // Cron token path (GitHub Actions)
  if (cronToken && providedToken === cronToken) {
    try {
      const result = await withColdStartDbRetry(() =>
        BlogGenerator.startDailyPostGeneration({ manual: false })
      );
      if (result.skipped) return res.json({ status: "skipped", reason: result.reason });
      if (result.success) return res.json({ status: "generated", postId: result.post?.id });
      return res.status(500).json({ status: "failed", error: result.error });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Generation failed" });
    }
  }

  // Admin session path (UI manual trigger) — falls through to existing handler
  if (!cronToken && providedToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // No token provided — require admin session
  return requireAdmin(req, res, async () => {
    /* existing admin handler body */
  });
});
```

### Schema removal

```typescript
// shared/schema.ts — remove these two blocks:

// DELETE:
export const systemHeartbeats = pgTable("system_heartbeats", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().default("vercel-cron"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// DELETE:
export type SystemHeartbeat = typeof systemHeartbeats.$inferSelect;
```

### Supabase migration

```sql
-- supabase/migrations/20260513000000_remove_system_heartbeats.sql
DROP TABLE IF EXISTS public.system_heartbeats;
```

## Open Questions

1. **Should `/api/blog/cron/generate` be kept or removed?**
   - What we know: Requirements specify `/api/blog/generate`. The existing cron endpoint at `/cron/generate` is called only by `blog-autopost.yml` (which is being replaced).
   - What's unclear: Is there any other caller (e.g., old Vercel cron, external tooling)?
   - Recommendation: Delete `blog-autopost.yml` and keep `/cron/generate` temporarily during transition, or remove it in the same wave. Since it uses `CRON_SECRET` (shared secret) rather than the new `BLOG_CRON_TOKEN`, removing it is safe and reduces surface area. **Recommend removing the `/cron/generate` handler** in the same plan wave that adds BLOG_CRON_TOKEN auth to `/generate`.

2. **Should BLOG_CRON_TOKEN be a separate value from CRON_SECRET?**
   - What we know: Requirements specify `BLOG_CRON_TOKEN`. SEED-009 also specifies it as a dedicated secret to isolate blog OpenRouter costs from other cron endpoints.
   - What's unclear: Whether the project owner has already set this secret.
   - Recommendation: Treat as a human action prerequisite. Document clearly in the plan.

## Sources

### Primary (HIGH confidence)
- `.github/workflows/blog-autopost.yml` — existing workflow (direct template, verified)
- `.github/workflows/booking-email-reminders-cron.yml` — established pattern (verified)
- `.github/workflows/calendar-sync-cron.yml` — established pattern (verified)
- `server/routes/blog.ts` — both relevant endpoint handlers (verified)
- `shared/schema.ts:403` — systemHeartbeats table definition (verified)
- `server/storage.ts` — confirmed: no systemHeartbeats import (verified)
- `vercel.json` — confirmed: no crons key present (verified)

### Secondary (MEDIUM confidence)
- `migrations/0013_system_heartbeats.sql` — legacy Drizzle migration (verified exists, not a Supabase migration)
- `.planning/STATE.md` — BLOG_CRON_TOKEN prerequisite note (project-authored, authoritative)
- `.planning/seeds/SEED-009-self-hosted-blog-cron.md` — original design intent (verified)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — all files read directly from source
- Standard stack: HIGH — no new dependencies, existing patterns reused
- Architecture: HIGH — dual-auth pattern is straightforward; Supabase migration pattern is established
- Pitfalls: HIGH — derived from direct code inspection

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable domain — no fast-moving dependencies)
