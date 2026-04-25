# Phase 10: Client Portal & Booking Ownership — Discussion Context

## Vision

Introduce a fourth authenticated role, `client`, for end customers. A client should have a self-service account area where they can manage their personal details and see the bookings they made, with the ability to cancel or reschedule their own upcoming bookings.

This is not the existing `user` role. In this codebase, `user` already means an internal receptionist/attendant role with back-office permissions. `client` is the customer-facing role.

## Why This Milestone Exists

The platform currently stores booking contact fields (`customerName`, `customerEmail`, `customerPhone`) directly on the booking, but there is no authenticated customer account model tied to bookings. That prevents:
- repeat customers from managing their own history
- a reliable "my bookings" view
- secure self-service cancel/reschedule flows
- profile reuse across future bookings

## Proposed Product Shape

### Client permissions
- Can sign in and access only their own account area
- Can edit own profile fields stored on `users`
- Can view only bookings that belong to them
- Can cancel or reschedule only eligible future bookings
- Cannot access admin, receptionist, or staff screens

### Internal roles remain unchanged
- `admin`: full access
- `user`: internal staff/reception role for admin-area workflows
- `staff`: professional/personal settings role
- `client`: customer self-service role

## Data Model Direction

### Role model
- Extend `users.role` from `admin | user | staff` to `admin | user | staff | client`

### Booking ownership
- Add nullable `userId` FK on `bookings` referencing `users.id`
- New bookings made while authenticated as a client should store `bookings.userId`
- Guest bookings remain supported with `userId = null`

### Legacy booking visibility
- Existing bookings were created before booking ownership existed
- For the first version, allow client booking lookup by normalized email match when `userId` is null
- Newer writes should prefer explicit `userId` ownership over email matching

## Product Decisions

### Dedicated client area
- Use a dedicated customer-facing route group such as `/account/*`
- Do not reuse the admin dashboard UI for clients
- Admin/staff/internal roles keep the current `/admin` and `/staff` flows

### Self-service boundaries for v1.0
- Allow clients to cancel or reschedule only their own future bookings
- Do not allow clients to change service composition, pricing, or payment method in this milestone
- Do not allow clients to edit someone else's booking, even if they know the booking ID

### Reschedule behavior
- Reuse the existing availability validation path instead of inventing a separate scheduling engine
- Preserve booking items and pricing during reschedule unless a later milestone explicitly adds editable carts

## Technical Impact Areas

- `shared/schema.ts` — role union and `bookings.userId`
- `server/lib/auth.ts` — auth role resolution and route protection helpers
- `client/src/context/AuthContext.tsx` — include `client` in role handling
- `client/src/pages/AdminLogin.tsx` and routing entrypoints — redirect clients to the account area
- `server/routes/bookings.ts` and/or new client routes — ownership-safe booking reads and actions
- `server/storage.ts` — list/query bookings by owner and update flows for client actions

## Risks To Address In Planning

- Avoid breaking guest checkout while adding authenticated ownership
- Avoid exposing admin booking endpoints to clients
- Define exactly when email fallback is allowed and how conflicts are resolved
- Ensure cancel/reschedule side effects stay consistent with GHL sync, notifications, and payment status
- Keep route guards explicit so `client` does not fall through to admin or staff logic

## Goals

1. Add `client` as a first-class authenticated role
2. Link bookings to authenticated clients via `bookings.userId`
3. Provide secure self-service API surface for profile + own bookings
4. Provide a simple client portal UI for profile editing and booking management
5. Preserve guest booking and current internal-role behavior

## Resolved Assumptions

- The new customer-facing role name is `client`, not `customer`, to align with the existing `user` role naming and avoid route/API ambiguity
- Guest checkout remains supported; account ownership is additive, not mandatory
- Legacy booking lookup may use email match as a bridge, but explicit `userId` ownership is the long-term source of truth
- v1.0 self-service is limited to personal info, booking history, cancellation, and rescheduling

---
*Created: 2026-04-04*
*Handoff to: future planning/execution after v0.9*
