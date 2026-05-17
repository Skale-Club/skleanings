---
phase: 57-staff-invitation-backend
verified: 2026-05-14T00:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "End-to-end invitation flow — admin invites staff, staff receives email, clicks link, accepts and lands on /admin"
    expected: "Email is delivered via Resend with branded HTML; clicking CTA opens accept-invite page; submitting password creates account; session is established; redirect lands on tenant /admin"
    why_human: "Requires Resend API key, live mail delivery, and a real tenant subdomain — not testable via grep/static analysis"
  - test: "Token-hash safety — verify only SHA-256 hash is stored, raw token never persisted"
    expected: "Inspecting staff_invitations row in DB shows token_hash column populated with 64-char hex; raw token returned from createStaffInvitation only available in memory during the API call"
    why_human: "Requires running migration (supabase db push) and DB inspection — migration is documented as pending in 57-01-SUMMARY"
  - test: "Atomic transaction rollback — simulate user creation failure and verify user_tenants is also not inserted and invitation is NOT marked accepted"
    expected: "If users.insert throws (e.g. duplicate email), tx rolls back; user_tenants has no row; invitation.acceptedAt remains null"
    why_human: "Requires runtime error injection — static analysis confirms db.transaction wraps both inserts and markInvitationAccepted is OUTSIDE the try block"
---

# Phase 57: Staff Invitation Backend Verification Report

**Phase Goal:** Tenant admins can invite staff members by email via a token-secured flow — the invitation is persisted, a branded email is sent, and all token lifecycle operations (validate, accept, revoke) are exposed as API endpoints.
**Verified:** 2026-05-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | staff_invitations table exists in migration with token_hash, tenant_id, expires_at, accepted_at columns | VERIFIED | supabase/migrations/20260520000000_phase57_staff_invitations.sql lines 5-14 — all required columns + 2 indexes |
| 2  | staffInvitations Drizzle table + StaffInvitation type exported from shared/schema.ts | VERIFIED | shared/schema.ts:94-106 — table declaration + InsertStaffInvitation/StaffInvitation type exports |
| 3  | IStorage has 5 invitation methods | VERIFIED | server/storage.ts:467-471 — all 5 method signatures present in interface |
| 4  | DatabaseStorage implements all 5 invitation methods | VERIFIED | server/storage.ts:2637-2679 — createStaffInvitation, findStaffInvitation, markInvitationAccepted, revokeStaffInvitation, getPendingInvitations |
| 5  | createStaffInvitation returns raw token and persists only SHA-256 hash | VERIFIED | server/storage.ts:2638-2642 — crypto.randomBytes(32).toString('hex'), SHA-256 hash persisted, raw token returned |
| 6  | findStaffInvitation excludes accepted and expired rows | VERIFIED | server/storage.ts:2645-2657 — isNull(acceptedAt) + gte(expiresAt, now()) filters |
| 7  | POST /api/admin/staff/invite guarded by requireAdmin, creates invitation, fires Resend email | VERIFIED | server/routes/staff-invitations.ts:22-54 — requireAdmin guard, Zod validation, createStaffInvitation call, fire-and-forget IIFE for sendResendEmail |
| 8  | DELETE /api/admin/staff/invite/:id returns 404 for not found | VERIFIED | server/routes/staff-invitations.ts:91 — returns 404 when no row matches in tenant scope |
| 9  | DELETE /api/admin/staff/invite/:id returns 409 for already-accepted | VERIFIED | server/routes/staff-invitations.ts:74-90 — direct db query checks isNotNull(acceptedAt) and returns 409 |
| 10 | GET /api/admin/staff/invitations lists pending for tenant | VERIFIED | server/routes/staff-invitations.ts:99-109 — requireAdmin guarded, calls storage.getPendingInvitations(tenant.id) |
| 11 | buildInviteEmail is pure function exported from email-resend.ts | VERIFIED | server/lib/email-resend.ts:262-299 — pure function, no side effects, uses brand colors (#1C53A3 heading, #FFFF01 pill CTA) |
| 12 | staffInvitationRouter mounted at /api/admin after resolveTenantMiddleware | VERIFIED | server/routes.ts:31 import, line 42 resolveTenantMiddleware, line 112 mount |
| 13 | GET /api/auth/validate-invite returns invitation metadata for valid token | VERIFIED | server/routes/auth.ts:281-322 — SHA-256 hash lookup via storage.findStaffInvitation, returns { email, role, companyName, tenantId } |
| 14 | GET /api/auth/validate-invite returns 410 for invalid/expired/used token | VERIFIED | server/routes/auth.ts:292-294 — 410 Gone response when findStaffInvitation returns null |
| 15 | POST /api/auth/accept-invite atomically creates user + user_tenants in transaction | VERIFIED | server/routes/auth.ts:359-387 — db.transaction wraps both inserts; markInvitationAccepted called only after success on line 397 |
| 16 | POST /api/auth/accept-invite marks invitation accepted and establishes session | VERIFIED | server/routes/auth.ts:397 (markInvitationAccepted), lines 400-405 (req.session.adminUser) |
| 17 | POST /api/auth/accept-invite returns { adminUrl } | VERIFIED | server/routes/auth.ts:408-412 — adminUrl resolved from primary domain or hostname fallback |
| 18 | npm run check passes with no TypeScript errors | VERIFIED | tsc exit 0, no error output |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/20260520000000_phase57_staff_invitations.sql` | DDL for staff_invitations table + indexes | VERIFIED | Contains CREATE TABLE with all 7 required columns + 2 indexes |
| `shared/schema.ts` | staffInvitations table + StaffInvitation type | VERIFIED | Lines 94-106; tenantId FK references tenants.id with CASCADE |
| `server/storage.ts` | 5 IStorage methods + DatabaseStorage impls | VERIFIED | Interface lines 467-471, implementations lines 2637-2679 |
| `server/routes/staff-invitations.ts` | staffInvitationRouter with 3 endpoints | VERIFIED | 110 lines, POST/DELETE/GET routes, all requireAdmin-guarded |
| `server/routes.ts` | staffInvitationRouter mounted at /api/admin | VERIFIED | Import line 31, mount line 112 (after resolveTenantMiddleware at line 42) |
| `server/lib/email-resend.ts` | buildInviteEmail() pure function | VERIFIED | Lines 262-299, brand colors present (#1C53A3, #FFFF01), pill CTA (border-radius: 9999px) |
| `server/routes/auth.ts` | validate-invite + accept-invite routes | VERIFIED | Lines 281-322 (validate), lines 328-413 (accept); db.transaction at 359, markInvitationAccepted at 397 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| server/storage.ts | shared/schema.ts staffInvitations | Drizzle import + db queries | WIRED | Import of staffInvitations and 5 db calls (insert/select/update/delete) |
| createStaffInvitation | staff_invitations DB row | db.insert(staffInvitations) | WIRED | server/storage.ts:2641 |
| POST /api/admin/staff/invite | storage.createStaffInvitation | res.locals.storage | WIRED | server/routes/staff-invitations.ts:36 |
| POST /api/admin/staff/invite | sendResendEmail + buildInviteEmail | fire-and-forget void IIFE | WIRED | server/routes/staff-invitations.ts:42-51 |
| server/routes.ts | staffInvitationRouter | app.use("/api/admin", staffInvitationRouter) | WIRED | server/routes.ts:112 |
| GET /auth/validate-invite | storage.findStaffInvitation | SHA-256 hash of raw token query param | WIRED | server/routes/auth.ts:289-290 |
| POST /auth/accept-invite | db.transaction | atomic users insert + userTenants insert | WIRED | server/routes/auth.ts:359-387, both inserts in same tx |
| POST /auth/accept-invite | storage.markInvitationAccepted | invitation.id after transaction | WIRED | server/routes/auth.ts:397 — called AFTER tx commits, outside try/catch |
| authRouter | app | app.use("/api", authRouter) | WIRED | server/routes.ts:46 — validate-invite and accept-invite routes mounted via existing /api router |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| staff-invitations.ts POST | rawToken | storage.createStaffInvitation → crypto.randomBytes(32) + db.insert | Yes (real token, real DB row) | FLOWING |
| staff-invitations.ts DELETE | pending | storage.getPendingInvitations → db.select with isNull filter | Yes (real query) | FLOWING |
| staff-invitations.ts DELETE | accepted | Direct db.select with isNotNull(acceptedAt) filter | Yes (real query) | FLOWING |
| staff-invitations.ts GET | invitations | storage.getPendingInvitations → db.select with isNull filter | Yes (real query) | FLOWING |
| auth.ts validate-invite | invitation | storage.findStaffInvitation → db.select with acceptedAt+expiresAt filter | Yes (real query) | FLOWING |
| auth.ts validate-invite | companyName | storage.getCompanySettings OR db.select companySettings | Yes (with fallback) | FLOWING |
| auth.ts accept-invite | newUserId | db.transaction → tx.insert(users).returning() | Yes (real insert) | FLOWING |
| auth.ts accept-invite | adminHostname | tx.select(domains).where(isPrimary=true) | Yes (real query, falls back to req.hostname) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles | `npm run check` | exit 0, no errors | PASS |
| Migration file syntactically valid SQL | static read | CREATE TABLE + CREATE INDEX statements parseable | PASS |
| Router exports correctly | grep export | `export const staffInvitationRouter = Router()` present | PASS |
| Storage methods callable | grep await usage | 7 call sites across staff-invitations.ts and auth.ts | PASS |
| Live invitation send (Resend API) | `curl POST /api/admin/staff/invite` | Cannot run — requires dev server + admin session + Resend key | SKIP |
| End-to-end accept flow | manual browser test | Cannot run — requires UI (Phase 58) + live email | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SF-01 | 57-02 | POST /api/admin/staff/invite + branded email | SATISFIED | server/routes/staff-invitations.ts:22-54 + buildInviteEmail at email-resend.ts:262 |
| SF-02 | 57-01 | staff_invitations table (migration + Drizzle) with all required columns | SATISFIED | Migration SQL + shared/schema.ts:94-106 |
| SF-03 | 57-03 | GET /api/auth/validate-invite returns metadata or 410 | SATISFIED | server/routes/auth.ts:281-322 |
| SF-04 | 57-03 | POST /api/auth/accept-invite atomic user + user_tenants + session + adminUrl | SATISFIED | server/routes/auth.ts:328-413, db.transaction at 359 |
| SF-05 | 57-02 | DELETE /api/admin/staff/invite/:id with 409 for accepted | SATISFIED | server/routes/staff-invitations.ts:57-96 with explicit 409 branch at line 88 |

All 5 phase requirements satisfied. No orphaned requirements (REQUIREMENTS.md SF-06/SF-07 mapped to Phase 58, not 57).

Note: REQUIREMENTS.md traceability table still shows SF-01 and SF-05 as "Pending" — this is a STATE/REQUIREMENTS.md sync drift, NOT a code gap. The implementation is complete; only the requirements checkboxes lag.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TODO/FIXME/placeholder/stub patterns found | — | — |

Empty handlers, hardcoded empty data, console.log-only impls: none.

### Human Verification Required

1. **End-to-end invitation flow** — Admin invites staff via POST /api/admin/staff/invite; verify email arrives with branded HTML, CTA links to /accept-invite?token=..., clicking accepts and redirects to tenant /admin.
   - Expected: Resend email delivered, accept flow creates user + session, redirect lands at adminUrl.
   - Why human: Requires Resend API key, live mail delivery, real tenant subdomain.

2. **Migration applied to DB** — Run `supabase db push` and verify staff_invitations table is created with expected schema.
   - Expected: Table exists with 7 columns and 2 indexes; INSERT works at runtime.
   - Why human: Migration documented as pending in 57-01-SUMMARY.md — runtime functionality blocked until applied.

3. **Atomic transaction rollback** — Trigger a failure inside db.transaction (e.g. duplicate email) and verify rollback semantics.
   - Expected: No partial row in users or user_tenants; invitation.acceptedAt remains null.
   - Why human: Requires runtime error injection.

### Gaps Summary

No gaps. All 18 observable truths verified, all 7 required artifacts present and substantive, all 9 key links wired, all 8 data flows trace to real DB queries, all 5 requirements satisfied, no anti-patterns detected, and `npm run check` exits clean.

The phase goal — "Tenant admins can invite staff members by email via a token-secured flow — the invitation is persisted, a branded email is sent, and all token lifecycle operations (validate, accept, revoke) are exposed as API endpoints" — is achieved at the code level. The remaining items in "Human Verification Required" are runtime/integration checks (live Resend delivery, DB migration application, transaction rollback semantics) that cannot be confirmed via static analysis but for which the implementing code is correct as written.

Note for orchestrator: REQUIREMENTS.md traceability checkboxes for SF-01 and SF-05 still show "Pending" / `[ ]`. This is documentation drift — code is complete. Recommend updating REQUIREMENTS.md to mark SF-01 and SF-05 as Complete during the phase-completion bundle.

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
