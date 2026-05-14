---
gsd_state_version: 1.0
milestone: v11.0
milestone_name: Password Reset
status: executing
stopped_at: Completed 47-01-PLAN.md
last_updated: "2026-05-14T13:39:01.594Z"
last_activity: 2026-05-14
progress:
  total_phases: 12
  completed_phases: 11
  total_plans: 30
  completed_plans: 28
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 47 — Password Reset

## Current Position

Phase: 47 (Password Reset) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-05-14

Progress: [----------] 0%

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
| v9.0 Tenant Onboarding | 42–44 (3 phases) | 8 | 2026-05-14 |
| v10.0 Tenant Admin Auth | 45–46 (2 phases) | 3 | 2026-05-14 |

See: .planning/MILESTONES.md

## v11.0 Phases

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 47 | Password Reset | PR-01, PR-02, PR-03, PR-04, PR-05, PR-06 | Not started |

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
- [Phase 43]: password column is nullable — OAuth-only users never have a password; only provisioned tenant admins do
- [Phase 43]: provisionTenantAdmin uses db.transaction directly (not this.tenantId) — global registry operation, cross-tenant by design
- [Phase 43-02]: hostnameCache stays module-private — only invalidateTenantCache wrapper exported for encapsulation
- [Phase 43-02]: POST /provision returns plaintext password once in response body — never stored after that single response
- [Phase 43-03]: provision.reset() on dialog close unconditionally wipes password from state — not just on success — any close guarantees credentials gone
- [Phase 43-03]: ProvisionDialog defined as top-level component (not inside TenantsSection) to avoid re-creation on parent renders
- [Phase 44]: 503 check placed after hostnameCache.set — single guard covers both cache-hit and DB-hit paths in resolveTenantMiddleware
- [Phase 44]: Stats aggregation: groupBy aggregates in Promise.all + lookup maps avoids N+1 per-tenant queries in GET /tenants
- [Phase 44-02]: Three stat columns inserted after Primary Domain and before Created — preserves existing column order without restructuring
- [Phase 45-01]: adminUser.tenantId is optional — legacy env-var sessions pass cross-tenant guard unchanged
- [Phase 45-01]: requireAdmin session fast-path placed BEFORE Supabase JWT path — session-authed tenants never hit JWT validation
- [Phase 45]: logout route uses req.session.destroy callback unconditionally — safe even when session already expired
- [Phase 46]: useAdminAuth kept in Admin.tsx only for getAccessToken — CalendarReconnectBanner still needs Supabase access token
- [Phase 46]: AdminTenantAuthProvider nested inside AuthProvider — customer Supabase auth and admin session auth coexist independently
- [Phase 47-01]: password_reset_tokens has no tenant_id column — user_id FK is sufficient scope for token lookup
- [Phase 47-01]: findPasswordResetToken is NOT tenant-scoped; updateUserPassword IS tenant-scoped to prevent cross-tenant writes

### Roadmap Evolution

- v7.0 phases 36–37 derived from SEED-011 (locale settings) and SEED-015 (super-admin panel)
- v8.0 phases 38–41 derived from MT-01–17 (multi-tenant architecture)
- v9.0 phases 42–44 derived from TO-01–10 (tenant onboarding)
- v10.0 phases 45–46 derived from TA-01–09 (tenant admin auth)
- v11.0 phase 47 derived from PR-01–06 (password reset) — single-phase milestone
- Phase numbering continues from v10.0 last phase (46); v11.0 starts at Phase 47
- Phase 47 adds password_reset_tokens table (new Supabase migration), two new API endpoints (forgot-password, reset-password), change-password for logged-in admins, and /reset-password frontend page
- forgot-password always returns 200 regardless of email existence — prevents email enumeration

### Blockers/Concerns

- **MIGRATION PENDING** — Phase 35 requires `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **MIGRATION PENDING** — Phase 38 requires `supabase db push` for multi-tenant schema
- Phase 47 requires new `password_reset_tokens` table migration via Supabase CLI

## Session Continuity

Last session: 2026-05-14T13:39:01.589Z
Stopped at: Completed 47-01-PLAN.md
Resume file: None
Next: Plan Phase 47 (Password Reset) via /gsd:plan-phase 47
