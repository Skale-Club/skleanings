---
phase: 54-invoice-history
plan: "02"
subsystem: billing-frontend
tags: [billing, invoices, react-query, admin]
dependency_graph:
  requires: [54-01]
  provides: [invoice-history-ui]
  affects: [client/src/pages/admin/BillingPage.tsx]
tech_stack:
  added: []
  patterns: [react-query-useQuery, shadcn-table, shadcn-skeleton]
key_files:
  created: []
  modified:
    - client/src/pages/admin/BillingPage.tsx
decisions:
  - "useQuery with enabled:isAuthenticated ensures invoices only load when tenant admin is authenticated"
  - "invoicesLoading drives skeleton in Invoice History card independently from authLoading/fetchLoading outer guard"
metrics:
  duration: "10 minutes"
  completed: "2026-05-14T19:22:28Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 54 Plan 02: Invoice History UI Summary

**One-liner:** Invoice History card added to BillingPage using React Query, showing 3 skeleton rows while loading, empty state, or table with date/amount/status badge/download link per invoice.

## What Was Built

Extended `client/src/pages/admin/BillingPage.tsx` with an Invoice History section below the Subscription Status card. The section:

- Fetches `GET /api/billing/invoices` using `useQuery` from `@tanstack/react-query` (already installed)
- Enabled only when `isAuthenticated` is true — no unauthenticated requests
- Shows 3 `<Skeleton>` rows (`h-10 w-full`) while the query is in-flight
- Shows "No invoices yet." paragraph when the invoices array is empty
- Renders a `<Table>` with columns: Date, Amount, Status, Download when invoices exist
  - Date: `toLocaleDateString()`
  - Amount: `(cents / 100).toFixed(2) + currency.toUpperCase()`
  - Status: `<Badge>` green for "paid", gray otherwise
  - Download: `<a target="_blank">` to `inv.invoiceUrl` or "—" when null

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Invoice History card to BillingPage.tsx | bf3c4c6 | client/src/pages/admin/BillingPage.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - the Invoice History card fetches real data from /api/billing/invoices (implemented in 54-01).

## Self-Check: PASSED

- `client/src/pages/admin/BillingPage.tsx` modified and committed (bf3c4c6)
- `npm run check` passes with zero TypeScript errors
- "Invoice History" heading present in JSX
- Skeleton, Table, TableHeader, TableRow, TableHead, TableBody, TableCell all imported
