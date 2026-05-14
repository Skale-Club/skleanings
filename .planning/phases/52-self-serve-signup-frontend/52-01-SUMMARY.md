---
phase: 52
plan: "01"
subsystem: frontend
tags: [signup, public-page, auth-redirect, brand-yellow, subdomain-preview]
dependency_graph:
  requires: [51-01]
  provides: [public-signup-page, signup-route]
  affects: [client/src/App.tsx]
tech_stack:
  added: []
  patterns: [controlled-state-per-field, lazy-route, provider-wrapping]
key_files:
  created:
    - client/src/pages/Signup.tsx
  modified:
    - client/src/App.tsx
decisions:
  - "Wrap /signup route with AdminTenantAuthProvider inline (not in isAdminRoute block) so Signup.tsx can use useAdminTenantAuth() while still rendering with Navbar/Footer from the public Switch"
metrics:
  duration_minutes: 8
  completed_date: "2026-05-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 52 Plan 01: Self-Serve Signup Frontend Summary

**One-liner:** Public /signup page with live .xkedule.com subdomain preview, field-level inline validation, brand yellow CTA, and cross-subdomain redirect on 201 response.

## What Was Built

Created `client/src/pages/Signup.tsx` — a public signup form for new business owners — and registered it as a route in `client/src/App.tsx`.

### Signup.tsx features

- Five controlled fields (companyName, slug, email, password, confirmPassword) using useState per field, matching AdminLogin.tsx pattern
- Live subdomain preview: slug input + static `.xkedule.com` suffix side by side (rounded-r-none / rounded-r-md border split)
- Client-side validation before any fetch: required fields, slug regex `/^[a-z0-9-]+$/` with min length 2, password min 8 chars, confirm password match
- Inline errors displayed below each field using `text-destructive`
- POST /api/auth/signup on submit — 201 triggers `window.location.href = adminUrl` (cross-subdomain redirect), 409/400 maps `field` to inline error, other failures set `errors.form`
- Auth redirect: `useAdminTenantAuth()` + `useEffect` sends already-authenticated admins to /admin
- Loading spinner guard during auth check (matches AdminLogin pattern)
- Brand yellow CTA: `bg-[#FFFF01] text-black font-bold rounded-full`
- "Already have an account? Sign in" footer link to /admin/login

### App.tsx changes

- Added lazy import for Signup (line 95, after ResetPassword)
- Added `/signup` Route in the public Switch block (with Navbar/Footer), before `/reset-password`
- Wrapped Signup route component with `AdminTenantAuthProvider` inline so `useAdminTenantAuth()` context is available without moving route to isAdminRoute block

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all form fields are wired, all API responses are handled, no placeholder data.

## Self-Check: PASSED

- `client/src/pages/Signup.tsx` exists: FOUND
- `client/src/App.tsx` contains `path="/signup"`: FOUND (line 229)
- Commit 7d2b5f4 (Signup.tsx): FOUND
- Commit 1834138 (App.tsx route): FOUND
- `npm run check` passes: CONFIRMED
