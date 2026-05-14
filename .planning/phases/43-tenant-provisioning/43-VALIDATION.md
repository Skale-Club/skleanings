---
phase: 43
slug: tenant-provisioning
date: 2026-05-14
status: active
---

# Validation Strategy — Phase 43: Tenant Provisioning

## Framework

None detected (no jest.config, vitest.config, or pytest.ini). All validation uses TypeScript type checking + manual smoke tests.

## Automated Gate (per task/wave)

Every task's `<verify>` block runs:

```bash
npm run check
```

Exit code 0 = pass. This validates:
- Migration SQL compiles against schema (Drizzle infers types from actual column definitions)
- `provisionTenantAdmin` and `seedTenantCompanySettings` method signatures match IStorage
- Route handler types match storage method return types
- React component props compile against hook return types

## Sampling Continuity

| Wave | Plans | Automated Check | Coverage |
|------|-------|-----------------|----------|
| 1 | 43-01 | `npm run check` after each task | Schema + storage types |
| 2 | 43-02 | `npm run check` + grep for key symbols | Route handler + cache invalidation |
| 3 | 43-03 | `npm run check` + checkpoint smoke test | Frontend hook + dialog |

## Wave 0 Gaps

None — no test infrastructure to create before implementation begins.

## Phase Gate

Manual smoke test in checkpoint (43-03 Task 3):
1. Supabase migration applied (`supabase db push`)
2. POST `/api/super-admin/tenants/:id/provision` returns `{ userId, email, password }`
3. Verifying `users` row exists with bcrypt hash in DB
4. Verifying `user_tenants` row exists with role='admin'
5. Verifying `companySettings` row exists for the new tenant
6. Adding a domain — LRU cache miss confirmed on next request (no server restart)
7. Removing a domain — LRU cache miss confirmed on next request
