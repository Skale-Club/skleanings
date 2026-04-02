# Phase 06: Unified Users & Roles — Discussion Context

## Vision

Restructure the entire user model into a single unified "Users" page with three distinct roles: Admin, User, and Staff. Currently `users` and `staffMembers` are completely separate tables/entities. The new model bridges them so every person in the system is a "user" with a role, and staff-specific data remains in the existing `staffMembers` table (preserving all availability/calendar/booking dependencies).

## Roles

| Role | Description | Permissions |
|------|------------|-------------|
| **Admin** | Business owner | Everything: integrations, create admin/user/staff, system settings |
| **User** | Receptionist / attendant (like a barbershop front-desk person) | View all calendars, create/manage staff, view bookings. Cannot: manage integrations, create admin, be booked for services |
| **Staff** | Cleaning professional | Edit own profile + calendar only. Cannot: see user list, manage anyone, access admin features |

## Key Constraint: Staff is NOT a user role in terms of login

Wait — actually Staff DOES need to log in to edit their profile. So:
- All three roles need auth (email + password)
- All three roles live in the `users` table with a `role` column
- When role = "staff", there's also a `staffMembers` record linked via `userId` FK

## Data Model Approach: Bridge (not unification)

**Why bridge, not unify:**
- `staffMembers.id` is referenced everywhere: `staffServiceAbilities`, `staffAvailability`, `staffGoogleCalendar`, `bookings.staffMemberId`, availability engine, booking flow
- Unifying into one table would require rewriting all of these references — massive risk for no business value
- Bridge: add `role` enum to `users` table + `userId` FK on `staffMembers` → minimal migration, all existing code works

**Schema changes needed:**
1. `users` table: add `role` column (enum: 'admin' | 'user' | 'staff'), add `firstName`, `lastName`, `phone`, `profileImageUrl` columns
2. `staffMembers` table: add nullable `userId` FK referencing `users.id`
3. Keep existing `staffMembers` fields (bio, isActive, order) — these are staff-specific

## UI Changes

### Admin / User view — "Users" page
- Single flat list of all users (no tabs)
- Each row shows: avatar, name, email, role badge
- "Add User" button → dialog asking: role (Staff / User / Admin), name, email, password, avatar upload
  - If role = Staff, also creates a `staffMembers` record linked to the user
  - Only Admin sees "Admin" option in role picker
  - User sees only "Staff" option
- Click row → edit dialog with role-appropriate fields

### Staff view — Personal settings page
- Staff logs in and sees ONLY their own profile
- Can edit: name, phone, bio, avatar, calendar connection
- Cannot: see other users, navigate to admin sections
- Route: `/staff/settings` or similar

### Avatar upload
- File upload required when creating/editing users
- Use existing upload pattern in the codebase

## Goals

1. Add `role` column to `users` table (admin/user/staff enum)
2. Bridge `staffMembers` to `users` via `userId` FK
3. Unified "Users" page: flat list, role badges, Add User with role picker
4. Staff login → personal settings page only
5. Role-based route protection (staff can't access admin pages)
6. Avatar file upload on user creation/edit

## Approach Notes

- Migrate existing admin users → role = 'admin'
- Keep backward compatibility: existing staffMembers without userId still work
- Auth system needs to return role in session/token
- Frontend routing needs role-based guards

## Resolved Questions

- **Existing staffMembers:** Only one admin exists. No legacy staff to migrate. Fresh start.
- **Login flow:** Same /admin/login for everyone. Redirect based on role after auth.
- **Admin in user list:** The single existing admin must appear in the Users list alongside everyone else.

---
*Created: 2026-04-02*
*Handoff to: /paul:plan*
