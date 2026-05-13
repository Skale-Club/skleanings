---
gsd_state_version: 1.0
milestone: v8.0
milestone_name: Multi-Tenant Architecture
status: executing
stopped_at: Completed 41-infra-config-01-PLAN.md
last_updated: "2026-05-13T23:22:22.864Z"
last_activity: 2026-05-13
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 16
  completed_plans: 15
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-13)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 41 — Infra Config

## Current Position

Phase: 41 (Infra Config) — EXECUTING
Plan: 2 of 2
Status: Ready to execute
Last activity: 2026-05-13

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

See: .planning/MILESTONES.md

## v8.0 Phases

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 38 | Schema Foundation | MT-01, MT-02, MT-03, MT-04, MT-05 | Not started |
| 39 | Storage Refactor | MT-06, MT-07, MT-08 | Not started |
| 40 | Tenant Resolution Middleware | MT-09, MT-10, MT-11, MT-12, MT-13 | Not started |
| 41 | Infra Config | MT-14, MT-15, MT-16, MT-17 | Not started |

## Pending Items

- **Phase 19 UAT** — 5 human browser checks in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md`
- **Phase 35** — `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets

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

### Roadmap Evolution

- v7.0 phases 36–37 derived from SEED-011 (locale settings) and SEED-015 (super-admin panel)
- v8.0 phases 38–41 derived from MT-01–17 (multi-tenant architecture)
- Phase numbering continues from v7.0 last phase (37)
- Phase 38 migration must be idempotent — 38 business tables need tenantId DEFAULT 1

### Blockers/Concerns

- **MIGRATION PENDING** — Phase 35 requires `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- Phase 38 migration scope is large (38 tables) — must be written as a single idempotent Supabase CLI migration
- Super-admin routes (/api/super-admin/*) must be explicitly excluded from Phase 40 tenant resolution

## Session Continuity

Last session: 2026-05-13T23:22:22.859Z
Stopped at: Completed 41-infra-config-01-PLAN.md
Resume file: None
Next: Phase 39 complete — ready for Phase 40 (Tenant Resolution Middleware)
