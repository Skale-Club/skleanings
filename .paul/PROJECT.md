# skleanings

## What This Is

Skleanings is a full-stack service booking platform for a cleaning company. Customers browse services by category, add to cart, select available time slots, and complete bookings. The platform includes an admin dashboard and GoHighLevel CRM integration.

The current milestone adds a **Staff Members** feature: customers can see and select which professional will perform their service — similar to a barbershop model. When only one professional exists, the selection UI is hidden entirely. When multiple exist, the customer selects their preferred professional, and the system enforces availability at the staff level — including Google Calendar sync per staff member to block times from external appointments.

## Core Value

Customers can book cleaning services with a specific professional, with a unified calendar that automatically resolves availability conflicts across staff members and their external Google Calendar events.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 1.0.0 |
| Status | Active — v1.0 Client Portal shipped |
| Last Updated | 2026-04-05 |

**Production:** skleanings.vercel.app (inferred from Vercel config)

## Requirements

### Core Features

- **Staff member management** — Admin can create, edit, activate/deactivate staff members with photo, name, contact info
- **Service-to-staff assignment** — Each service is assigned to one or more staff members who can perform it
- **Per-staff availability schedule** — Staff have their own working hours (day-of-week based)
- **Google Calendar OAuth per staff** — Each staff member connects their personal Google Calendar; external events mark their slots as busy automatically
- **Unified smart calendar** — Single booking calendar shown to customer; a slot is available only if at least one qualified staff is free; cross-service carts compute intersection of available staff
- **Conditional staff selection UI** — Staff selector is hidden if only 1 active staff member exists; shown and required if 2+
- **Staff-aware booking** — Bookings store which staff member was assigned; admin sees this on dashboard

### Validated (Shipped)
- [x] Service catalog (categories, subcategories, services)
- [x] Cart with pricing engine (fixed, area-based, base+addons, custom quote)
- [x] Global availability engine (business hours + booking conflict detection)
- [x] Booking flow (date/time → contact → address → submit)
- [x] GoHighLevel CRM sync
- [x] Admin dashboard (basic)
- [x] Session-based auth with bcrypt
- [x] Staff member management — Admin CRUD with photo, name, bio, active toggle — Phase 2
- [x] Service-to-staff assignment — per-staff service ability checkboxes — Phase 2
- [x] Per-staff availability schedule — weekly hours grid per staff — Phase 2
- [x] Google Calendar OAuth per staff — each staff connects personal calendar, busy times block slots — Phase 3
- [x] Admin credentials for Google OAuth stored in integrationSettings (not env vars) — Phase 3
- [x] Unified smart calendar — slot available if any qualified staff is free; cross-service cart intersection — Phase 4
- [x] Conditional staff selection UI — hidden when ≤1 staff, shown when 2+ — Phase 5
- [x] Staff-aware booking — staffMemberId stored on booking, shown in admin dashboard — Phase 5

### Active (In Progress)
- [ ] Instrument Twilio/Telegram/GHL sends to log to notification_logs table — Phase 14
- [ ] API endpoints: GET /api/conversations/:id/notifications + GET /api/admin/notification-logs — Phase 14
- [ ] Admin UI: Notifications tab in conversation modal + global NotificationLogsSection — Phase 15

### Validated (v1.1 Phase 13 complete)
- [x] `notificationLogs` table in shared/schema.ts with nullable conversationId + bookingId FKs — Phase 13
- [x] `insertNotificationLogSchema`, `NotificationLog`, `InsertNotificationLog` exported from shared/schema.ts — Phase 13
- [x] `IStorage` extended: `createNotificationLog`, `getNotificationLogsByConversation`, `getNotificationLogsByBooking`, `getNotificationLogs(filters)` — Phase 13
- [x] `DatabaseStorage` implements all 4 methods with Drizzle dynamic filter pattern — Phase 13

### Validated (v1.0 Phase 3 complete)
- [x] Client login page (ClientLogin.tsx) with role=client redirect to /account — v1.0 Phase 3
- [x] AccountShell.tsx — client account area with profile + bookings tab navigation — v1.0 Phase 3
- [x] ProfileSection — name/phone/avatar editor using PATCH /api/client/me — v1.0 Phase 3
- [x] BookingsSection — client booking list with status badges + eligibility-gated action buttons — v1.0 Phase 3
- [x] CancelBookingDialog — AlertDialog confirm-to-cancel flow calling POST /api/client/bookings/:id/cancel — v1.0 Phase 3
- [x] RescheduleBookingDialog — date + slot picker calling POST /api/client/bookings/:id/reschedule — v1.0 Phase 3
- [x] Full client self-service cycle: login → view bookings → cancel or reschedule — v1.0 Phase 3

### Validated (v1.0 Phase 2 complete)
- [x] GET /api/client/me — returns authenticated client's user record — v1.0 Phase 2
- [x] PATCH /api/client/me — updates name/phone/avatar (role-safe Zod allow-list) — v1.0 Phase 2
- [x] GET /api/client/bookings — merged userId + email-match legacy bookings list — v1.0 Phase 2
- [x] GET /api/client/bookings/:id — single booking with ownership check (403 on mismatch) — v1.0 Phase 2
- [x] POST /api/client/bookings/:id/cancel — ownership + status + date-window guarded cancel — v1.0 Phase 2
- [x] POST /api/client/bookings/:id/reschedule — availability-checked reschedule with self-exclusion — v1.0 Phase 2
- [x] GHL appointment delete/update on client-initiated changes (fire-and-forget) — v1.0 Phase 2
- [x] Admin Twilio + Telegram notifications for client cancel/reschedule — v1.0 Phase 2

### Validated (v0.7 complete)
- [x] OAuth state encodes `staffId:redirectTo` — callback routes to correct page per initiator role — v0.7
- [x] Staff lands on /staff/settings after Google OAuth — v0.7
- [x] Admin lands on /admin/staff after Google OAuth — v0.7 (unchanged behavior preserved)
- [x] CalendarTab uses `useAdminAuth` + `authenticatedRequest` for all API calls — v0.7
- [x] `requireAuth` accepts token from query param as fallback for browser-navigation OAuth — v0.7

### Validated (v0.6 Phase 3 complete)
- [x] GET /api/staff/me + PATCH /api/staff/me — staff edits own profile — v0.6 Phase 3
- [x] CalendarTab extracted as shared component — v0.6 Phase 3
- [x] /staff/settings full page: profile form + avatar upload + CalendarTab + logout — v0.6 Phase 3
- [x] Calendar endpoints (status/connect/disconnect) use requireAuth — v0.6 Phase 3

### Validated (v0.6 Phase 2 complete)
- [x] Flat users list replacing tabbed UnifiedUsersSection — v0.6 Phase 2
- [x] Role badges (admin/user/staff) from user.role — v0.6 Phase 2
- [x] UserDialog role Select (Admin option gated to admins) — v0.6 Phase 2
- [x] user-routes PATCH/DELETE guards use role === 'admin' — v0.6 Phase 2
- [x] POST /api/users role=staff auto-creates staffMembers record — v0.6 Phase 2
- [x] PATCH role→staff idempotent staffMembers bridge — v0.6 Phase 2
- [x] DELETE staff user cleans up linked staffMembers first — v0.6 Phase 2

### Validated (v0.6 Phase 1 complete)
- [x] role enum column on users table (admin/user/staff, default admin) — v0.6 Phase 1
- [x] phone column on users table — v0.6 Phase 1
- [x] userId FK on staffMembers table — v0.6 Phase 1
- [x] requireAdmin / requireUser / requireStaff middleware — v0.6 Phase 1
- [x] AuthContext exposes role — v0.6 Phase 1
- [x] Login redirects by role (staff → /staff/settings, admin/user → /admin) — v0.6 Phase 1
- [x] Admin page blocks staff with redirect guard — v0.6 Phase 1
- [x] /staff/* route group + StaffSettings placeholder — v0.6 Phase 1

### Validated (v0.5 complete)
- [x] needsReconnect + lastDisconnectedAt columns on staffGoogleCalendar — v0.5 Phase 1
- [x] Auto-mark on token refresh failure — storage.markCalendarNeedsReconnect — v0.5 Phase 1
- [x] SMS notification on first calendar disconnection via Twilio — v0.5 Phase 1
- [x] GET /api/staff/calendar/all-statuses — admin endpoint for banner data — v0.5 Phase 1
- [x] POST /api/staff/:id/calendar/clear-reconnect — resets flag after re-auth — v0.5 Phase 1
- [x] "Take Action" banner in admin dashboard — amber warning + "Fix This" modal — v0.5 Phase 1
- [x] CalendarTab reconnect warning state — three-state UI — v0.5 Phase 1
- [x] OAuth callback auto-clears needsReconnect — v0.5 Phase 1

### Validated (v0.4 complete)
- [x] Unified Users section — Staff + Admin Accounts tabs — v0.4 Phase 1

### Validated (v0.3 complete)
- [x] Stripe Connect OAuth — client connects own Stripe account via button in Admin → Integrations — Phase 1
- [x] Stripe Checkout redirect flow — booking creates session, customer redirected to Stripe — Phase 1 + 2
- [x] stripeSessionId on bookings — links booking to Stripe session for verification — Phase 1
- [x] Pay Online radio enabled in booking flow — Phase 2
- [x] Confirmation page Stripe states (loading/pending/paid) — Phase 2
- [x] Admin booking card: pending_payment badge + Stripe dashboard link — Phase 3

### Out of Scope
- Per-service Google Calendar (calendar is per staff member, not per service)
- Multi-company / franchise support
- Per-service Google Calendar (calendar is per staff member, not per service)
- Multi-company / franchise support

## Constraints

### Technical Constraints
- PostgreSQL via Drizzle ORM — schema changes require `npm run db:push`
- Availability engine in `server/lib/availability.ts` — must remain backward-compatible (no staff = old behavior)
- `bookings` and `bookingItems` tables must stay backward-compatible (staffId nullable)
- Google Calendar OAuth requires Google Cloud project with OAuth credentials (stored in Admin → Integrations)
- GHL sync code must be updated to map staffMemberId → GHL provider ID when applicable

### Business Constraints
- Staff selection UI must be invisible when staff count = 1 (no UX disruption for single-operator mode)
- Availability must be shown as a single unified calendar — never multiple calendars per staff
- If a staff member has no services assigned, they should not appear as an option
- A booking slot must show as unavailable if no qualified staff is free (not just "staff is busy")

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| New `staffMembers` table (not reuse `users`) | `users` is for admin auth only; staff are operational entities with different fields and lifecycle | 2026-04-02 | Active |
| `staffId` nullable on `bookings` | Backward compatibility — existing bookings have no staff | 2026-04-02 | Active |
| Availability is computed per-service, then merged | Cart may contain services from different staff; must intersect availability correctly | 2026-04-02 | Active |
| Google Calendar per staff member (OAuth) | Staff use personal Google calendars; OAuth allows read-only busy-time fetching without exposing credentials | 2026-04-02 | Active |
| Hide staff UI when count = 1 | Single-operator businesses shouldn't see irrelevant UI | 2026-04-02 | Active |
| Conditional DB write on needsReconnect | Only update when currently false — prevents duplicate SMS on repeated token failures | 2026-04-02 | Active |
| Notification path fully try/catch wrapped | Token refresh is called from availability engine — failure must never break booking flow | 2026-04-02 | Active |
| Post-login always redirects to /admin; Admin.tsx guard handles staff redirect | Avoids race condition — role is fetched async after auth; redirect at login would fire before role is known | 2026-04-04 | Active |
| /staff route group isolated before /admin in Router() | Clean separation; same pattern as isAdminRoute; /staff/* paths never fall through to admin routes | 2026-04-04 | Active |
| linkStaffMemberToUser dedicated storage method | userId omitted from InsertStaffMember type by design; updateStaffMember can't accept it | 2026-04-04 | Active |
| Default role = 'staff' for new users in UserDialog | Least privilege — admin must explicitly elevate to admin/user | 2026-04-04 | Active |
| requireAuth on calendar endpoints (not requireAdmin) | Staff need to manage their own calendar from /staff/settings without admin privilege | 2026-04-04 | Active |
| Client router uses (req as any).user from requireClient (no re-auth) | requireClient already calls getAuthenticatedUser and sets req.user; double call = double Supabase round-trip | 2026-04-05 | Active |
| getClientBookings uses two parallel queries + in-process merge | Avoids complex OR on nullable column; Set-based dedup is straightforward | 2026-04-05 | Active |
| Client cancel/reschedule sync is fire-and-forget | HTTP response speed — GHL/notification latency must not block client | 2026-04-05 | Active |
| AlertDialog for cancel, Dialog for reschedule | AlertDialog has correct destructive/confirm semantics; Dialog suits multi-step picker | 2026-04-05 | Active |
| onError: toast only, no onClose in dialogs | User should be able to retry without reopening the dialog | 2026-04-05 | Active |
| `text` for channel/trigger/status in notificationLogs (not pgEnum) | Matches every other enum-like field in codebase; no migration needed for new trigger types | 2026-04-15 | Active |
| `onDelete: set null` on notificationLogs FK columns | Log row survives deletion of parent conversation or booking — preserves audit trail | 2026-04-15 | Active |
| One notificationLogs row per recipient per send | Enables per-number/per-chatId filtering; Telegram sends to multiple chatIds = multiple rows | 2026-04-15 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Staff feature hidden (1 staff) | UI shows no staff selector | Implemented | Shipped v0.2 |
| Staff feature visible (2+ staff) | Customer must select a professional | Implemented | Shipped v0.2 |
| Google Calendar blocks respected | External events make slots unavailable | Implemented | Shipped v0.2 |
| Cross-service availability correct | Cart with 2 services from different staff resolves to intersection | Implemented | Shipped v0.2 |
| Backward-compatible bookings | Existing bookings unaffected | Implemented | Shipped v0.2 |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18 + TypeScript + Vite | Wouter routing, React Query, shadcn/ui, Tailwind |
| Backend | Express.js + TypeScript | Single `routes.ts` (~2800 lines) |
| ORM | Drizzle ORM | Schema in `shared/schema.ts` — source of truth |
| Database | PostgreSQL | Vercel Postgres (SCRAM auth via connectionString) |
| Auth | Session-based + bcrypt | Admin only; Replit Auth integration present |
| CRM | GoHighLevel | Contact + appointment sync in `server/integrations/ghl.ts` |
| Calendar | Google Calendar API (new) | OAuth per staff member; read busy times |
| Hosting | Vercel | Vercel Postgres + serverless edge |

## Links

| Resource | URL |
|----------|-----|
| Repository | https://github.com/Skale-Club/skleanings |
| Active branch | feature/staff-members |
| Dev branch | dev |

---
*PROJECT.md — Updated when requirements or context change*
*Last updated: 2026-04-15 after Phase 13 — v1.1 notification_logs schema + storage layer*
