---
phase: 59-plan-tier-foundation-super-admin-plan-management
plan: 02
subsystem: billing/plan-tier
tags: [feature-flags, plan-tier, typescript, pure-module]
requires:
  - server/lib/stripe-plans.ts (PlanTier type from 59-01)
provides:
  - server/lib/feature-flags.ts
  - FEATURE_CATALOG constant
  - FeatureLimits interface
  - FeatureName type alias
  - tenantHasFeature() typed helper
  - getFeatureCatalog() helper
affects:
  - Phase 60-01 GET /api/billing/status (will consume getFeatureCatalog)
  - Phase 60 /admin/billing UI (renders feature list)
tech-stack:
  added: []
  patterns:
    - "Pure data + helper module (no DB, no env, no Express coupling)"
    - "Generic K extends FeatureName for precise return-type narrowing"
    - "Record<PlanTier, FeatureLimits> shape enforcement (exhaustive tier coverage at compile time)"
    - "-1 sentinel for unlimited numeric limits"
key-files:
  created:
    - server/lib/feature-flags.ts
  modified: []
decisions:
  - "Used Record<PlanTier, FeatureLimits> annotation instead of `as const` — Record already enforces exhaustive shape and `as const` would over-narrow numeric literals which is unhelpful downstream."
  - "Generic typing on tenantHasFeature<K extends FeatureName> rather than a `number | boolean` union — callers get the exact field type with no casting at call site."
  - "Catalog is hardcoded (no mutation API) — REQUIREMENTS.md lists custom tier creation as Out of Scope for Phase 59."
  - "-1 is the unlimited sentinel for enterprise tier (maxStaff and maxBookingsPerMonth); route-level enforcement is deferred to v18.0."
requirements: [PT-03]
metrics:
  duration_seconds: 97
  duration_human: "~2 minutes"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 0
  completed_at: "2026-05-15T13:09:44Z"
---

# Phase 59 Plan 02: Feature Catalog Module Summary

Plan tier feature catalog implemented as a pure TypeScript module exporting `FEATURE_CATALOG`, the `FeatureLimits` interface, and two typed helpers (`tenantHasFeature`, `getFeatureCatalog`) that Phase 60 will consume on the billing status endpoint.

## What Was Built

A single new file, `server/lib/feature-flags.ts`, that serves as the single source of truth for "what can a tenant on tier X do?". The module:

- Defines the `FeatureLimits` interface covering 4 capabilities: `maxStaff`, `maxBookingsPerMonth`, `customBranding`, `prioritySupport`.
- Exports `FEATURE_CATALOG: Record<PlanTier, FeatureLimits>` with hardcoded values for the three tiers — `basic` (3 staff / 100 bookings / no branding / no priority), `pro` (10 staff / 1000 bookings / branding / no priority), `enterprise` (unlimited staff / unlimited bookings / branding / priority).
- Exposes `tenantHasFeature<K extends FeatureName>(tier, feature)` returning the precise field type for that key (`number` for limits, `boolean` for flags) so callers never need to cast.
- Exposes `getFeatureCatalog(tier)` returning the full `FeatureLimits` object — Phase 60's GET `/api/billing/status` will use this to ship the catalog block down to the admin UI.

The module is pure (no DB, no env, no Express imports — only `import type { PlanTier } from "./stripe-plans"`), tree-shakeable, and compile-time-exhaustive: adding a new tier or feature without updating every entry will fail `npm run check`.

## Tasks Completed

| Task | Name                                          | Commit  | Files                         |
| ---- | --------------------------------------------- | ------- | ----------------------------- |
| 1    | Create feature-flags.ts with catalog + helpers | 8fe1d03 | server/lib/feature-flags.ts   |

## Verification

- `grep` confirmed all 5 exports present (`FeatureLimits`, `FeatureName`, `FEATURE_CATALOG`, `tenantHasFeature`, `getFeatureCatalog`).
- `grep -c "export"` returned 5 (>=5 required).
- `npm run check` exited 0 with no TypeScript errors — generic typing on `tenantHasFeature` compiles cleanly and the `Record<PlanTier, FeatureLimits>` annotation enforces exhaustive tier coverage.
- Catalog values verified against PT-03 spec: basic.maxStaff=3, pro.maxStaff=10, enterprise.maxStaff=-1; basic.customBranding=false, pro.customBranding=true, enterprise.prioritySupport=true.

## Deviations from Plan

None — plan executed exactly as written. The exact file content specified in the plan was used verbatim.

## Out-of-Scope Observations

`server/routes/billing.ts` had an uncommitted modification in the working tree at start; left untouched (not part of plan 59-02).

## Ready For Next Plan

Phase 60-01 can now `import { getFeatureCatalog, tenantHasFeature, type FeatureLimits, type FeatureName } from "@/lib/feature-flags"` (or the relative server path) on the billing status endpoint and ship the full feature object down to `/admin/billing` for rendering.

## Self-Check

- [x] FOUND: server/lib/feature-flags.ts
- [x] FOUND commit: 8fe1d03

## Self-Check: PASSED
