---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Tenant Onboarding
status: executing
stopped_at: Completed 42-03-PLAN.md
last_updated: "2026-05-14T00:52:15.166Z"
last_activity: 2026-05-14
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 19
  completed_plans: 19
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-13)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 42 — Tenant Management UI

## Current Position

Phase: 42 (Tenant Management UI) — EXECUTING
Plan: 3 of 3
Status: Ready to execute
Last activity: 2026-05-14

Progress: [░░░░░░░░░░] 0%

## Shipped Milestones

| Milestone | Phases | Plans | Shipped |
|-----------|--------|-------|---------|
| v1.0 Marketing Attribution | 10–14 (5 phases) | 15 | 2026-05-05 |
| v2.0 White Label | 15–19 (5 phases) | 15 | 2026-05-05 |
| v3.0 Calendar Polish | 20 (1 phase) | 4 | 2026-05-11 |
| v4.0 Booking Intelligence | 21–29 (9 phases) | 27 | 2026-05-11 |
| v5.0 Booking Experience | 30–32 (3 phases) | 9 | 2026-05-13 |
| v6.0 Platform Quality | 33–35 (3 phases) | 7 | 2026-05-13 |
| v7.0 Xkedule Foundation | 36–37 (2 phases) | 6 | 2026-05-13 |
| v8.0 Multi-Tenant Architecture | 38–41 (4 phases) | 10 | 2026-05-13 |

See: .planning/MILESTONES.md

## v9.0 Phases

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 42 | Tenant Management UI | TO-01, TO-02, TO-03, TO-04 | Not started |
| 43 | Tenant Provisioning | TO-05, TO-06, TO-07 | Not started |
| 44 | Isolation Verification | TO-08, TO-09, TO-10 | Not started |

## Pending Items

- **Phase 19 UAT** — 5 human browser checks in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md`
- **Phase 35** — `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **Phase 38** — `supabase db push` for multi-tenant schema migrations

## Accumulated Context

### Decisions

All milestone decisions logged in PROJECT.md Key Decisions table.

- [Phase 35-01]: Dual-auth pattern on /api/blog/generate: BLOG_CRON_TOKEN bearer checked first; invalid bearer returns 401 without leaking to admin session path
- [Phase 35-02]: Migration uses DROP TABLE IF EXISTS — system_heartbeats may not exist in live DB since it was only in legacy Drizzle migrations, not Supabase CLI migrations
- [Phase 34-component-split]: bookingFormSchema and BookingFormValues extracted to bookingSchema.ts as pure schema module preventing circular imports
- [Phase 32]: db.execute() returns RowList directly — use Array.from(result) not result.rows for raw SQL results in storage.ts
- [Phase 36-01]: Locale columns added after timeZone in companySettings pgTable following existing timeFormat/timeZone pattern
- [Phase 36-01]: CompanySettingsSection default state updated with locale defaults (en/sunday/MM-DD-YYYY) to satisfy TypeScript strict check
- [Phase 36-locale-settings]: Locale selects grouped under a labeled 'Locale' section heading within the existing General tab card — no new tab required
- [Phase 36-03]: Move dateFnsLocalizer into useMemo so weekStartsOn is reactive to companySettings changes without page reload
- [Phase 37]: TypeScript module augmentation for express-session SessionData (superAdmin field) instead of any casts
- [Phase 37]: patchConsoleError placed before registerRoutes in server/index.ts to capture all route-level errors
- [Phase 37-02]: Timing-safe login via Promise.all ensures bcrypt.compare always runs regardless of email match
- [Phase 37-02]: collectRuntimeEnvDiagnostics() reused in health check to avoid duplicating env validation logic
- [Phase 38-01]: user_tenants.user_id is text NOT NULL (not integer/uuid) because users.id is stored as text UUID string
- [Phase 38-01]: Business table tenant_id FKs omit ON DELETE (default RESTRICT); registry table FKs use ON DELETE CASCADE
- [Phase 38-01]: sessions table intentionally excluded from tenant_id scope (infra table, not tenant data)
- [Phase 38-01]: setval() in seed migration advances serial sequence past id=1 to prevent future auto-increment unique constraint violation
- [Phase 38-schema-foundation]: Drizzle forward references allow users.tenantId to reference tenants before its declaration — no file reordering needed
- [Phase 38-schema-foundation]: Custom select projections must explicitly list tenantId to satisfy TypeScript inferred types from schema
- [Phase 39-02]: getServiceAreaCities: unconditionally start conditions array with tenantId — removes the if-guard since tenantId is always present
- [Phase 39-02]: deleteService cascades: serviceAddons/serviceOptions tenant-scoped to prevent cross-tenant row deletion during soft-delete transaction
- [Phase 39-02]: deleteServiceAreaGroup city guard scoped to this.tenantId — a group with zero cities for this tenant deletes cleanly regardless of other tenant data
- [Phase 39-03]: upsertContact email uniqueness scoped per-tenant — contacts with same email in different tenants are distinct (cross-tenant collision fix)
- [Phase 39-03]: Raw SQL calendar sync methods use AND tenant_id = ${this.tenantId} in template literals — db.execute(sql`...`) bypasses Drizzle query builder
- [Phase 39-03]: contacts.email UNIQUE constraint is global not per-tenant — deferred to Phase 40+ to add composite (tenant_id, email) unique index
- [Phase 40]: Use req.hostname for LRU cache key to avoid port contamination; super-admin routes mounted before resolveTenantMiddleware for bypass
- [Phase 40-03]: Chat module DI: setChatDependencies called in /chat/message handler wrapper so chatDeps.storage is tenant-scoped per request via res.locals.storage!
- [Phase 41-infra-config]: DNS-01 via Cloudflare for wildcard TLS; direct Node systemd unit (Type=simple) over PM2 for CX23 simplicity
- [Phase 41]: deploy.yml uses workflow_dispatch only (no push trigger) per MT-16 — prevents accidental production deploys
- [Phase 41]: infra/README.md documents NodeSource apt install for Node.js (not nvm) — systemd ExecStart requires absolute /usr/bin/node path
- [Phase 42]: Global registry methods on DatabaseStorage use db directly (no this.tenantId) — registry ops are cross-tenant by design
- [Phase 42-01]: TenantRow/DomainRow type aliases derived via $inferSelect — no separate type definitions needed
- [Phase 42]: useSuperAdminTenants takes enabled boolean matching existing hook pattern
- [Phase 42]: ManageDomainsDialog driven by domainsTarget state (TenantListItem | null) — single state drives both open and which tenant

### Roadmap Evolution

- v7.0 phases 36–37 derived from SEED-011 (locale settings) and SEED-015 (super-admin panel)
- v8.0 phases 38–41 derived from MT-01–17 (multi-tenant architecture)
- v9.0 phases 42–44 derived from TO-01–10 (tenant onboarding)
- Phase numbering continues from v8.0 last phase (41); v9.0 starts at Phase 42
- Phase 42 extends existing /superadmin panel (Phase 37) — no new auth surface
- Phase 43 LRU cache invalidation: delete hostname key from lru-cache on domain add/remove in Phase 43, not rebuild middleware
- Phase 44 503 response: resolveTenantMiddleware already resolves tenant — add status check after resolution, before passing to next()

### Blockers/Concerns

- **MIGRATION PENDING** — Phase 35 requires `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **MIGRATION PENDING** — Phase 38 requires `supabase db push` for multi-tenant schema
- Phase 42 new /api/super-admin/* endpoints must be added under existing super-admin session auth guard (Phase 37 pattern)
- Phase 43 bcrypt password hashing for provisioned admin user — use same pattern as existing admin auth (ADMIN_PASSWORD_HASH)
- Phase 44 E2E isolation test requires a second tenant row in DB — provisioning from Phase 43 must complete first

## Session Continuity

Last session: 2026-05-14T00:52:15.162Z
Stopped at: Completed 42-03-PLAN.md
Resume file: None
Next: Plan Phase 42 (Tenant Management UI) via /gsd:plan-phase 42
