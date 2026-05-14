# Requirements — v15.0 Tenant Onboarding Experience

**Milestone:** v15.0 Tenant Onboarding Experience
**Goal:** New tenants get a smooth first-run experience — email verification prevents spam signups, a welcome email confirms account creation, and an in-app setup checklist guides admins through minimum viable configuration.
**Status:** Active

---

## Milestone Requirements

### Email Verification (Phase 55)

- [x] **OB-01**: On successful signup, the system sends a verification email via Resend containing a unique time-limited token (24h expiry) — the email includes the tenant's company name and a "Verify Email" CTA button linking to `/verify-email?token=...`
- [x] **OB-02**: `GET /api/auth/verify-email?token=...` validates the token, sets `users.emailVerifiedAt` timestamp, and redirects to `/admin` — an expired or already-used token returns a clear error page
- [ ] **OB-03**: A `email_verification_tokens` table (Supabase migration + Drizzle schema) stores SHA-256 token hash, userId, expiresAt, usedAt — same pattern as `password_reset_tokens` from Phase 47
- [ ] **OB-04**: Admin pages show a dismissible yellow banner "Please verify your email — check your inbox" when `emailVerifiedAt` is null — the banner includes a "Resend verification email" link that calls `POST /api/auth/resend-verification`

### Welcome Email (Phase 55)

- [x] **OB-05**: On successful signup, a welcome email is sent via Resend (alongside the verification email) containing the admin URL (`https://[slug].xkedule.com/admin`) and a brief "3 next steps" guide (add a service, add a staff member, configure availability)

### Setup Checklist (Phase 56)

- [ ] **OB-06**: `/admin` dashboard shows a "Setup Checklist" card when the tenant has not completed all 3 items — each item is checked live against the DB: (1) has at least 1 service, (2) has at least 1 staff member, (3) has at least 1 availability window
- [ ] **OB-07**: `GET /api/admin/setup-status` returns `{ hasService: boolean, hasStaff: boolean, hasAvailability: boolean, dismissed: boolean }` — guarded by `requireAdmin`, reads from `res.locals.storage`
- [ ] **OB-08**: The checklist card is dismissible — `POST /api/admin/setup-dismiss` saves a `setupDismissedAt` timestamp on the tenant's `companySettings` row; dismissed tenants never see the checklist again even if items are incomplete

---

## Future Requirements

- Email verification required before booking page is visible to customers
- Staff invitation flow (invite by email, not just super-admin provision)
- Admin onboarding video/tutorial integration
- Customizable onboarding checklist per plan tier

## Out of Scope

| Feature | Reason |
|---------|--------|
| Block booking page until verified | Adds friction — warn only for MVP |
| Staff invitation emails | v16.0 after onboarding basics validated |
| Require verification before billing | Admin can still access billing unverified |
| Multi-step onboarding wizard | Checklist sufficient for MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OB-01 | Phase 55 | Complete |
| OB-02 | Phase 55 | Complete |
| OB-03 | Phase 55 | Pending |
| OB-04 | Phase 55 | Pending |
| OB-05 | Phase 55 | Complete |
| OB-06 | Phase 56 | Pending |
| OB-07 | Phase 56 | Pending |
| OB-08 | Phase 56 | Pending |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14*
