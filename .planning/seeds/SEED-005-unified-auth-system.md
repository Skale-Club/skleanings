---
id: SEED-005
status: dormant
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: when expanding customer portal features, or adding social login
scope: Large
---

# SEED-005: Unify authentication system (Supabase Auth for admin and customers)

## Why This Matters

The current system has two parallel authentication mechanisms: Supabase Auth for admins (magic link / password via Supabase) and session-based bcrypt authentication for customers (customer portal). This results in two different middlewares, two login flows, two cookie types, and conditional logic in several endpoints.

The comment in `server/lib/auth.ts` documents that `authenticatedRequest` uses Supabase Bearer token while `apiRequest` uses session cookie — Phase 14 already hit a bug because of this (customer type-ahead had to use `apiRequest` instead of `authenticatedRequest`).

**Why:** Each new customer portal feature increases the chance of using the wrong mechanism. The decision recorded in STATE.md confirms this is a known risk.

## When to Surface

**Trigger:** when expanding the customer portal with new features (purchase history, email notifications, saved preferences), or when adding social login (Google, Apple).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Customer portal expansion milestone
- Social login / OAuth milestone for customers
- Post-White Label v2.0 milestone focused on user experience

## Scope Estimate

**Large** — A complete milestone. Migrate customers to Supabase Auth, map roles (admin/staff/viewer/customer) in Supabase JWT claims, remove bcrypt session-based auth, unify middleware.

## Breadcrumbs

- `server/lib/auth.ts` — `getAuthenticatedUser()`, two parallel mechanisms
- `server/middleware/auth.ts` — route protection
- `client/context/AuthContext.tsx` — client-side auth state
- `client/src/pages/ClientLogin.tsx` — customer portal login
- `client/src/pages/AccountShell.tsx` — authenticated customer portal
- `server/routes.ts` — `/api/client/*` endpoints with bcrypt session

## Notes

The architectural decision was documented as "works but adds complexity". Unification requires existing customers to migrate their passwords (could be a forced reset with email link). Consider a transition period with dual fallback before removing bcrypt.
