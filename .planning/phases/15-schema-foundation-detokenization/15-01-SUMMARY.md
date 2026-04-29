---
phase: 15
plan: 01
subsystem: schema-foundation-detokenization
tags: [schema, migration, white-label, drizzle, supabase]
requirements:
  completed: [WLTYPE-01, LEGAL-01]
dependency-graph:
  requires: []
  provides:
    - "companySettings.serviceDeliveryModel TEXT column (Drizzle + SQL migration)"
    - "companySettings.privacyPolicyContent TEXT column (Drizzle + SQL migration)"
    - "companySettings.termsOfServiceContent TEXT column (Drizzle + SQL migration)"
    - "Updated CompanySettings TypeScript type via $inferSelect"
  affects:
    - "Plan 15-02 (client detokenization) — unblocked but does NOT consume new columns"
    - "Plan 15-03 (server detokenization) — unblocked but does NOT consume new columns"
    - "Phase 17 (admin UI) — strict consumer of all three new columns"
    - "Phase 18 (admin calendar) — strict consumer of serviceDeliveryModel"
tech-stack:
  added: []
  patterns:
    - "ALTER TABLE ... ADD COLUMN IF NOT EXISTS with comma-separated clauses (single table rewrite)"
    - "Plain TEXT for enum-like values with .default('value') — matches existing precedent (timeFormat, ogType, twitterCard)"
    - "Drizzle column auto-flow via db.select().from(table) full-row select — no storage layer changes required"
key-files:
  created:
    - "supabase/migrations/20260428000000_add_white_label_columns.sql"
  modified:
    - "shared/schema.ts (companySettings pgTable definition extended with 3 columns at lines 681-684)"
decisions:
  - "Plain TEXT (not pgEnum, no CHECK constraint) chosen for serviceDeliveryModel — matches established codebase precedent for enum-like values"
  - "Migration file created but NOT applied — DB push is operator-manual per Build Constraint #1 and STATE.md migration-pending blocker"
  - "Risk 1 (column whitelist) confirmed mitigated — getCompanySettings uses full-row select; no storage code changes needed"
metrics:
  duration: "2m 5s"
  completed: "2026-04-29"
  tasks: 2
  files: 2
---

# Phase 15 Plan 01: Schema Foundation — Migration + Drizzle Columns Summary

Added three nullable TEXT columns (`service_delivery_model`, `privacy_policy_content`, `terms_of_service_content`) to `company_settings` via a new Supabase migration file and matching Drizzle definitions, unblocking Phase 17/18 admin UI consumers.

## What Was Done

### Task 1: Supabase migration

**File:** `supabase/migrations/20260428000000_add_white_label_columns.sql`
**Commit:** `8b09822`

Single `ALTER TABLE public.company_settings` with three `ADD COLUMN IF NOT EXISTS` clauses:

```sql
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS service_delivery_model TEXT DEFAULT 'at-customer',
  ADD COLUMN IF NOT EXISTS privacy_policy_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_of_service_content TEXT DEFAULT '';
```

Style choices (per RESEARCH.md Section 5):
- UPPERCASE SQL keywords (matches `20260425000000_add_utm_tracking.sql`)
- `public.` schema qualifier (matches `20260402100000_add_stripe_fields.sql`)
- `IF NOT EXISTS` for idempotency
- No `CHECK` constraint (matches existing `time_format`, `og_type`, `twitter_card` precedent)
- No `NOT NULL` (defaults handle existing rows; nullable allows future tenants to leave fields unset)

### Task 2: Drizzle schema extension

**File:** `shared/schema.ts` (lines 681-684, immediately after `homepageContent`)
**Commit:** `f1d46f5`

```typescript
homepageContent: jsonb("homepage_content").$type<HomepageContent>().default({}),
// === Phase 15: White-label columns ===
serviceDeliveryModel: text("service_delivery_model").default('at-customer'),
privacyPolicyContent: text("privacy_policy_content").default(''),
termsOfServiceContent: text("terms_of_service_content").default(''),
```

`CompanySettings` type and `insertCompanySettingsSchema` auto-regenerate via `$inferSelect` and `createInsertSchema(companySettings)` — no manual type writing needed.

## Risk 1 Verification (RESEARCH.md)

**Verified:** `server/storage.ts:891` — `getCompanySettings: full-row select confirmed`

```typescript
const [settings] = await db.select().from(companySettings);
```

No column whitelist exists. The three new columns automatically flow through `getCompanySettings()` and `updateCompanySettings()` without any storage-layer modification. **No code change needed in `server/storage.ts`.**

## Verification Results

| Check                                | Command                                                                | Result    |
| ------------------------------------ | ---------------------------------------------------------------------- | --------- |
| WLTYPE-01 migration                  | `grep service_delivery_model supabase/migrations/...white_label*.sql`  | PASS      |
| WLTYPE-01 schema                     | `grep serviceDeliveryModel shared/schema.ts`                           | PASS      |
| LEGAL-01 migration                   | `grep privacy_policy_content\|terms_of_service_content` migration       | PASS      |
| LEGAL-01 schema                      | `grep privacyPolicyContent\|termsOfServiceContent` schema               | PASS      |
| TypeScript clean                     | `npm run check`                                                        | PASS (0)  |
| Risk 1 mitigated                     | `grep db.select().from(companySettings) server/storage.ts`             | PASS (1)  |
| D-08 unchanged                       | `grep skleanings-admin-theme client/src/context/ThemeContext.tsx`      | PASS (1)  |
| No CHECK constraint                  | `grep CHECK supabase/migrations/...white_label*.sql`                   | PASS (0)  |

## Deviations from Plan

None — plan executed exactly as written.

## Operator Reminder

**The migration file is the artifact for this plan; the actual DB push is a separate manual operator action.**

To apply this migration to the live DB:

```bash
supabase db push    # apply 20260428000000_add_white_label_columns.sql
psql $DATABASE_URL -c "\d company_settings"   # confirm 3 new columns present with defaults
```

**Downstream impact:**
- Plan 15-02 and 15-03 do NOT read these columns — they are unblocked even with the DB migration unapplied
- Phase 17 (admin UI) and Phase 18 (calendar `address` field gating on `serviceDeliveryModel`) DO read these columns — operator must run `supabase db push` before those phases execute

This matches the existing STATE.md "MIGRATION PENDING" pattern from Phase 10's UTM migration.

## Self-Check: PASSED

- File `supabase/migrations/20260428000000_add_white_label_columns.sql`: FOUND
- File `shared/schema.ts` modifications at lines 681-684: FOUND
- Commit `8b09822` (Task 1): FOUND
- Commit `f1d46f5` (Task 2): FOUND
- `npm run check` exit 0: PASS
- All grep acceptance criteria: PASS
