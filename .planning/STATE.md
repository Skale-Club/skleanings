---
gsd_state_version: 1.0
milestone: v16.0
milestone_name: Staff Invitation Flow
status: v16.0 roadmap created — Phase 57 is next
stopped_at: Roadmap created — no plans written yet
last_updated: "2026-05-14T00:00:00.000Z"
last_activity: 2026-05-14
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 57 — Staff Invitation Backend

## Current Position

Phase: 57
Plan: Not started
Status: v16.0 roadmap created — Phase 57 is next
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
| v14.0 Billing Hardening | 53–54 (2 phases) | 4 | 2026-05-14 |
| v15.0 Tenant Onboarding Experience | 55–56 (2 phases) | 5 | 2026-05-14 |

See: .planning/MILESTONES.md

## v16.0 Phases

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 57 | Staff Invitation Backend | SF-01, SF-02, SF-03, SF-04, SF-05 | Not started |
| 58 | Staff Invitation Frontend | SF-06, SF-07 | Not started |

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
- [Phase 37]: TypeScript module augmentation for express-session SessionData (superAdmin field) instead of any casts
- [Phase 38-01]: user_tenants.user_id is text NOT NULL (not integer/uuid) because users.id is stored as text UUID string
- [Phase 38-01]: sessions table intentionally excluded from tenant_id scope (infra table, not tenant data)
- [Phase 39-03]: upsertContact email uniqueness scoped per-tenant — contacts with same email in different tenants are distinct
- [Phase 40]: Use req.hostname for LRU cache key to avoid port contamination; super-admin routes mounted before resolveTenantMiddleware for bypass
- [Phase 41-infra-config]: DNS-01 via Cloudflare for wildcard TLS; direct Node systemd unit (Type=simple) over PM2 for CX23 simplicity
- [Phase 43]: password column is nullable — OAuth-only users never have a password; only provisioned tenant admins do
- [Phase 44]: 503 check placed after hostnameCache.set — single guard covers both cache-hit and DB-hit paths
- [Phase 45-01]: requireAdmin session fast-path placed BEFORE Supabase JWT path — session-authed tenants never hit JWT validation
- [Phase 47-02]: forgot-password swallows all errors in try/catch to prevent timing-based enumeration
- [Phase 47-02]: reset-password checks usedAt before expiresAt — used token rejected even within time window
- [Phase 48 arch]: POST /api/billing/webhook MUST be mounted before express.json() body-parser — raw body required for Stripe signature verification
- [Phase 48-01]: tenant_subscriptions uses db directly (global registry pattern, not this.tenantId)
- [Phase 49]: 402 guard uses db directly in middleware — res.locals.storage does not exist yet when middleware runs
- [Phase 51]: signupTenant() is a global registry method (uses db directly) matching provisionTenantAdmin pattern
- [Phase 53]: BH-01/BH-02 email sends are inner try/catch blocks — email failure is fully isolated, webhook always returns 200
- [Phase 53]: DatabaseStorage.forTenant() constructs tenant-scoped storage in webhook context where res.locals.storage is not available
- [Phase 54-01]: Return { invoices: [] } (not 404) when stripeCustomerId absent — consistent with /status pattern
- [Phase 55]: emailVerificationTokens mirrors passwordResetTokens pattern — no tenant_id, uses db directly
- [Phase 55]: createEmailVerificationToken returns raw token — only hash stored in DB
- [Phase 56]: setupDismissedAt has no default — null means not dismissed; GET /setup-status includes hidden services for admin count accuracy

### Roadmap Evolution

- v15.0 phases 55–56 derived from OB-01–08 (tenant onboarding experience)
- Phase 55 delivers email verification token flow (Resend) + welcome email + admin verification banner
- Phase 56 delivers setup checklist card in /admin dashboard with live DB checks + dismiss persistence
- v16.0 phases 57–58 derived from SF-01–07 (staff invitation flow)
- Phase 57 delivers staff_invitations table + IStorage methods + buildInviteEmail() + 3 API endpoints (invite, validate-invite, accept-invite, revoke)
- Phase 58 delivers /accept-invite public page + pending invitations section in /admin/staff with Invite button/dialog

### Blockers/Concerns

- **MIGRATION PENDING** — Phase 35 requires `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **MIGRATION PENDING** — Phase 38 requires `supabase db push` for multi-tenant schema
- **MIGRATION PENDING** — Phase 47 requires `supabase db push` for password_reset_tokens table
- **ENV VAR NEEDED** — `STRIPE_SAAS_PRICE_ID` must be added to .env before Phase 48-02 (subscribe endpoint)

## Session Continuity

Last session: 2026-05-14T00:00:00.000Z
Stopped at: v16.0 roadmap created
Resume file: None
Next: Plan Phase 57 (Staff Invitation Backend) via /gsd:plan-phase 57
