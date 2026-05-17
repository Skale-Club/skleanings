---
id: SEED-015
status: shipped
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when there are 3+ active tenants, or before implementing multi-tenancy
scope: Medium
---

# SEED-015: Super-admin panel (manage all tenants from one panel)

## Why This Matters

With multiple tenants, the team operating the product needs an interface to see all clients, check the health of each instance, apply config patches in bulk, see aggregate usage metrics, and access the admin of any tenant for support. Today this is done directly in the database.

**Why:** Without super-admin, operating 5+ tenants means SSH into the database, manual queries, and zero visibility into which tenant has a problem. It's the kind of operational debt that explodes when the base grows.

## When to Surface

**Trigger:** when there are 3+ active tenants, or when starting the multi-tenancy milestone (SEED-013), since super-admin is a prerequisite for managing the migration.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Operations / multi-tenant milestone
- Together with SEED-013 (multi-tenant architecture)
- When starting to grow to 5+ tenants

## Scope Estimate

**Medium** — One phase. Follow the `skaleclub-websites` pattern: super-admin lives at a dedicated host (e.g., `xkedule.skale.club` or `admin.xkedule.com`), host-gated middleware ensures `/api/super-admin/*` routes only respond on that host.

Minimum features: list all tenants (name, plan, status, last access, bookings/month), impersonation (access any tenant's admin as support), per-tenant health check (DB connected?, migrations applied?), bulk update action on settings, error logs, storage usage.

## Breadcrumbs

- Reference: `skaleclub-websites` super-admin at `websites.skale.club` — same pattern to replicate
- `server/middleware/auth.ts` — existing role system (admin/staff/viewer) — super-admin would be a new role above admin
- `shared/schema.ts` — `users` table with `isAdmin` and `role` — new `superadmin` role
- `server/routes/` — new `/api/super-admin/*` routes with separate guard
- `client/src/pages/admin/` — new UI module outside the tenant's normal admin
- Security: super-admin routes require IP allowlist or mandatory MFA

## Notes

Super-admin panel is a separate product from tenant admin — same stack, separate deploy or protected sub-route (e.g., `/superadmin`). Never expose super-admin routes on the same endpoints as tenant admin — attack surface too large.

The `skaleclub-websites` pattern uses host-gating: requests to `websites.skale.club` get super-admin context, requests to tenant domains don't. Copy this approach for Xkedule.
