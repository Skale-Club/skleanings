---
id: SEED-013
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when starting the Xkedule SaaS model (Skleanings becomes the first tenant of Xkedule)
scope: Large
---

# SEED-013: Multi-tenant architecture (data isolation between tenants)

## Why This Matters

Today white-label works per separate deploy — each tenant has their own app instance and their own database. This doesn't scale as SaaS: each new client requires a new deploy, new database, new infra. For a real SaaS model, multiple tenants must share the same infra with complete data isolation.

The reference pattern is the `skaleclub-websites` project (see `xkedule_architecture_reference.md` memory): single Express instance, `tenant_id` on every business table, hostname-based tenant resolution, `DatabaseStorage.forTenant()` storage layer pattern.

**Why:** Without multi-tenancy, infra cost per tenant is high and onboarding new clients is manual. With multi-tenancy, a single deploy serves N tenants — marginal cost per new client approaches zero. Xkedule is the SaaS product; Skleanings is just the first tenant.

## When to Surface

**Trigger:** when signing the second paying tenant (because that's when the problem of manually scaling deploys becomes real), or when starting a SaaS/platform milestone.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule SaaS / multi-client platform milestone
- Growth milestone (scaling to 5+ tenants)
- Post-SEED-015 milestone (super-admin panel)

## Scope Estimate

**Large** — A high-complexity milestone. Adopt the `skaleclub-websites` proven pattern:

1. **Schema:** Add `tenants`, `domains`, `userTenants` tables (copy structure from skaleclub-websites). Add `tenantId NOT NULL` column to ALL business tables.
2. **Storage layer:** Refactor `DatabaseStorage` to `.forTenant(id)` pattern — every query auto-filters by tenantId.
3. **Middleware:** `resolveTenantMiddleware` (reads `X-Forwarded-Host`, looks up in `domains` table, attaches `res.locals.tenant` + `res.locals.storage`) + `requireTenantMiddleware`.
4. **Infra migration:** Vercel → Hetzner CX23 VM + Caddy + Cloudflare (long-running processes, per-tenant custom domains).
5. **LRU cache:** 500 entries, 5min TTL for tenant resolution to avoid hitting DB on every request.
6. **Data migration:** All existing Skleanings data gets `tenantId = 1` (Skleanings is tenant #1).

## Breadcrumbs

- Reference: `C:\Users\Vanildo\Dev\skaleclub-websites` — production pattern with 50+ tenants
- `shared/schema.ts` — ALL tables need `tenantId` column
- `server/storage.ts` — refactor to `.forTenant(id)` pattern
- `server/middleware/` — new files for tenant resolution
- `vercel.json` — to be removed after Hetzner migration
- New: `infra/Caddyfile`, `infra/app.service` (systemd unit), `.github/workflows/deploy.yml`

## Notes

This is the biggest architectural change in the project. Should not be done until there's real demand for multiple tenants — the migration cost is high. When the moment comes, do a long feature-branch and migrate table by table with tests before merging. SEED-015 (super-admin) must exist BEFORE starting — the super-admin is needed to manage multiple tenants.

The `skaleclub-websites` is a CMS for service businesses (different product). Don't try to merge — Xkedule is a separate platform that copies the architectural PATTERN, not the code directly. Domain-specific business logic (booking, staff, calendar, Stripe) comes from Skleanings; multi-tenancy plumbing comes from skaleclub-websites.
