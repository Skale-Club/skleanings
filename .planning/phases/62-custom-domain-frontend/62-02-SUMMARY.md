---
phase: 62-custom-domain-frontend
plan: 02
subsystem: super-admin
tags: [super-admin, domains, verification, ui]
requires:
  - shared/schema.ts#domains.verified
  - shared/schema.ts#domains.verifiedAt
  - GET /api/super-admin/tenants/:id/domains
  - DELETE /api/super-admin/domains/:id
provides:
  - ManageDomainsDialog Status column (Primary | Verified | Pending Verification)
  - Destructive confirm copy surfacing UNVERIFIED state on removal
  - DomainRow.verified / DomainRow.verifiedAt frontend type fields
affects:
  - client/src/pages/SuperAdmin.tsx
  - client/src/hooks/useSuperAdmin.ts
tech-stack:
  added: []
  patterns:
    - "Inline StatusBadge helper colocated with consumer component"
    - "Priority-ladder badge resolution (Primary > Verified > Pending)"
key-files:
  created: []
  modified:
    - client/src/hooks/useSuperAdmin.ts
    - client/src/pages/SuperAdmin.tsx
decisions:
  - "Kept window.confirm (vs. shadcn AlertDialog) — file already uses confirm/alert; AlertDialog would be more diff churn than value"
  - "Did NOT add verificationToken to DomainRow — super-admin endpoint deliberately omits the token (only tenant-side POST returns it)"
  - "Remove button remains enabled for unverified non-primary domains — super-admin can remove anything that isn't the primary"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-15"
  tasks: 2
  files: 2
---

# Phase 62 Plan 02: Manage Domains Status Column Summary

Wired Phase 61's verification columns (`verified`, `verifiedAt`) through to the super-admin Manage Domains dialog by widening the `DomainRow` frontend type and adding a Status column with three badge states plus an explicit destructive confirm dialog that surfaces UNVERIFIED state when applicable.

## What Changed

### Task 1: DomainRow type widening (commit `8083c6a`)

`client/src/hooks/useSuperAdmin.ts:203-210` — added `verified: boolean` and `verifiedAt: string | null` to the `DomainRow` interface. The backend `GET /api/super-admin/tenants/:id/domains` endpoint already returned these fields after Phase 61 (`server/routes/super-admin.ts:449` → `storage.getTenantDomains(id)` → `db.select().from(domains)`), so this is purely a type-level alignment. No hook or mutation signatures changed.

Deliberately did NOT add `verificationToken` — the super-admin list endpoint omits it; only the tenant-side `POST /api/admin/domains` create returns the token.

### Task 2: ManageDomainsDialog Status column + destructive confirm (commit `d5a0f5b`)

`client/src/pages/SuperAdmin.tsx`:

1. **New `StatusBadge` helper** (lines 146-155) — colocated above `ManageDomainsDialog`. Priority ladder:
   - `isPrimary` → purple "Primary"
   - `verified` → green "Verified"
   - else → yellow "Pending Verification"

2. **Status column** replaces the old Primary column (line ~194). The table now reads `Hostname | Status | (Actions)`.

3. **Destructive confirm copy** in `handleRemove` (lines 178-186). Now accepts the full `DomainRow` (was: bare `domainId: number`) and surfaces verification state in the prompt:
   ```
   Remove UNVERIFIED domain "foo.example.com"?

   This is irreversible. Customers reaching this hostname will see a 404 until it is re-added and re-verified.
   ```
   When `domain.verified === true`, the word "verified" is used in place of "UNVERIFIED".

4. **Remove button enable rule unchanged**: `disabled={d.isPrimary || removeDomain.isPending}`. Super-admin can remove any non-primary domain regardless of verification state — verification status only affects the confirm copy, not gating.

## Verification

- `grep -n "verified: boolean" client/src/hooks/useSuperAdmin.ts` → line 208 ✓
- `grep -n "Pending Verification" client/src/pages/SuperAdmin.tsx` → line 153 ✓
- `grep -n "StatusBadge" client/src/pages/SuperAdmin.tsx` → lines 146, 215 ✓
- `grep -n "UNVERIFIED" client/src/pages/SuperAdmin.tsx` → line 179 ✓
- `npm run check` → exit 0 ✓
- `npm run build` → exit 0 (3 pre-existing `import.meta` warnings in server/, unrelated) ✓

## Deviations from Plan

None — plan executed exactly as written.

## Out-of-scope Changes Observed (not committed by this plan)

Working tree contained pre-existing edits in `client/src/components/admin/shared/types.ts` (adds `'domains'` to `AdminSection` union — Phase 62 Plan 01 work) and several `server/routes/*.ts` files. Those were left untouched by this plan's commits; only `client/src/hooks/useSuperAdmin.ts` and `client/src/pages/SuperAdmin.tsx` were committed.

## Requirements Closed

- **CD-09** — Super-admin can audit verification state across all tenants and remove any domain (including unverified) with an explicit destructive confirmation.

## Commits

| Task | Hash      | Message                                                                |
| ---- | --------- | ---------------------------------------------------------------------- |
| 1    | `8083c6a` | feat(62-02): extend DomainRow with verification fields                 |
| 2    | `d5a0f5b` | feat(62-02): add Status column + destructive confirm to ManageDomainsDialog |

## Self-Check: PASSED

- FOUND: client/src/hooks/useSuperAdmin.ts (modified, contains `verified: boolean`)
- FOUND: client/src/pages/SuperAdmin.tsx (modified, contains `StatusBadge`, `Pending Verification`, `UNVERIFIED`)
- FOUND: commit 8083c6a (Task 1)
- FOUND: commit d5a0f5b (Task 2)
- TypeScript check: passed
- Build: passed
