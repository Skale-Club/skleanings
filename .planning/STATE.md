---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: v14.0 roadmap created — Phase 53 is next
stopped_at: Completed 53-01-PLAN.md
last_updated: "2026-05-14T19:08:50.582Z"
last_activity: 2026-05-14
progress:
  total_phases: 19
  completed_phases: 17
  total_plans: 43
  completed_plans: 42
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 53 — Billing Email Notifications + Signup Rate Limit

## Current Position

Phase: 53
Plan: Not started
Status: v14.0 roadmap created — Phase 53 is next
Last activity: 2026-05-14

Progress: [          ] 0%

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
| v11.0 Password Reset | 47 (1 phase) | 3 | 2026-05-14 |
| v12.0 SaaS Billing | 48–50 (3 phases) | 7 | 2026-05-14 |
| v13.0 Self-Serve Signup | 51–52 (2 phases) | 4 | 2026-05-14 |

See: .planning/MILESTONES.md

## v14.0 Phases

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 53 | Billing Email Notifications + Signup Rate Limit | BH-01, BH-02, BH-03, BH-04 | Not started |
| 54 | Invoice History | BH-05, BH-06 | Not started |

## Pending Items

- **Phase 19 UAT** — 5 human browser checks in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md`
- **Phase 35** — `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **Phase 38** — `supabase db push` for multi-tenant schema migrations
- **Phase 47** — `supabase db push` for password_reset_tokens table migration
- **Phase 48** — New env var `STRIPE_SAAS_PRICE_ID` must be added to .env (Stripe price ID for the monthly SaaS plan)

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
- [Phase 47-02]: buildPasswordResetEmail is pure (no IStorage param) — caller fetches companyName and passes it in
- [Phase 47-02]: forgot-password swallows all errors in try/catch to prevent timing-based enumeration
- [Phase 47-02]: reset-password checks usedAt before expiresAt — used token rejected even within time window
- [Phase 47-03]: ForgotPassword always shows success state — mirrors backend no-enumeration policy at UX layer
- [Phase 47-03]: /reset-password is in public Switch — token links arrive via email with no session
- [Phase 48 arch]: SaaS billing is a separate Stripe flow from customer booking payments — both reuse STRIPE_SECRET_KEY but operate on different Stripe objects (B2B subscriptions vs. B2C payment intents)
- [Phase 48 arch]: POST /api/billing/webhook MUST be mounted before express.json() body-parser — raw body required for stripe.webhooks.constructEvent() signature verification
- [Phase 48 arch]: tenant_subscriptions is a global registry table (one row per tenant, no tenantId self-reference) — getTenantSubscription/upsertTenantSubscription use db directly, not this.tenantId
- [Phase 49 arch]: 402 enforcement placed after the existing 503 inactive-tenant guard in resolveTenantMiddleware; grace period: past_due AND currentPeriodEnd < now() - 3 days
- [Phase 50 arch]: POST /api/billing/portal is a tenant-facing route guarded by requireAdmin — reads tenant's stripeCustomerId from tenant_subscriptions then creates Stripe Billing Portal session
- [Phase 48-01]: tenant_subscriptions uses db directly (global registry pattern, not this.tenantId) — same as tenants/domains/passwordResetTokens
- [Phase 48-01]: stripe_subscription_id is nullable — Stripe customer created before subscription exists; status DEFAULT 'none' indicates no subscription state
- [Phase 48]: Stripe customer creation failure is non-fatal in POST /tenants — inner try/catch isolates Stripe from tenant 201 response
- [Phase 48]: Stripe SDK v21 dropped current_period_end from TS types — access via (stripeSub as any).current_period_end with null fallback
- [Phase 49]: 402 guard uses db directly in middleware — res.locals.storage does not exist yet when middleware runs
- [Phase 49]: No subRow in tenant_subscriptions means new tenant — passes through unblocked, matching 'none' status design from Phase 48-01
- [Phase 49]: billingRows fetches all subscription rows in single full-table scan; billingMap keyed by tenantId for O(1) lookup
- [Phase 50]: billingRouter mounted after resolveTenantMiddleware — res.locals.tenant and res.locals.storage populated for both billing routes
- [Phase 50]: billingWebhookHandler left unchanged — still mounted pre-body-parser in server/index.ts for raw body Stripe signature verification
- [Phase 50]: BillingPage is a standalone route at /admin/billing not embedded in Admin.tsx shell — sidebar click navigates via setLocation which matches the new Route in App.tsx
- [Phase 50]: Badge colors reused from SuperAdmin.tsx pattern (green/yellow/red/gray for active/trialing/past_due/canceled)
- [Phase 51]: signupTenant() is a global registry method (uses db directly, not this.tenantId) matching provisionTenantAdmin pattern
- [Phase 51]: signupRouter mounted at /api before resolveTenantMiddleware so signup is accessible without a tenant context
- [Phase 51]: Stripe subscription creation is non-fatal — tenant exists regardless of Stripe API availability
- [Phase 52]: Wrap /signup route with AdminTenantAuthProvider inline in public Switch so useAdminTenantAuth() works while preserving Navbar/Footer rendering
- [Phase 53]: BH-01/BH-02 email sends are inner try/catch blocks nested inside outer webhook try/catch — email failure is fully isolated, webhook always returns 200
- [Phase 53]: DatabaseStorage.forTenant() constructs tenant-scoped storage in webhook context where res.locals.storage is not available

### Roadmap Evolution

- v7.0 phases 36–37 derived from SEED-011 (locale settings) and SEED-015 (super-admin panel)
- v8.0 phases 38–41 derived from MT-01–17 (multi-tenant architecture)
- v9.0 phases 42–44 derived from TO-01–10 (tenant onboarding)
- v10.0 phases 45–46 derived from TA-01–09 (tenant admin auth)
- v11.0 phase 47 derived from PR-01–06 (password reset) — single-phase milestone
- v12.0 phases 48–50 derived from SB-01–08 (SaaS billing) — three phases: infra, enforcement, self-service
- Phase numbering continues from v13.0 last phase (52); v14.0 starts at Phase 53
- Phase 53 delivers billing email notifications (trial_will_end + past_due Resend emails) and signup rate limiting (express-rate-limit 5/hr per IP)
- Phase 54 delivers invoice history: GET /api/billing/invoices server endpoint + Invoice History table in /admin/billing

### Blockers/Concerns

- **MIGRATION PENDING** — Phase 35 requires `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **MIGRATION PENDING** — Phase 38 requires `supabase db push` for multi-tenant schema
- **MIGRATION PENDING** — Phase 47 requires `supabase db push` for password_reset_tokens table
- **ENV VAR NEEDED** — `STRIPE_SAAS_PRICE_ID` must be added to .env before Phase 48-02 (subscribe endpoint)

## Session Continuity

Last session: 2026-05-14T19:08:45.255Z
Stopped at: Completed 53-01-PLAN.md
Resume file: None
Next: Plan Phase 53 (Billing Email Notifications + Signup Rate Limit) via /gsd:plan-phase 53
