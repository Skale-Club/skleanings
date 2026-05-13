---
id: SEED-009
status: shipped
planted: 2026-05-10
last_revised: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when migrating to Xkedule (Hetzner — no Vercel Cron available)
scope: Small
---

# SEED-009: Blog generation cron via GitHub Actions (replace Vercel Cron)

## Why This Matters

Automatic blog post generation today depends on **Vercel Cron**, which only works while the app runs on Vercel. When Xkedule migrates to Hetzner + Caddy (the skaleclub-websites standard — see architecture memory), Vercel Cron ceases to exist.

The solution is **GitHub Actions with `schedule:` cron** triggering the `POST /api/blog/generate` endpoint via authenticated HTTP request. GH Actions is free for private repos (up to a limit), zero extra infra, and the schedule YAML is versioned in the repo itself.

**Why:** Migrating to Hetzner without replacing Vercel Cron means the blog stops generating posts on migration day. The replacement must be ready before DNS cutover.

## When to Surface

**Trigger:** when starting the Vercel-to-Hetzner migration (part of SEED-013 or a separate infra milestone). Before DNS cutover.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule infra milestone (Hetzner + Caddy)
- Deployment migration milestone

## Scope Estimate

**Small** — A few hours. Components:

1. **GitHub Actions workflow** `.github/workflows/blog-cron.yml`:
   ```yaml
   on:
     schedule:
       - cron: '0 9 * * *'  # 9am UTC daily
     workflow_dispatch:      # manual button on GitHub
   jobs:
     trigger-blog-generation:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -X POST https://xkedule.com/api/blog/generate \
               -H "Authorization: Bearer ${{ secrets.BLOG_CRON_TOKEN }}" \
               -H "X-Tenant-Id: ${{ matrix.tenant }}" \
               --fail
   ```

2. **Backend:**
   - `POST /api/blog/generate` endpoint authenticated by bearer token (BLOG_CRON_TOKEN)
   - For Xkedule multi-tenant: workflow iterates over tenants with `blogSettings.enabled = true` (via matrix strategy in GH Actions or via endpoint that processes all tenants)
   - Current lock mechanism (`blogGenerationJobs.lockedAt`) remains valid

3. **Removal:**
   - Remove `vercel.json` cron config
   - Remove `systemHeartbeats` table (keep-alive was for Vercel — not needed in GH Actions)

## Breadcrumbs

- `vercel.json` — current cron config
- `server/routes.ts` — `POST /api/blog/generate` endpoint
- `shared/schema.ts` — `blogGenerationJobs`, `systemHeartbeats` tables (remove the latter)
- Reference pattern: `.github/workflows/deploy.yml` from skaleclub-websites — secrets, authentication
- GH Actions cron: minimum interval is 5min (not 1min); daily blog generation is well within the limit

## Notes

**Why GH Actions instead of in-process node-cron:** When the app runs on multiple instances on Hetzner (PM2 cluster mode, or multiple pods), node-cron fires N times — once per instance. GH Actions guarantees exactly 1 execution per schedule.

**Authentication:** `BLOG_CRON_TOKEN` is a GitHub Actions secret and a server env var. Endpoint only accepts requests with that header. Without it, anyone could trigger blog generation (OpenRouter cost).

**For Xkedule multi-tenant:** one strategy is the endpoint receives tenantId and processes one at a time (workflow matrix with tenant list). Another is a tenant-less endpoint that internally iterates all tenants with blog enabled. Decide in planning based on volume.
