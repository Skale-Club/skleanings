---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Completed 66-01-PLAN.md
last_updated: "2026-05-15T17:40:03.665Z"
last_activity: 2026-05-15
progress:
  total_phases: 31
  completed_phases: 31
  total_plans: 75
  completed_plans: 75
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-15)

**Core value:** Customers can discover, book, and pay for cleaning services online without calling — and the business can manage everything from one admin panel.
**Current focus:** Phase 66 — Payments Dashboard UI

## Current Position

Phase: 66
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-05-15

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
| v16.0 Staff Invitation Flow | 57–58 (2 phases) | 5 | 2026-05-15 |
| v17.0 Plan Tiers | 59–60 (2 phases) | 5 | 2026-05-15 |
| v18.0 Custom Domain Routing | 61–62 (2 phases) | 5 | 2026-05-15 |
| v19.0 Stripe Connect Onboarding | 63–64 (2 phases) | 5 | 2026-05-15 |

See: .planning/MILESTONES.md

## v20.0 Phases

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 65 | Connect-Aware Checkout + Webhook Routing | PF-01, PF-02, PF-03, PF-04, PF-05, PF-06 | Not started |
| 66 | Payments Dashboard UI | PF-07, PF-08 | Not started |

## Pending Items

- **Phase 19 UAT** — 5 human browser checks in `.planning/phases/19-receptionist-booking-flow-multi-staff-view/19-HUMAN-UAT.md`
- **Phase 35** — `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **Phase 38** — `supabase db push` for multi-tenant schema migrations
- **Phase 47** — `supabase db push` for password_reset_tokens table migration
- **Phase 48** — `STRIPE_SAAS_PRICE_ID` env var (legacy single-plan; superseded by 3 tier-specific vars in v17.0)
- **Phase 59 (v17.0)** — `supabase db push` for `tenant_subscriptions.plan_tier` migration
- **Phase 59 (v17.0)** — Three new env vars: `STRIPE_SAAS_PRICE_ID_BASIC`, `STRIPE_SAAS_PRICE_ID_PRO`, `STRIPE_SAAS_PRICE_ID_ENTERPRISE` must be added to `.env` and Stripe Dashboard must have matching Price IDs
- **Phase 61 (v18.0)** — `supabase db push` will be required for `domains.verified / verifiedAt / verificationToken` migration; existing primary domains should be backfilled to `verified = true`
- **Phase 61 (v18.0)** — Caddy on-demand TLS configuration must be enabled in `infra/Caddyfile` so custom domains receive auto-issued certificates after DNS verification
- **Phase 63 (v19.0)** — `supabase db push` for `tenant_stripe_accounts` table migration
- **Phase 63 (v19.0)** — `STRIPE_CONNECT_CLIENT_ID` and Stripe Connect platform configuration (Express accounts enabled) must exist in the Stripe Dashboard before onboarding can succeed
- **Phase 63 (v19.0)** — Stripe webhook endpoint must be configured to deliver `account.updated` and `account.application.deauthorized` events (in addition to existing billing events)
- **Phase 65 (v20.0)** — `supabase db push` for `bookings.platform_fee_amount` + `bookings.tenant_net_amount` columns migration
- **Phase 65 (v20.0)** — Two new env vars: `STRIPE_PLATFORM_FEE_PERCENT` (default 5) and `STRIPE_WEBHOOK_SECRET_CONNECT` must be added to `.env`
- **Phase 65 (v20.0)** — Stripe Dashboard Connect webhook endpoint must be configured to deliver `checkout.session.completed` events at the platform level (separate from the per-tenant webhook used by legacy flow)

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
- [Phase 57-staff-invitation-backend]: Phase 57-01: staff_invitations uses global-registry pattern (tenant_id FK, db direct queries) so accept-invite can resolve cross-tenant tokens; tokenHash not .unique() (256-bit randomness sufficient); hard-delete on revoke
- [Phase 57-03]: validate-invite + accept-invite: atomic db.transaction creates users + user_tenants; markInvitationAccepted called AFTER tx commit so invitations only mark used when user actually exists; cross-tenant companyName fallback via direct db query on companySettings when storage scope mismatches invitation.tenantId; adminUrl resolved from domains.isPrimary inside the transaction
- [Phase 58-staff-invitation-frontend]: Phase 58-01: AcceptInvite.tsx uses single 'status' union (loading|invalid|ready|submitting); reads token via URLSearchParams to mirror VerifyEmail.tsx; mounted in public Switch outside AdminTenantAuthProvider so accept-invite skips /api/auth/admin-me preflight
- [Phase 59]: [Phase 59-01]: tenant_subscriptions.plan_tier uses TEXT + CHECK constraint (not pgEnum) matching Phase 48 status column pattern; allows forward compat
- [Phase 59]: [Phase 59-01]: stripe-plans helpers read process.env at call-time (not module load) for test friendliness; empty-string priceId guard prevents false matches against unset env vars
- [Phase 59]: [Phase 59-01]: IStorage.upsertTenantSubscription signature unchanged — Partial<Omit<InsertTenantSubscription>> auto-widens to include planTier? once Drizzle table gains column (verified via npm run check)
- [Phase 59]: Phase 59-02: Used Record<PlanTier, FeatureLimits> over  to enforce exhaustive tier coverage without over-narrowing numeric literals.
- [Phase 59]: [Phase 59-03]: Webhook reverse-lookup uses conditional spread (...newTier ? { planTier: newTier } : {}) to avoid overwriting valid planTier with null on unrecognized priceIds; warn-log surfaces the unrecognized priceId for operator debugging
- [Phase 59]: [Phase 59-03]: PATCH /super-admin/tenants/:id/plan does NOT auto-subscribe; returns 404 when stripeSubscriptionId missing, pointing operator to POST /subscribe — keeps responsibilities split (subscribe = create, plan = change)
- [Phase 59]: [Phase 59-03]: PATCH endpoint uses optimistic DB write (planTier + planId) + webhook reconciliation; both paths converge idempotently via where(tenant_id) filter, giving super-admin UI immediate feedback without waiting for Stripe webhook
- [Phase 60]: Default unrecognized/null planTier to 'basic' server-side so the UI always renders a tier badge + features list (defensive fallback in GET /api/billing/status)
- [Phase 61]: verifiedAt uses TIMESTAMPTZ withTimezone to match migration; no verification_token index since lookups always scope by (id,tenantId); getDomainsForTenant added alongside getTenantDomains for tenant-admin vs super-admin semantic split
- [Phase 63-stripe-connect-backend]: Phase 63 storage getters return | null (not | undefined) for unambiguous absence semantics in downstream Connect webhooks
- [Phase 63-stripe-connect-backend]: updateTenantStripeAccount uses inline Partial<{chargesEnabled;payoutsEnabled;detailsSubmitted}> shape to prevent callers from mutating identity columns
- [Phase 63-stripe-connect-backend]: Persist Stripe accountId BEFORE generating AccountLink in onboard endpoint — prevents orphaned Stripe accounts when AccountLink request fails
- [Phase 63-stripe-connect-backend]: /stripe/status returns 200/connected:false vs /stripe/refresh returns 404 when no row — semantic split between UI state probe and explicit rehydrate action
- [Phase 64-stripe-connect-frontend]: Stripe Connect onboard URL handoff pattern: POST returns { url }, client sets window.location.href to redirect to Stripe-hosted onboarding
- [Phase 64-stripe-connect-frontend]: Mount-time URL param handler with window.history.replaceState prevents re-fire on remount for ?status=success return-from-Stripe UX
- [Phase 65]: Discriminated 4-kind union (connect/legacy/connect-incomplete/none) chosen over nullable result so compiler enforces PF-03 connect-incomplete handling at every call site
- [Phase 65]: Connect path takes precedence over legacy when a tenant has both — auto-migrates tenants who complete Connect onboarding without explicit cleanup of legacy integrationSettings.stripe rows
- [Phase 65]: Keep none and connect-incomplete as separate switch branches (different HTTP codes and remediation messages)
- [Phase 65]: Recompute totalCents from lineItems (source of truth) instead of validatedData.totalPrice (string/number coercion risk)
- [Phase 66-payments-dashboard-ui]: Recent Payments admin UI co-located types and formatCents helper inside PaymentsSection.tsx; multi-key invalidation pattern (Refresh Status invalidates both stripe/status and payments/recent)
- [Phase 66-payments-dashboard-ui]: paidAt uses bookings.createdAt as proxy (no paid_at column); correlated subquery for first booking_items.serviceName

### Roadmap Evolution

- v15.0 phases 55–56 derived from OB-01–08 (tenant onboarding experience)
- Phase 55 delivers email verification token flow (Resend) + welcome email + admin verification banner
- Phase 56 delivers setup checklist card in /admin dashboard with live DB checks + dismiss persistence
- v16.0 phases 57–58 derived from SF-01–07 (staff invitation flow)
- Phase 57 delivers staff_invitations table + IStorage methods + buildInviteEmail() + 3 API endpoints (invite, validate-invite, accept-invite, revoke)
- Phase 58 delivers /accept-invite public page + pending invitations section in /admin/staff with Invite button/dialog
- v17.0 phases 59–60 derived from PT-01–07 (plan tiers)
- Phase 59 delivers planTier column + 3 tier-specific Stripe Price ID env vars + feature catalog/`tenantHasFeature()` helper + webhook reverse-lookup mapping + `PATCH /api/super-admin/tenants/:id/plan` endpoint
- Phase 60 delivers `features` field on `GET /api/billing/status` + tier badge & feature list on `/admin/billing` + tier badge & Select dropdown column in super-admin Tenants table
- v18.0 phases 61–62 derived from CD-01–09 (custom domain routing)
- Phase 61 delivers `domains` schema extension (verified / verifiedAt / verificationToken) + IStorage methods (addDomainWithVerification, verifyDomain, removeDomain extended, getDomainsForTenant) + admin domain routes (POST add, POST verify, DELETE, GET list) + resolveTenantMiddleware verification gate + DNS TXT lookup via dns.promises.resolveTxt
- Phase 62 delivers `/admin/settings/domains` page (list + Add dialog + Verify + Remove) with DNS instructions panel showing exact TXT record + super-admin Tenants ManageDomainsDialog extended with verification status
- v19.0 phases 63–64 derived from SC-01–07 (Stripe Connect onboarding)
- Phase 63 delivers `tenant_stripe_accounts` table + Drizzle schema + IStorage methods (createTenantStripeAccount, getTenantStripeAccount, updateTenantStripeAccount, deleteTenantStripeAccount) + `server/routes/admin-stripe-connect.ts` (POST /onboard, GET /status, POST /refresh) + webhook handler extension for `account.updated` + `account.application.deauthorized` events
- Phase 64 delivers `/admin/payments` page (status card + Connect/Continue Onboarding + Refresh) + Admin.tsx sidebar Payments entry (Wallet icon) + super-admin Tenants table Connect Status column
- v20.0 phases 65–66 derived from PF-01–08 (Connect payment routing)
- Phase 65 delivers `bookings.platform_fee_amount` + `bookings.tenant_net_amount` columns (Supabase migration + Drizzle) + `server/lib/stripe.ts` `getStripeContextForTenant(tenant, storage)` helper returning `{ stripe, stripeAccount?, useConnect }` + Connect-aware `POST /api/payments/checkout` (legacy fallback when no Connect row, 402 guard when Connect row has `chargesEnabled = false`, `application_fee_amount` from `STRIPE_PLATFORM_FEE_PERCENT`) + webhook handler routing Connect events via `STRIPE_WEBHOOK_SECRET_CONNECT` and `event.account` + `checkout.session.completed` populates fee/net columns from `payment_intent.application_fee_amount`
- Phase 66 delivers `GET /api/admin/payments/recent` endpoint (last 20 paid bookings, requireAdmin) + Recent Payments table card below the Connect status card on `/admin/payments` with Date/Customer/Service/Total/Platform Fee/Net columns and empty state

### Blockers/Concerns

- **MIGRATION PENDING** — Phase 35 requires `supabase db push` (drop system_heartbeats) + add `BLOG_CRON_TOKEN` to GitHub Secrets
- **MIGRATION PENDING** — Phase 38 requires `supabase db push` for multi-tenant schema
- **MIGRATION PENDING** — Phase 47 requires `supabase db push` for password_reset_tokens table
- **ENV VAR NEEDED** — `STRIPE_SAAS_PRICE_ID` must be added to .env before Phase 48-02 (subscribe endpoint)
- **MIGRATION PENDING (v17.0)** — Phase 59 requires `supabase db push` to add `plan_tier` column to `tenant_subscriptions`
- **ENV VARS NEEDED (v17.0)** — `STRIPE_SAAS_PRICE_ID_BASIC`, `STRIPE_SAAS_PRICE_ID_PRO`, `STRIPE_SAAS_PRICE_ID_ENTERPRISE` must be set with valid Stripe Price IDs before webhook reverse-lookup can map subscriptions to tiers
- **MIGRATION PENDING (v18.0)** — Phase 61 requires `supabase db push` to add `verified / verifiedAt / verificationToken` columns to `domains`; existing primary domains must be backfilled to `verified = true` to avoid 404-ing live tenants
- **INFRA CHANGE (v18.0)** — Caddy on-demand TLS must be enabled in `infra/Caddyfile` so verified custom domains receive auto-issued Let's Encrypt certs on first request
- **MIGRATION PENDING (v19.0)** — Phase 63 requires `supabase db push` to create `tenant_stripe_accounts` table
- **STRIPE CONFIG (v19.0)** — Stripe Connect platform settings (Express accounts enabled, branding, redirect URLs) must be configured in the Stripe Dashboard before onboarding completes successfully
- **WEBHOOK CONFIG (v19.0)** — Existing Stripe webhook endpoint must be extended to deliver `account.updated` and `account.application.deauthorized` events alongside the billing events
- **MIGRATION PENDING (v20.0)** — Phase 65 requires `supabase db push` to add `platform_fee_amount` + `tenant_net_amount` INTEGER columns to `bookings`
- **ENV VARS NEEDED (v20.0)** — `STRIPE_PLATFORM_FEE_PERCENT` (default 5) and `STRIPE_WEBHOOK_SECRET_CONNECT` must be added to `.env`; Stripe Dashboard Connect webhook endpoint must deliver `checkout.session.completed` events at the platform level

## Session Continuity

Last session: 2026-05-15T17:36:55.500Z
Stopped at: Completed 66-01-PLAN.md
Resume file: None
Next: Plan Phase 65 (Connect-Aware Checkout + Webhook Routing) via /gsd:plan-phase 65
