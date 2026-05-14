# Milestones

## v15.0 Tenant Onboarding Experience (Shipped: 2026-05-14)

**Phases completed:** 2 phases (55–56), 5 plans, all complete

**Key accomplishments:**

- `email_verification_tokens` Supabase migration + 4 IStorage methods + fire-and-forget verification + welcome email sends in `signup.ts`; `GET /api/auth/verify-email` server-side redirect route; `POST /api/auth/resend-verification` session-guarded
- `VerifyEmail.tsx` public error page + `/verify-email` App.tsx route; `admin-me` made async to return `emailVerifiedAt`; `AdminTenantAuthContext` extended with `emailVerifiedAt`; dismissible yellow banner in `Admin.tsx`
- `setup_dismissed_at` Supabase migration + `setupDismissedAt` on Drizzle `companySettings`; `server/routes/admin-setup.ts` with `GET /api/admin/setup-status` + `POST /api/admin/setup-dismiss` (both `requireAdmin`, `res.locals.storage` only)
- `useSetupStatus` React Query hook + `SetupChecklist.tsx` component (CheckCircle/Circle per live DB state, dismiss button, hides when all complete or dismissed) wired into `Admin.tsx` dashboard section

---

## v14.0 Billing Hardening (Shipped: 2026-05-14)

**Phases completed:** 2 phases (53–54), 4 plans, all complete

**Key accomplishments:**

- `customer.subscription.trial_will_end` and `customer.subscription.updated` (past_due) webhook cases extended with non-fatal Resend email sends — branded HTML using `sendResendEmail()` with company name from `companySettings` and Billing Portal URL CTA
- `POST /api/auth/signup` protected with `express-rate-limit` — 5 requests per IP per hour, 429 + RFC 6585 `Retry-After` header
- `GET /api/billing/invoices` (guarded by `requireAdmin`) — fetches last 10 Stripe invoices via `stripe.invoices.list`, maps to `{ id, date, amount, currency, status, invoiceUrl }`, returns `[]` gracefully when no Stripe customer
- Invoice History card in `BillingPage.tsx` — React Query fetch, 3-row Skeleton loading state, empty state, Table with date/amount/status Badge/Download anchor

---

## v13.0 Self-Serve Signup (Shipped: 2026-05-14)

**Phases completed:** 2 phases (51–52), 4 plans, all complete

**Key accomplishments:**

- `signupTenant()` global registry IStorage method — single `db.transaction` atomically provisions tenant + domain + admin user + user_tenants + companySettings; `POST /api/auth/signup` mounted before `resolveTenantMiddleware` (platform-level, no tenant required)
- Stripe 14-day trial subscription created automatically on signup; `customer.subscription.trial_will_end` webhook case added to `billingWebhookHandler` to keep `tenant_subscriptions` status in sync
- `Signup.tsx` public page — 5-field form (Company Name, Subdomain with live .xkedule.com preview, Email, Password, Confirm Password), inline validation, 409 field-level errors without page reload, cross-subdomain redirect on 201
- `BillingPage.tsx` trial UI — blue Trial badge, days-remaining countdown from `currentPeriodEnd`, brand-yellow pill "Add Payment Method" CTA for trialing/past_due states reusing existing `POST /api/billing/portal` flow

---

## v12.0 SaaS Billing (Shipped: 2026-05-14)

**Phases completed:** 3 phases (48–50), 7 plans, all complete

**Key accomplishments:**

- `tenant_subscriptions` table via Supabase migration, Drizzle schema export, and three IStorage methods (getTenantSubscription, createTenantSubscription, upsertTenantSubscription) implemented using the global registry db-direct pattern
- Stripe customer created automatically on tenant creation (POST /api/super-admin/tenants); POST /api/super-admin/tenants/:id/subscribe activates a Stripe Subscription via STRIPE_SAAS_PRICE_ID; POST /api/billing/webhook (raw body, signature verify) handles customer.subscription.updated/deleted events
- 402 subscription enforcement guard in resolveTenantMiddleware — canceled tenants blocked immediately, past_due tenants blocked after 3-day grace period; super-admin Tenants table shows Billing Status (status badge + planId + renewal date) per tenant
- GET /api/billing/status and POST /api/billing/portal endpoints + BillingPage.tsx at /admin/billing — tenant admin sees subscription status card and clicks "Manage Billing" to redirect to Stripe Customer Portal

---

## v11.0 Password Reset (Shipped: 2026-05-14)

**Phases completed:** 1 phase (47), 3 plans, all complete

**Key accomplishments:**

- `password_reset_tokens` table (SHA-256 hash, expiresAt, usedAt) + 4 IStorage methods (`createPasswordResetToken`, `findPasswordResetToken`, `markPasswordResetTokenUsed`, `updateUserPassword`)
- `POST /api/auth/forgot-password` (always 200 — no enumeration), `POST /api/auth/reset-password` (token validation + bcrypt update + mark used), `POST /api/auth/change-password` (session-guarded, verifies current password)
- `buildPasswordResetEmail(resetUrl, companyName)` — branded Resend template with tenant company name from companySettings
- `ForgotPassword.tsx` + `ResetPassword.tsx` pages; "Forgot password?" link in AdminLogin; routes wired in App.tsx

---

## v10.0 Tenant Admin Auth (Shipped: 2026-05-14)

**Phases completed:** 2 phases (45–46), 3 plans, all complete

**Key accomplishments:**

- `SessionData.adminUser` extended with optional `tenantId` field; `requireAdmin` adds cross-tenant 403 guard — session.tenantId must match res.locals.tenant.id
- `POST /api/auth/tenant-login` — timing-safe bcrypt with DUMMY_HASH fallback, stores tenantId in session; `GET /api/auth/admin-me` returns session identity; `POST /api/auth/logout` destroys session
- `AdminTenantAuthContext` — calls GET /api/auth/admin-me on mount, stores `{ isAuthenticated, tenantId, email, role }` with no hardcoded tenant references
- `AdminLogin.tsx` rewritten to POST /api/auth/tenant-login (Supabase removed); `Admin.tsx` redirect guard via `useAdminTenantAuth`; `App.tsx` wraps admin routes in `AdminTenantAuthProvider`

---

## v9.0 Tenant Onboarding (Shipped: 2026-05-14)

**Phases completed:** 3 phases (42–44), 8 plans, all complete

**Key accomplishments:**

- IStorage extended with 6 global-registry methods (getTenants, createTenant, updateTenantStatus, getTenantDomains, addDomain, removeDomain) — all use `db` directly, no tenantId scoping
- 6 super-admin API routes (GET/POST /tenants, PATCH status, GET/POST/DELETE /domains) with 409 conflict guards, hostname normalization, isPrimary delete protection
- React Query hooks + `TenantsSection` + `ManageDomainsDialog` in SuperAdmin.tsx — full tenant/domain CRUD without page reloads
- `users.password` migration + `provisionTenantAdmin` (db.transaction) + `seedTenantCompanySettings` (onConflictDoNothing) storage methods
- `POST /api/super-admin/tenants/:id/provision` — bcrypt hash + randomBytes credential, one-time display in ProvisionDialog, companySettings auto-seeded on tenant creation
- `invalidateTenantCache(hostname)` exported from tenant.ts — called on domain add/remove so LRU reflects changes without server restart
- 503 guard in `resolveTenantMiddleware` for inactive tenants — fires before any route handler
- Per-tenant stats (bookings/services/staff) via `Promise.all` aggregates in GET /tenants — rendered as 3 columns in TenantsSection table

---

## v8.0 Multi-Tenant Architecture (Shipped: 2026-05-13)

**Phases completed:** 4 phases (38–41), 10 plans, all complete
**Files changed:** 81 files, +5969 / -457 lines

**Key accomplishments:**

- Multi-tenant schema: tenants, domains, user_tenants registry tables + tenant_id INTEGER NOT NULL DEFAULT 1 on all 40 business tables via idempotent Supabase CLI migration; Skleanings seeded as tenant id=1
- Drizzle schema updated with tenants/domains/userTenants declarations and tenantId field on all 40 business tables — full TypeScript type coverage for multi-tenant queries
- `DatabaseStorage.forTenant(tenantId)` static factory pattern — 220 `this.tenantId` references across all 23 method groups; `export const storage = DatabaseStorage.forTenant(1)` singleton preserves zero route breakage
- `server/middleware/tenant.ts` with LRU cache (500 entries, 5-min TTL) resolves hostname → tenant → scoped storage instance; unknown hostnames return 404; super-admin routes bypass entirely
- All 11 `server/lib/` files refactored to accept `IStorage` as explicit parameter; all 24 business route files migrated from global `import { storage }` to `res.locals.storage`
- `infra/` directory: Caddyfile (wildcard `*.xkedule.com` TLS via xcaddy cloudflare plugin), app.service (systemd, Restart=always), deploy.yml (workflow_dispatch SSH to Hetzner), README.md (8-step CX23 setup guide)

---

## v7.0 Xkedule Foundation (Shipped: 2026-05-13)

**Phases completed:** 2 phases, 6 plans, 5 tasks

**Key accomplishments:**

- Locale settings (language, startOfWeek, dateFormat) added to companySettings — admin selects in General tab, dateFnsLocalizer moved to useMemo for reactive week-start, toDateFnsFormat() utility applies tenant format to BookingSummary date display
- Super-admin panel at /superadmin — separate session namespace (req.session.superAdmin), bcrypt timing-safe login, error ring buffer (patchConsoleError), stats/health/settings/error-logs API + standalone React page isolated from Navbar/Footer/AuthContext

---

## v6.0 Platform Quality (Shipped: 2026-05-13)

**Phases completed:** 3 phases, 7 plans, 2 tasks

**Key accomplishments:**

- express-rate-limit corrected on 3 public endpoints (analytics/session, analytics/events, chat/message) — max values fixed (10/10/20) and standardHeaders enabled for Retry-After on 429
- BookingPage.tsx (948→~120 lines) and AppointmentsCalendarSection.tsx (~49KB→thin shell) split into focused sub-components: StepStaffSelector, StepTimeSlot, StepCustomerDetails, StepPaymentMethod, BookingSummary, CreateBookingModal, useDragToReschedule
- blog-autopost.yml (hourly) replaced by blog-cron.yml (daily 09:00 UTC) with BLOG_CRON_TOKEN bearer auth; systemHeartbeats table removed from schema and Supabase migration queued

---

## v5.0 Booking Experience (Shipped: 2026-05-13)

**Phases completed:** 3 phases, 9 plans, 6 tasks

**Key accomplishments:**

- Multiple durations per service — selectedDurationId flows CartContext → Zod → booking route → durationLabel/durationMinutes snapshot in bookingItems; recurring generator uses snapshot with catalog fallback
- emailSettings singleton table + Resend SDK + sendResendEmail() module with enabled flag check and notificationLogs logging
- Three branded HTML email templates (confirmation, 24h reminder, cancellation) + fire-and-forget triggers on booking create/cancel/reject routes
- 24h email reminder cron service (run24hEmailReminders) + admin EmailTab UI + GH Actions daily workflow
- calendarSyncQueue table with atomic FOR UPDATE SKIP LOCKED dequeue, 6-attempt exponential backoff [1,5,30,120,720,1440 min], stale-row reaper
- Admin CalendarSyncTab with per-target health cards, failure table, retry-per-job button, and 10+ failure reconnect banner; GH Actions calendar-sync cron every 5min

---

## v4.0 Booking Intelligence (Shipped: 2026-05-11)

**Phases completed:** 5 phases, 15 plans, 23 tasks

**Key accomplishments:**

- range_order INTEGER column added to staff_availability via idempotent migration + Drizzle schema updated so StaffAvailability type includes rangeOrder: number
- Storage, route schema, and slot-generation algorithm updated to support multiple ordered time-range rows per (staffMemberId, dayOfWeek) with N+1-free DB access
- AvailabilityTab replaced with a per-day card editor where admins can add multiple time windows, remove individual ranges, and save rangeOrder-indexed payloads to the backend
- Admin ServiceForm "Booking Questions" collapsible with full CRUD; BookingPage step 4 dynamic question fields with required validation; SharedBookingCard question answer display
- Nodemailer SMTP transporter with graceful no-op + typed reminder email template (subject/text/HTML) using brand colors and 12h time formatting

---

## v3.0 Calendar Polish (Shipped: 2026-05-11)

**Phases completed:** 1 phase, 4 plans, 6 tasks

**Key accomplishments:**

- 20-HUMAN-UAT.md (4 UAT entries) and 20-DIAGNOSIS.md skeleton (3 nine-row tables + DevTools snippet) created; Task 3 baseline measurement awaiting human browser session

---

## v2.0 White Label (Shipped: 2026-05-05)

**Phases completed:** 5 phases, 15 plans, 19 tasks

**Key accomplishments:**

- Schema Foundation & Detokenization — 3 new white-label columns in companySettings, all hardcoded "Skleanings" literals removed from frontend/server, ThemeContext + OpenRouter read brand identity from DB at runtime
- SEO Meta Injection — Express middleware injects tenant-specific title, canonical, OG, Twitter Card, and LocalBusiness JSON-LD into every HTML response; vercel.json routes all HTML through Express; index.html fully retemplated with {{TOKEN}} markers
- Favicon, Legal & Company Type Admin UI — faviconUrl upload + {{FAVICON_URL}} injector token, service delivery model selector, Privacy Policy and Terms of Service DB-driven with graceful empty states at /privacy-policy and /terms-of-service
- Admin Calendar Improvements — widened Create Booking modal, multi-service useFieldArray rows, always-editable end time, conditional address field gated by serviceDeliveryModel, brand yellow submit button
- Receptionist Booking Flow & Multi-Staff View — "By Staff" parallel-column calendar via RBC resources prop, DnDCalendar drag-to-reassign between staff with undo toast, QuickBookModal for walk-in booking in under 30 seconds, 30s polling, per-staff availability badges on customer booking step 3

---

## v1.0 Marketing Attribution (Shipped: 2026-05-05)

**Phases completed:** 5 phases, 15 plans, 19 tasks

**Key accomplishments:**

- UTM session capture (all 6 params + referrer + landing page), server-side traffic classification, first/last-touch attribution model with first-touch immutability enforced at storage layer
- Booking flow attribution wired end-to-end — visitorId survives direct and Stripe redirect paths; booking_started and chat_initiated events recorded fire-and-forget
- Marketing Dashboard UI — Overview KPIs, Sources and Campaigns performance tables, Conversions tab, Visitor Journey slide-over, date range filter with 7 presets, polished empty states
- GoHighLevel CRM UTM sync — first-touch and last-touch source/campaign written to GHL contact custom fields fire-and-forget on booking completion
- Admin calendar create-booking-from-slot — pre-filled form with customer type-ahead, computed end time + estimated price, full submit mutation with status confirmation and calendar refresh
