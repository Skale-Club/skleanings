---
phase: 58-staff-invitation-frontend
verified: 2026-05-14T00:00:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 58: Staff Invitation Frontend Verification Report

**Phase Goal:** Staff complete account setup via public /accept-invite page; admins manage pending invitations from /admin/staff (rendered in UnifiedUsersSection).
**Verified:** 2026-05-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Visiting /accept-invite?token=... with a valid token renders a form pre-filled with the invited email and showing the company name + role | VERIFIED | AcceptInvite.tsx lines 41-58 fetch validate-invite, set invite state with {email, companyName, role}; lines 147-150 render company name + role; lines 156-162 render disabled email Input with invite.email |
| 2 | Visiting /accept-invite with an invalid or expired token (server returns 410) renders an "Invitation expired or already used" error state with no form | VERIFIED | AcceptInvite.tsx lines 44-46, 95-97 set status='invalid' on non-ok / 410; lines 123-138 render invalid-state Card with exact copy "Invitation expired or already used" and no form |
| 3 | Submitting the form with valid name + matching passwords POSTs to /api/auth/accept-invite and redirects the browser to the returned adminUrl | VERIFIED | AcceptInvite.tsx lines 82-92: POST to /api/auth/accept-invite with {token, name, password}, on 201 reads adminUrl, sets window.location.href = adminUrl |
| 4 | Submitting passwords that do not match shows an inline confirmPassword error and does not call the API | VERIFIED | AcceptInvite.tsx lines 71-78: confirmPassword !== password sets newErrors.confirmPassword="Passwords do not match"; early return prevents fetch when newErrors non-empty |
| 5 | An admin visiting the Team/Users section sees a 'Pending Invitations' card listing every staff_invitation with acceptedAt=null for their tenant | VERIFIED | PendingInvitationsSection.tsx lines 69-79 useQuery against /api/admin/staff/invitations; Card lines 159-220 render Pending Invitations title + table; UnifiedUsersSection.tsx line 8 renders it; Admin.tsx line 223 mounts UnifiedUsersSection on activeSection==='users' |
| 6 | Clicking 'Invite Staff Member' opens a dialog with email + role fields; submitting POSTs to /api/admin/staff/invite, shows a success toast, closes the dialog, and the new invitation appears in the list without a manual refresh | VERIFIED | PendingInvitationsSection.tsx lines 162-165 button opens dialog; lines 222-283 Dialog with email Input + role Select; lines 81-113 inviteMutation POSTs to /api/admin/staff/invite, onSuccess invalidates ['/api/admin/staff/invitations'], shows toast, closes dialog |
| 7 | Clicking 'Revoke' on a pending invitation calls DELETE /api/admin/staff/invite/:id and removes the row from the list without a page reload | VERIFIED | PendingInvitationsSection.tsx lines 115-144 revokeMutation DELETEs to /api/admin/staff/invite/${id}, onSuccess invalidates list query, shows toast; lines 285-316 AlertDialog confirmation triggers mutate |
| 8 | When there are no pending invitations the section shows an empty-state message instead of an empty table | VERIFIED | PendingInvitationsSection.tsx lines 172-176: when invitations.length===0 renders centered Mail icon + "No pending invitations." text (not an empty Table) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `client/src/pages/AcceptInvite.tsx` | Public accept-invite page component, min 120 lines, contains `export default function AcceptInvite` | VERIFIED | 219 lines; contains `export default function AcceptInvite()` (line 15); three-state machine, fetch validate-invite, POST accept-invite, cross-subdomain redirect, brand-yellow CTA — all present |
| `client/src/App.tsx` | Wouter route registration including `/accept-invite` | VERIFIED | Line 96 lazy import of AcceptInvite via PageWrapper; line 238 `<Route path="/accept-invite" component={AcceptInvite} />` registered in public Switch after `/verify-email` and before `<Route component={NotFound} />` |
| `client/src/components/admin/PendingInvitationsSection.tsx` | Pending Invitations card + Invite dialog, min 160 lines, contains `export function PendingInvitationsSection` | VERIFIED | 319 lines; named export at line 58; Card+Table+empty-state+Dialog+AlertDialog all present; useQuery, inviteMutation, revokeMutation wired |
| `client/src/components/admin/UnifiedUsersSection.tsx` | Wires PendingInvitationsSection into admin Users/Team view | VERIFIED | 11 lines; imports both UsersSection and PendingInvitationsSection; renders both inside `<div className="space-y-6">` |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| client/src/pages/AcceptInvite.tsx | GET /api/auth/validate-invite | fetch on mount with token query param | WIRED | Line 43: `fetch(\`/api/auth/validate-invite?token=${encodeURIComponent(t)}\`)` inside useEffect (line 32). Backend endpoint exists at server/routes/auth.ts:281 |
| client/src/pages/AcceptInvite.tsx | POST /api/auth/accept-invite | form submit handler | WIRED | Line 82: `fetch('/api/auth/accept-invite', { method: 'POST', ... })` inside handleSubmit; body includes token+name+password. Backend endpoint exists at server/routes/auth.ts:328 |
| client/src/App.tsx | AcceptInvite component | lazy import + Wouter Route | WIRED | Line 96 lazy import; line 238 Route registration in public Switch |
| client/src/components/admin/PendingInvitationsSection.tsx | GET /api/admin/staff/invitations | useQuery with key ['/api/admin/staff/invitations'] | WIRED | Lines 69-78 useQuery with matching key + queryFn fetching the endpoint. Backend route exists at server/routes/staff-invitations.ts:99 |
| client/src/components/admin/PendingInvitationsSection.tsx | POST /api/admin/staff/invite | useMutation invalidating invitations query | WIRED | Lines 81-113 inviteMutation POSTs and onSuccess invalidates ['/api/admin/staff/invitations']. Backend route at server/routes/staff-invitations.ts:22 |
| client/src/components/admin/PendingInvitationsSection.tsx | DELETE /api/admin/staff/invite/:id | useMutation invalidating invitations query | WIRED | Lines 115-144 revokeMutation DELETEs and onSuccess invalidates query. Backend route at server/routes/staff-invitations.ts:57 |
| client/src/components/admin/UnifiedUsersSection.tsx | PendingInvitationsSection | JSX render | WIRED | Line 8 `<PendingInvitationsSection />` rendered alongside `<UsersSection />`. UnifiedUsersSection is consumed by Admin.tsx:223 when activeSection==='users' |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| AcceptInvite.tsx | `invite` (email, companyName, role) | GET /api/auth/validate-invite → storage.findStaffInvitation + DB lookup (server/routes/auth.ts:281-322, returns real DB-backed values) | Yes — server queries staff_invitations table and companySettings/domains for live tenant data | FLOWING |
| PendingInvitationsSection.tsx | `invitations` array | GET /api/admin/staff/invitations → storage method scoped to tenant via requireAdmin | Yes — backend route queries staff_invitations with acceptedAt=null filter for current tenant | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| TypeScript compiles cleanly | npx tsc --noEmit | exit 0 (no output) | PASS |
| AcceptInvite route registered | grep route in App.tsx | line 238 found | PASS |
| Backend validate-invite endpoint exists | grep in server/routes/auth.ts | line 281 found | PASS |
| Backend accept-invite endpoint exists | grep in server/routes/auth.ts | line 328 found | PASS |
| Backend admin invite endpoints exist | grep in server/routes/staff-invitations.ts | lines 22, 57, 99 found (POST/DELETE/GET) | PASS |
| UnifiedUsersSection mounted in Admin.tsx | grep in Admin.tsx | line 223 found, conditional on activeSection==='users' | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| SF-06 | 58-01 | `/accept-invite` public page — fetches GET validate-invite on load; shows company name + pre-filled email + form; submits POST accept-invite; on success redirects to tenant `/admin`; on 410 shows expired error | SATISFIED | AcceptInvite.tsx implements all behaviors (lines 32-58 for load, 82-112 for submit, 89-92 for redirect, 123-138 for 410 state). REQUIREMENTS.md line 21 already marked [x]. |
| SF-07 | 58-02 | Pending invitations section in `/admin/staff` — lists acceptedAt=null with email/role/expiry + Revoke; "Invite Staff Member" dialog with email + role fields | SATISFIED | PendingInvitationsSection.tsx covers listing, invite dialog, revoke flow; UnifiedUsersSection.tsx wires it; Admin.tsx:223 mounts it on `users` section. Note: REQUIREMENTS.md line 22/52 still marks SF-07 as "[ ] Pending" — should be updated to reflect completion. |

No orphaned requirements found (REQUIREMENTS.md only maps SF-06, SF-07 to Phase 58).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| AcceptInvite.tsx | 171, 184, 197 | `placeholder="..."` | Info | False positive — HTML Input `placeholder` attribute providing UX hints (not stub markers) |
| PendingInvitationsSection.tsx | 246, 259 | `placeholder="..."` | Info | False positive — same as above |

No blocker or warning anti-patterns. No TODO/FIXME, no empty implementations, no hardcoded-empty data flowing to render, no console.log-only handlers.

### Human Verification Required

While automated checks pass, the following user-facing flows benefit from a live end-to-end smoke test (already noted in plan verifications). These do not block the verification pass but should be performed before closing the milestone:

1. **End-to-end invite acceptance**
   - Test: Log in as a tenant admin, send an invite to a test email, click the invite link, complete the form, confirm cross-subdomain redirect lands inside the tenant `/admin`.
   - Expected: New user lands on the inviting tenant's admin panel, authenticated.
   - Why human: Requires actual email delivery (Resend) + cross-subdomain cookie/session behavior + DNS resolution per tenant — cannot be reproduced via grep.

2. **Revoke flow visual confirmation**
   - Test: From /admin/users, click the trash icon on a pending invitation, confirm the AlertDialog, verify the row disappears.
   - Expected: Row removed, toast appears, list refreshes without page reload.
   - Why human: React Query invalidation timing + Toast UX + AlertDialog dismiss behavior — visual concerns not grep-detectable.

3. **Empty state appearance**
   - Test: Visit /admin/users in a tenant with zero pending invitations.
   - Expected: Mail icon + "No pending invitations." copy, not an empty table.
   - Why human: Visual rendering verification.

### Gaps Summary

None. All 8 observable truths are backed by substantive, wired artifacts with real data flowing from the verified Phase 57 backend endpoints. TypeScript compiles cleanly. The four key files (AcceptInvite.tsx, App.tsx route registration, PendingInvitationsSection.tsx, UnifiedUsersSection.tsx) are present, properly sized, and contain all required patterns from the plan must_haves.

Minor housekeeping (non-blocking): REQUIREMENTS.md still shows SF-07 as `[ ] Pending` (line 22) and the requirement-status table row at line 52 shows `Pending`. This is documentation drift, not an implementation gap — the code itself fully implements SF-07.

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
