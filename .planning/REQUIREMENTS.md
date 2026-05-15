# Requirements — v16.0 Staff Invitation Flow

**Milestone:** v16.0 Staff Invitation Flow
**Goal:** Tenant admins can invite staff members by email — no super-admin intervention required. Staff accept the invite, set their password, and are immediately logged in and associated with the tenant.
**Status:** Active

---

## Milestone Requirements

### Invitation Backend (Phase 57)

- [x] **SF-01**: Tenant admin calls `POST /api/admin/staff/invite` with `{ email, role }` — the system creates a `staff_invitations` row with SHA-256 token hash (48h expiry) and sends a branded Resend email with an "Accept Invitation" CTA linking to `/accept-invite?token=...`
- [x] **SF-02**: `staff_invitations` table (Supabase migration + Drizzle schema) stores: `id`, `tenantId`, `email`, `role`, `tokenHash`, `expiresAt`, `acceptedAt`, `createdAt`
- [x] **SF-03**: `GET /api/auth/validate-invite?token=...` (public) validates the token hash, returns `{ email, tenantId, companyName, role }` if valid — returns 410 Gone for expired/used tokens
- [x] **SF-04**: `POST /api/auth/accept-invite` (public) validates token, creates a `users` row + `user_tenants` row atomically, marks `acceptedAt`, creates an admin session, returns `{ adminUrl }` for redirect — returns 410 if token invalid/expired
- [x] **SF-05**: `DELETE /api/admin/staff/invite/:id` (requireAdmin) revokes a pending invitation — only works if `acceptedAt` is null; returns 409 if already accepted

### Invitation Frontend (Phase 58)

- [x] **SF-06**: `/accept-invite` public page — fetches `GET /api/auth/validate-invite?token=...` on load; shows company name + pre-filled email + Name + Password + Confirm Password form; submits `POST /api/auth/accept-invite`; on success redirects to the tenant's `/admin` URL; on 410 shows "Invitation expired or already used" error
- [ ] **SF-07**: Pending invitations section in `/admin/staff` — lists invitations where `acceptedAt` is null, showing email + role + expiry + Revoke button that calls `DELETE /api/admin/staff/invite/:id` and removes the row; also shows "Invite Staff Member" button that opens a dialog with email + role fields

---

## Future Requirements

- Invitation resend (re-send invite email to existing pending invitation)
- Invitation expiry extension (super-admin or admin can extend 48h window)
- Bulk invitation (CSV upload of emails)
- Staff login portal (separate from admin — view own schedule, manage availability)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Resend invitation | Not blocking for MVP; manual revoke + re-invite is sufficient |
| Staff-facing login portal | v17.0+ — requires separate auth flow and UI |
| Bulk CSV invitations | Niche need; single invite sufficient for MVP |
| Role-based permissions beyond admin/staff | Feature flags not yet implemented |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SF-01 | Phase 57 | Complete |
| SF-02 | Phase 57 | Complete |
| SF-03 | Phase 57 | Complete |
| SF-04 | Phase 57 | Complete |
| SF-05 | Phase 57 | Complete |
| SF-06 | Phase 58 | Complete |
| SF-07 | Phase 58 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14*
