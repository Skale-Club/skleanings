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
| Version | 0.2.0 |
| Status | Active — v0.2 Staff Members shipped, planning v0.3 |
| Last Updated | 2026-04-02 |

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
- [ ] Unified Users Page + Create User Flow — v0.6 Phase 2
- [ ] Staff Personal Settings Page — v0.6 Phase 3

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
*Last updated: 2026-04-04 after Phase 06-01+06-02 — v0.6 Phase 1 (Schema + Auth + Role Middleware) complete*
