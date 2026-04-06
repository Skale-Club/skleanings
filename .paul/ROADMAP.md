# Roadmap: skleanings

## Overview

Skleanings is a booking platform for a cleaning company. The current milestone (v0.2) adds a Staff Members feature, enabling customers to book services with a specific professional. The system enforces per-staff availability, resolves conflicts across multiple staff, and syncs each staff member's Google Calendar to automatically block their busy times.

## Current Milestone

**v1.0 — Client Portal & Self-Service Booking Management** (v1.0.0)
Status: ✅ Complete — 2026-04-05
Phases: 3 of 3 complete

## Previously Completed

**v0.3 — Stripe Payments** (v0.3.0)
Status: ✅ Complete — 2026-04-02
Phases: 3 of 3 complete

## Completed Milestone

**v0.2 — Staff Members** (v0.2.0)
Status: ✅ Complete — 2026-04-02
Phases: 5 of 5 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Schema & Storage Layer | 3 | ✅ Complete | 2026-04-02 |
| 2 | Staff Management API + Admin UI | 2 | ✅ Complete | 2026-04-02 |
| 3 | Google Calendar OAuth per Staff | 2 | ✅ Complete | 2026-04-02 |
| 4 | Smart Availability Engine | 1 | ✅ Complete | 2026-04-02 |
| 5 | Booking Flow UI — Staff Selection | 1 | ✅ Complete | 2026-04-02 |

## Phase Details

### Phase 1: Schema & Storage Layer

**Goal:** All database tables for staff feature exist with correct relationships; storage layer has typed methods for all staff operations; existing bookings remain unaffected.
**Depends on:** Nothing (first phase)
**Research:** Unlikely (internal schema patterns established)

**Scope:**
- `staffMembers` table (id, firstName, lastName, email, phone, profileImageUrl, isActive, bio)
- `staffServiceAbilities` junction table (staffMemberId → serviceId, many-to-many)
- `staffAvailability` table (staffMemberId, dayOfWeek, startTime, endTime, isAvailable)
- `staffGoogleCalendar` table (staffMemberId, accessToken, refreshToken, calendarId, connectedAt)
- Add nullable `staffMemberId` to `bookings` table
- IStorage methods: CRUD staff, assign services, set availability, store Google tokens
- Drizzle insert/select schemas and TypeScript types

**Plans:**
- [ ] 01-01: Staff schema tables + Drizzle types
- [ ] 01-02: Bookings migration (add staffMemberId nullable)
- [ ] 01-03: Storage layer methods for staff

### Phase 2: Staff Management API + Admin UI

**Goal:** Admin can create and manage staff members, assign services, and set working hours through the admin dashboard.
**Depends on:** Phase 1 (schema + storage)
**Research:** Unlikely (CRUD pattern established in codebase)

**Scope:**
- REST endpoints: `/api/staff` (CRUD), `/api/staff/:id/services`, `/api/staff/:id/availability`
- Admin UI: Staff list page, create/edit staff dialog, service assignment, hours configuration
- Staff count endpoint (`/api/staff/count`) used by frontend to conditionally show selector

**Plans:**
- [ ] 02-01: Staff API endpoints (CRUD + service assignment + availability)
- [ ] 02-02: Admin UI — staff list + create/edit dialog
- [ ] 02-03: Admin UI — service assignment + availability hours

### Phase 3: Google Calendar OAuth per Staff *(optional integration)*

**Goal:** Each staff member can connect their personal Google Calendar; external events automatically block their booking availability.
**Depends on:** Phase 2 (staff must exist to connect calendar)
**Research:** Likely (Google OAuth 2.0 flow, Google Calendar API busy times)
**Research topics:** Google Calendar API scopes for busy-time only, token refresh strategy, Vercel env var setup for Google credentials

**Scope:**
- Google OAuth 2.0 flow (per staff member, `/api/staff/:id/calendar/connect`)
- Token storage + refresh logic
- Busy-time fetching from Google Calendar API (freebusy query)
- Calendar disconnect endpoint
- Admin UI: connect/disconnect Google Calendar per staff member

**Plans:**
- [ ] 03-01: Google OAuth flow + token storage
- [ ] 03-02: Busy-time fetching + caching strategy
- [ ] 03-03: Admin UI — calendar connect/disconnect per staff

### Phase 4: Smart Availability Engine

**Goal:** Availability endpoint returns slots based on per-staff schedules, Google Calendar busy times, and existing bookings — with correct cross-service conflict resolution for carts with multiple services.
**Depends on:** Phase 3 (Google Calendar tokens available)
**Research:** Unlikely (extends existing `server/lib/availability.ts`)

**Scope:**
- Refactor `getAvailableSlots` to accept optional `serviceIds[]` param
- For each slot: check which staff can do each service → are they free?
- Cross-service logic: cart has services A + B → staff for A and staff for B must both have overlapping free slots
- Error handling: if no staff can cover a service at any slot, surface as "service unavailable for this date"
- Backward-compatible: if no staff in system, old global logic runs unchanged
- `staffId` param on availability endpoint: when customer selects a specific staff, filter to that staff only

**Plans:**
- [ ] 04-01: Per-staff slot computation (hours + Google busy + existing bookings)
- [ ] 04-02: Cross-service availability merging (cart intersection logic)
- [ ] 04-03: Error handling + backward-compatibility layer

### Phase 5: Booking Flow UI — Staff Selection

**Goal:** Booking flow conditionally shows a staff selection step; selected staff is passed through to booking creation; confirmation screen shows assigned professional.
**Depends on:** Phase 4 (availability engine must support staffId filtering)
**Research:** Unlikely (extends existing BookingPage.tsx)

**Scope:**
- `/api/staff/count` check on BookingPage mount → hide step if count ≤ 1
- Staff selection step: show available staff for the services in cart (with photo + name)
- Selected staffId stored in booking state
- Availability query updated to include `staffId` when staff is selected
- POST `/api/bookings` updated to accept `staffMemberId`
- Booking confirmation shows assigned professional name
- Admin booking view shows assigned staff

**Plans:**
- [ ] 05-01: Staff selection UI component + conditional display logic
- [ ] 05-02: Availability + booking submission with staffId
- [ ] 05-03: Confirmation screen + admin booking view updates

---
---

## v0.3 — Stripe Payments

Customers can pay for their cleaning booking online at checkout via Stripe. The "Pay Online" option (currently disabled) is enabled with a full Stripe Checkout redirect flow. Payments are verified via webhook. Admins configure Stripe keys in the Integrations section.

### Phase 1: Schema, Stripe Library & Admin Integration

**Goal:** Stripe credentials stored in DB; `stripeSessionId` on bookings; Stripe client lib reads from DB; admin can configure keys.
**Depends on:** Nothing (first phase)

**Scope:**
- Add `stripeSessionId` column to `bookings` table + Supabase migration
- `server/lib/stripe.ts` — Stripe client (reads secret key from `integrationSettings`), `createCheckoutSession`, `verifyWebhookEvent`
- `GET /api/integrations/stripe` + `PUT /api/integrations/stripe` — admin credential management (same pattern as GHL/Google Calendar)
- Admin UI: Stripe card in `IntegrationsSection` (publishable key, secret key, webhook secret, enable toggle)

**Plans:**
- [ ] 01-01: Schema migration + Stripe lib + admin integration API
- [ ] 01-02: Payment routes (`POST /api/payments/checkout`, `POST /api/payments/webhook`, `GET /api/payments/verify/:sessionId`)

### Phase 2: Booking Flow — Pay Online ✅ Complete — 2026-04-02

**Goal:** Customer can select "Pay Online", complete booking, be redirected to Stripe Checkout, and land on a success confirmation.
**Depends on:** Phase 1 (Stripe lib + routes must exist)

**Scope:**
- `BookingPage.tsx` — enable "Pay Online" radio; on submit with `paymentMethod: "online"`, call `POST /api/payments/checkout` and redirect to Stripe URL
- `client/src/pages/Confirmation.tsx` — detect `?session_id=xxx`; verify session; show payment-received / pending states
- Booking submit button copy: "Pay $X.XX with Stripe" when online selected

**Plans:**
- [x] 02-01: Booking flow UI + confirmation page states ✅ 2026-04-02

### Phase 3: Admin Payment Management ✅ Complete — 2026-04-02

**Goal:** Admin can see Stripe payment status on bookings and manually override payment status.
**Depends on:** Phase 1 (Stripe fields on bookings)

**Scope:**
- `SharedBookingCard.tsx` — show Stripe session ID, link to Stripe dashboard for that payment
- `paymentStatus` badge updates: `pending_payment` state shown as "Awaiting Payment"
- Admin can mark any booking as paid/unpaid manually (already exists — ensure `pending_payment` is handled)

**Plans:**
- [x] 03-01: Admin booking card Stripe payment display ✅ 2026-04-02

---

## v0.4 — Unified Users Management

Consolidate the separate "Users" and "Staff" sidebar sections into a single "Users" section with internal tabs. A user is a base entity that may or may not be admin or staff.

### Phase 1: Unified Users Section ✅ Complete — 2026-04-02

**Goal:** Single "Users" nav item containing both platform users (admin accounts) and staff members (cleaning professionals) in a tabbed interface.
**Depends on:** Nothing

**Scope:**
- New `UnifiedUsersSection` component with Staff + Admin Accounts tabs
- Remove "Staff" nav item from Admin sidebar
- Update AdminSection type

**Plans:**
- [x] 04-01: Unified Users page with tabs ✅ 2026-04-02

---

## v0.5 — Google Calendar Reconnect Notifications

When a staff member's Google Calendar token expires or becomes invalid, the system automatically detects the disconnection, marks the record, sends SMS + email notifications to the admin, and shows a "Take Action" in-app banner inside the admin dashboard — mirroring the GoHighLevel reconnect alert UX.

### Phase 1: Reconnect Detection & Notifications ✅ Complete — 2026-04-02 (all plans)

**Goal:** Backend detects expired/invalid tokens, marks them as `needsReconnect`, sends SMS notification via Twilio, and exposes a status endpoint for the frontend banner.
**Depends on:** Nothing (schema already updated with `needsReconnect` + `lastDisconnectedAt`)

**Scope:**
- Update `IStorage` interface + `DatabaseStorage` with `markCalendarNeedsReconnect` and `getAllCalendarStatuses` methods
- Update `getValidAccessToken` in `google-calendar.ts` — on refresh failure, call `markCalendarNeedsReconnect` + send Twilio SMS
- `GET /api/staff/calendar/all-statuses` — returns all staff with calendar connection state (for banner)
- `POST /api/staff/:id/calendar/clear-reconnect` — clears `needsReconnect` after successful re-auth

**Plans:**
- [x] 05-01: Storage + token health check + SMS notification ✅ 2026-04-02
- [x] 05-02: "Take Action" banner component + admin wiring ✅ 2026-04-02

---

## v0.6 — Unified Users & Roles ✅ Complete — 2026-04-04

Single "Users" page with three roles: Admin (owner — full access), User (receptionist — manage staff, view calendars/bookings), Staff (professional — personal settings only). Bridge approach: `users` table gets `role` column; `staffMembers` gets `userId` FK. Existing availability/calendar/booking code stays untouched.

### Phase 1: Schema + Auth + Role Middleware ✅ Complete — 2026-04-04

**Goal:** `users` table has `role` enum column. Auth returns role. Three middleware levels: `requireAdmin`, `requireUser` (admin+user), `requireStaff` (any authenticated). Staff login creates a user record automatically when admin creates staff.
**Depends on:** Nothing

**Scope:**
- Add `role` column to `users` table (enum: admin/user/staff, default 'admin' for backward compat)
- Add `phone` column to `users` table
- Add `userId` FK to `staffMembers` table
- Update auth middleware: `requireAdmin` (role=admin), `requireUser` (role=admin|user), `requireStaff` (any auth'd user)
- Update AuthContext to expose `role`
- Login redirects: admin/user → /admin, staff → /staff/settings
- Supabase migration

**Plans:**
- [x] 06-01: Schema migration + auth middleware + AuthContext role ✅ 2026-04-04
- [x] 06-02: Login redirect by role + staff route guard ✅ 2026-04-04

### Phase 2: Unified Users Page + Create User Flow ✅ Complete — 2026-04-04

**Goal:** Single flat users list showing all users (admin + user + staff) with role badges. "Add User" dialog with role picker and avatar upload. Creating staff-role user also creates linked staffMembers record.
**Depends on:** Phase 1

**Scope:**
- Rewrite UnifiedUsersSection → single flat table (no tabs)
- Add User dialog: role picker (Admin visible only to admins, User+Staff visible to users), name, email, password, avatar upload
- Edit User dialog: same fields, role change rules
- When creating role=staff: auto-create staffMembers record with userId FK
- Avatar upload using existing Supabase Storage flow (ObjectUploader)

**Plans:**
- [x] 06-03: Unified users list + Add/Edit user dialog with role picker ✅ 2026-04-04
- [x] 06-04: Staff creation bridge (auto-create staffMembers on role=staff) ✅ 2026-04-04

### Phase 3: Staff Personal Settings Page ✅ Complete — 2026-04-04

**Goal:** Staff logs in and lands on a personal settings page where they can edit their profile, bio, avatar, and Google Calendar connection. No access to admin pages.
**Depends on:** Phase 2

**Scope:**
- New route: /staff/settings
- StaffSettingsPage component: edit own profile (name, phone, bio, avatar) + CalendarTab
- Route guard: staff role only sees /staff/* routes
- Staff navbar: minimal (just settings + logout)

**Plans:**
- [x] 06-05: Staff settings page + route protection ✅ 2026-04-04

---

## v0.7 — Google Calendar Polish ✅ Complete — 2026-04-04

White-label Google Calendar OAuth: admin configures credentials once, staff just click "Connect Google Calendar" from their personal settings page and land back there after OAuth. Fixes broken callback redirect and unauthenticated API calls in CalendarTab.

### Phase 1: OAuth Flow + Auth Fixes ✅ Complete — 2026-04-04

**Goal:** Staff connects Google Calendar from /staff/settings and returns there after OAuth. All CalendarTab API calls use authenticated requests. Admin connect flow unchanged.
**Depends on:** v0.6 (staff settings page + requireAuth on calendar endpoints)

**Scope:**
- `getAuthUrl` encodes `redirectTo` in OAuth state
- Connect route reads user role, passes `redirectTo` to `getAuthUrl`
- Callback parses state to route to `/staff/settings` or `/admin/staff`
- CalendarTab uses `useAdminAuth` + `authenticatedRequest` for all API calls
- Connect button passes token as query param (browser navigation workaround)
- `requireAuth` accepts token from query param as fallback

**Plans:**
- [x] 07-01: OAuth callback redirect + CalendarTab auth ✅ 2026-04-04

---

## v0.8 — Production DB Stability ✅ Complete — 2026-04-04

Vercel serverless functions are timing out (30s) on all DB-touching endpoints because the code uses the non-pooled Neon connection in production instead of the pgBouncer pooler. Fixing the connection priority + a few defensive hardening changes will restore stable production operation.

### Phase 1: Database Connection Fix ← **Current**

**Goal:** All API endpoints respond within normal latency (< 1s) in production; no more 504 timeouts on DB queries.
**Depends on:** Nothing

**Scope:**
- `server/db.ts` — swap serverless connection priority to use `POSTGRES_URL` (pgBouncer pooler) first, reduce `connectionTimeoutMillis` from 30s to 8s
- `client/src/components/admin/CalendarReconnectBanner.tsx` — add `refetchOnWindowFocus: false` to prevent repeated refetches of the most frequently timed-out endpoint

**Plans:**
- [x] 08-01: Fix DB connection pooling + harden CalendarReconnectBanner query ✅ 2026-04-04

---
 
## v0.9 — Runtime DB SCRAM Stability (Blog Autopost + Login) ✅ Complete — 2026-04-05

GitHub Actions blog autopost and interactive login both still show intermittent HTTP 500 on cold start with `SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing`. A second production symptom is now tracked in the same milestone: login appears to authenticate but immediately redirects back to `/login` in a loop for `skleanings@gmail.com`. This milestone isolates runtime DB authentication and login-session stability in serverless and introduces a safe strategy that works for both cron-triggered and interactive user-triggered requests.

### Phase 1: Runtime DB Auth Investigation + Fix ✅ Complete — 2026-04-05

**Goal:** Eliminate SCRAM handshake failures and the login redirect loop in production so `/api/blog/cron/generate` and login-authenticated endpoints remain stable after cold start.
**Depends on:** v0.8

**Scope:**
- Validate which runtime connection URL path (`POSTGRES_URL`, `DATABASE_URL`, `POSTGRES_URL_NON_POOLING`) is actually selected in production and under which request flows
- Reproduce and classify the SCRAM failure path for both cron endpoint and login flow with structured logs
- Reproduce and classify the login loop path where auth appears successful but route/session validation bounces user back to `/login`
- Apply minimal DB bootstrap hardening in `server/db.ts` to prevent the specific SCRAM handshake failure mode without regressing latency
- Verify GitHub Action and manual login both succeed across cold and warm invocations without redirect looping

**Plans:**
- [x] 09-01: Instrument, reproduce, and harden runtime DB/auth path for SCRAM stability + login loop resolution ✅ 2026-04-05

---

## v1.0 — Client Portal & Self-Service Booking Management ← **Current**

Add a fourth authenticated role, `client`, for end customers. A client can sign in to a dedicated account area, update their personal information, see bookings that belong to them, and cancel or reschedule their own upcoming bookings without admin assistance.

### Phase 1: Client Role + Booking Ownership ✅ Complete — 2026-04-05

**Goal:** The system can authenticate a `client` role, store customer profile data on the user record, and associate bookings to a specific authenticated client without breaking guest booking flow.
**Depends on:** v0.6 (unified users + role-based auth)

**Scope:**
- Add `client` to the role model across schema, auth middleware, route guards, and frontend role handling
- Add nullable `userId` FK on `bookings` to represent booking ownership
- When an authenticated client creates a booking, attach `userId` automatically and prefill contact fields from the account profile where possible
- Keep guest booking supported; `userId` remains nullable for non-logged-in bookings
- Define ownership fallback for legacy bookings by confirmed email match until newer bookings are explicitly linked

**Plans:**
- [x] 10-01: Add `client` role support across auth, redirects, and account route guards ✅ 2026-04-05
- [x] 10-02: Add booking ownership (`bookings.userId`) and authenticated-booking autofill/linking ✅ 2026-04-05

### Phase 2: Client Self-Service Booking API ✅ Complete — 2026-04-05

**Goal:** Authenticated clients can fetch only their own account data and bookings, and can cancel or reschedule eligible future bookings through dedicated self-service endpoints.
**Depends on:** Phase 1 (client identity + booking ownership)

**Scope:**
- `GET /api/client/me` + `PATCH /api/client/me` for personal info editing
- `GET /api/client/bookings` + `GET /api/client/bookings/:id` scoped to the authenticated client only
- `POST /api/client/bookings/:id/cancel` with ownership, status, and date-window checks
- `POST /api/client/bookings/:id/reschedule` with ownership checks plus existing availability validation
- Reuse or extend current booking update logic without exposing admin booking endpoints to clients
- Sync cancellation/reschedule effects to GHL and any notification paths already attached to booking changes

**Plans:**
- [x] 11-01: Client profile + own-bookings endpoints with ownership guards ✅ 2026-04-05
- [x] 11-02: Self-service cancellation and reschedule endpoints ✅ 2026-04-05
- [x] 11-03: External sync and notification handling for client-initiated changes ✅ 2026-04-05

### Phase 3: Client Portal UI ✅ Complete — 2026-04-05

**Goal:** Clients have a simple account area where they can sign in, edit profile details, review booking history/upcoming bookings, and complete cancel/reschedule flows.
**Depends on:** Phase 2 (client API)

**Scope:**
- Dedicated client-facing login/account entrypoint and redirect behavior for role=`client`
- `/account` or `/client` route group with profile and bookings sections
- Profile form for name, phone, and avatar using existing upload/auth patterns
- Booking list with status badges, service/date details, and actions gated by booking state
- Reschedule UX reusing the existing availability experience as much as possible
- Clear handling for legacy bookings that are visible by email match but not yet explicitly linked

**Plans:**
- [x] 12-01: Client login/account shell + role-based routing ✅ 2026-04-05
- [x] 12-02: Profile editor + own bookings list UI ✅ 2026-04-05
- [x] 12-03: Cancel/reschedule UX and account-state polish ✅ 2026-04-05

---
*Roadmap created: 2026-04-02*
*Last updated: 2026-04-05 — v1.0 Client Portal milestone complete*
