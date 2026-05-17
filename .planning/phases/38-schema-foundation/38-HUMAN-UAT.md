---
status: partial
phase: 38-schema-foundation
source: [38-VERIFICATION.md]
started: 2026-05-13T00:00:00.000Z
updated: 2026-05-13T00:00:00.000Z
---

## Current Test

[awaiting supabase db push]

## Tests

### 1. Apply migrations to live DB
expected: supabase db push applies both migrations (20260515000000 + 20260515000001) successfully
result: [pending]

### 2. tenants table has Skleanings as id=1
expected: SELECT * FROM tenants WHERE id=1 returns name='Skleanings', slug='skleanings', status='active'
result: [pending]

### 3. domains table has localhost
expected: SELECT * FROM domains WHERE hostname='localhost' returns tenant_id=1, is_primary=true
result: [pending]

### 4. All business tables have tenant_id column
expected: SELECT column_name FROM information_schema.columns WHERE table_name='bookings' AND column_name='tenant_id' returns 1 row
result: [pending]

### 5. Existing data has tenant_id=1
expected: SELECT COUNT(*) FROM bookings WHERE tenant_id != 1 returns 0
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
