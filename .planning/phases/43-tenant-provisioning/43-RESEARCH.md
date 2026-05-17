# Phase 43: Tenant Provisioning - Research

**Researched:** 2026-05-13
**Domain:** Multi-tenant admin provisioning, DB transactions, LRU cache invalidation
**Confidence:** HIGH

---

## Summary

Phase 43 completes the tenant creation flow so that provisioning a tenant is an atomic,
self-contained operation. Three independent sub-problems must be solved together:

1. **Admin user creation** — A `POST /api/super-admin/tenants/:id/provision` endpoint
   generates a random password, bcrypt-hashes it, inserts a row into `users` (with a new
   `password` column that must be migrated) and a row into `user_tenants` with role='admin',
   all inside a single DB transaction. The cleartext password is returned once so the
   super-admin can hand it to the tenant operator.

2. **Company settings seed** — `companySettings` must be seeded for every new tenant at
   creation time (either in the POST /tenants handler or in the provision handler). Without
   a row, the booking flow throws on first visit because `getCompanySettings()` returns
   undefined. The seed inserts tenant name, `timeZone = 'America/New_York'`, and
   `language = 'en'`; all other columns carry their schema-level defaults.

3. **LRU cache invalidation** — `hostnameCache` in `server/middleware/tenant.ts` is
   module-private. It must be exposed via an exported `invalidateTenantCache(hostname)`
   function. The POST /domains and DELETE /domains/:id route handlers in
   `server/routes/super-admin.ts` must call that function after successful DB writes.

**Primary recommendation:** Split the work into three sequential plans: (1) DB migration +
storage methods, (2) provision API endpoint + cache export, (3) SuperAdmin.tsx provision
button/dialog + useSuperAdmin hook extension.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TO-05 | Super-admin provisions initial tenant admin — `users` row with bcrypt password, `user_tenants` row with role='admin' | DB migration adds `password` column; `provisionTenantAdmin` storage method + `POST /api/super-admin/tenants/:id/provision` endpoint handle insertion in a single transaction |
| TO-06 | Company settings row auto-inserted at tenant creation with name, default timezone, default locale | `seedTenantCompanySettings` storage method called from POST /tenants or provision endpoint; all columns except `tenantId` and `companyName` carry schema defaults |
| TO-07 | LRU cache entry deleted when a domain is added or removed — next request resolves correctly without server restart | Export `invalidateTenantCache(hostname)` from `server/middleware/tenant.ts`; call it in POST /domains and DELETE /domains/:id after DB write |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- All database operations go through `server/storage.ts` implementing `IStorage`. Routes
  call storage methods, not raw SQL. (Exception: global registry methods on `DatabaseStorage`
  already use `db` directly — same pattern applies here.)
- Database migrations use Supabase CLI (`supabase db push`), never `drizzle-kit push`.
  Migration files live under `supabase/migrations/`.
- TypeScript throughout — no `any` casts except when crossing Express session/request types.
- State management: React Query for server state; no Redux.
- CTA buttons: Brand Yellow `#FFFF01` with black bold text, pill-shaped `rounded-full`.
- Shared schema in `shared/schema.ts` is the source of truth; Drizzle-zod generates types
  and validators.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bcrypt | 6.0.0 | Password hashing | Already a dependency, used in super-admin login |
| lru-cache | (already installed) | Hostname-to-tenant cache | Already in use in tenant middleware |
| drizzle-orm | (project version) | DB queries | Project standard |

`bcrypt` is confirmed installed at version 6.0.0. `crypto.randomUUID()` is available in
Node 24 (confirmed: `node --version` = v24.13.0) — no extra package needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcrypt | argon2 | bcrypt already used in super-admin login; consistency wins |
| crypto.randomUUID() | uuid package | Built-in Node API is sufficient; no package needed |
| Single transaction for all three writes | Separate calls | Transaction is correct for atomicity; separate calls leave DB in inconsistent state on partial failure |

---

## Architecture Patterns

### Recommended Plan Split

```
43-01: DB migration + IStorage extension
       - supabase/migrations/20260515000002_phase43_users_password.sql
         (ALTER TABLE users ADD COLUMN IF NOT EXISTS password text)
       - shared/schema.ts: add password field to users table
       - server/storage.ts IStorage: add provisionTenantAdmin + seedTenantCompanySettings
       - server/storage.ts DatabaseStorage: implement both methods

43-02: Server — provision endpoint + LRU cache export
       - server/middleware/tenant.ts: export invalidateTenantCache(hostname)
       - server/routes/super-admin.ts:
         * POST /tenants/:id/provision — creates user + user_tenants + companySettings in transaction
         * POST /tenants/:id/domains — call invalidateTenantCache after DB write
         * DELETE /domains/:id — call invalidateTenantCache after DB write
         * POST /tenants — call seedTenantCompanySettings after createTenant

43-03: Frontend — provision button + hook extension
       - client/src/hooks/useSuperAdmin.ts: useSuperAdminProvision hook + ProvisionResult type
       - client/src/pages/SuperAdmin.tsx: "Provision Admin" button per tenant row,
         ProvisionDialog shows returned credentials once
```

### Pattern 1: DB Transaction for Provision

```typescript
// server/storage.ts — DatabaseStorage (global registry, uses db directly)
async provisionTenantAdmin(
  tenantId: number,
  email: string,
  hashedPassword: string,
): Promise<{ userId: string }> {
  return await db.transaction(async (tx) => {
    const userId = crypto.randomUUID();
    await tx.insert(users).values({
      id: userId,
      tenantId,
      email,
      password: hashedPassword,
      role: "admin",
      isAdmin: true,
    });
    await tx.insert(userTenants).values({
      userId,
      tenantId,
      role: "admin",
    });
    return { userId };
  });
}
```

**Why transaction:** If the `user_tenants` insert fails after `users` insert, the orphaned
user row would block future provision attempts (unique email constraint). Transaction
ensures both succeed or both roll back.

### Pattern 2: Company Settings Seed

```typescript
async seedTenantCompanySettings(
  tenantId: number,
  companyName: string,
): Promise<void> {
  await db.insert(companySettings).values({
    tenantId,
    companyName,
    timeZone: "America/New_York",
    language: "en",
    // all other columns carry schema-level defaults
  }).onConflictDoNothing(); // safe to call twice
}
```

`onConflictDoNothing()` makes it idempotent — calling it again if companySettings already
exists is safe. The `tenantId` column has no unique constraint by itself (multiple rows
allowed per tenant historically), but for a new tenant there will be exactly zero rows,
so the insert always succeeds. Use `onConflictDoNothing()` as defensive coding.

### Pattern 3: LRU Cache Export

```typescript
// server/middleware/tenant.ts — BEFORE (module-private)
const hostnameCache = new LRUCache<string, CachedTenant>({ max: 500, ttl: 5 * 60 * 1000 });

// server/middleware/tenant.ts — AFTER
export const hostnameCache = new LRUCache<string, CachedTenant>({ max: 500, ttl: 5 * 60 * 1000 });

export function invalidateTenantCache(hostname: string): void {
  hostnameCache.delete(hostname);
}
```

**Usage in super-admin routes:**
```typescript
import { invalidateTenantCache } from "../middleware/tenant";

// In POST /tenants/:id/domains — after successful DB insert:
invalidateTenantCache(hostname);

// In DELETE /domains/:id — fetch hostname BEFORE deleting, then:
invalidateTenantCache(domain.hostname);
```

Note: the DELETE route already fetches the domain row to guard against primary domain
deletion — the `hostname` is available from that fetch.

### Pattern 4: Provision Endpoint

```typescript
// POST /api/super-admin/tenants/:id/provision
router.post("/tenants/:id/provision", requireSuperAdmin, async (req, res) => {
  const tenantId = parseInt(req.params.id, 10);
  const { email } = req.body as { email?: string };

  if (isNaN(tenantId) || !email?.trim()) {
    res.status(400).json({ message: "tenantId and email are required" });
    return;
  }

  // Generate a random 16-char password
  const plainPassword = crypto.randomBytes(10).toString("base64url").slice(0, 16);
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  try {
    const { userId } = await storage.provisionTenantAdmin(tenantId, email.trim(), hashedPassword);
    // Return cleartext password ONCE — not stored
    res.status(201).json({ userId, email: email.trim(), password: plainPassword });
  } catch (err: unknown) {
    if ((err as any)?.code === "23505") {
      res.status(409).json({ message: "Email already registered for this tenant" });
      return;
    }
    res.status(500).json({ message: "Failed to provision admin" });
  }
});
```

### Pattern 5: Frontend Provision Dialog

```typescript
// Extend useSuperAdmin.ts
export interface ProvisionResult {
  userId: string;
  email: string;
  password: string; // shown once
}

export function useSuperAdminProvision(tenantId: number | null) {
  return useMutation<ProvisionResult, Error, { email: string }>({
    mutationFn: ({ email }) =>
      superAdminFetch<ProvisionResult>(`/api/super-admin/tenants/${tenantId}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
  });
}
```

In SuperAdmin.tsx, add a "Provision Admin" Button per tenant row. On success, show the
returned `{ email, password }` in a one-time dialog with a copy button. After the dialog
closes, the credentials are gone (no re-fetch).

### Anti-Patterns to Avoid

- **Storing plaintext password in state longer than necessary:** Pass directly from mutation
  `onSuccess` to dialog. Do not store in component state after dialog closes.
- **Calling seedTenantCompanySettings inside provisionTenantAdmin:** Company settings seed
  logically belongs to tenant creation (TO-06), not admin provisioning (TO-05). Call it
  in POST /tenants after `createTenant()`. This way, even tenants without a provisioned
  admin have working company settings.
- **Using hostnameCache.clear() instead of delete():** Clearing the entire cache on every
  domain change would evict all other tenants' cache entries, causing a thundering herd on
  next requests. Delete only the affected hostname.
- **Omitting the DB migration:** The `users` table currently has no `password` column.
  Drizzle schema changes without a migration will not apply to the live DB.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash | `bcrypt.hash(pwd, 12)` | bcrypt already in project at cost factor 12 (matches super-admin pattern) |
| UUID generation | Custom random string | `crypto.randomUUID()` | Node 24 built-in, no package needed |
| Secure random password | Math.random string | `crypto.randomBytes(10).toString('base64url').slice(0, 16)` | Cryptographically secure, URL-safe |
| Transaction rollback | Manual try/catch + delete | `db.transaction(async (tx) => { ... })` | Drizzle transaction handles rollback automatically |

---

## Common Pitfalls

### Pitfall 1: users table missing password column

**What goes wrong:** TypeScript compile error on `users` table insert if `password` field
is not declared in `shared/schema.ts`. Even if schema is updated, the column will not
exist in the live DB without a Supabase CLI migration.

**How to avoid:** Write migration SQL first, update schema.ts second, implement storage
methods third — in that order.

**Warning signs:** `column "password" of relation "users" does not exist` Postgres error.

### Pitfall 2: email uniqueness scope

**What goes wrong:** The `users.email` column has a GLOBAL unique constraint
(`text("email").unique()`), not a per-tenant one. Provisioning the same email for two
different tenants will throw `23505`.

**How to avoid:** The provision endpoint must 409 on `23505` with a clear message. Note
from STATE.md: contacts.email has the same issue — deferred. For provisioned admin users,
the global unique is acceptable since the super-admin controls provisioning.

**Warning signs:** `duplicate key value violates unique constraint "users_email_unique"`.

### Pitfall 3: Fetching hostname after domain delete

**What goes wrong:** The DELETE /domains/:id route deletes the row first, then tries to
read the hostname for cache invalidation — but the row is gone.

**How to avoid:** The existing route already fetches the domain row before deleting (to
check isPrimary). Read `domain.hostname` from that fetched row, then delete, then call
`invalidateTenantCache(domain.hostname)`. Order: fetch → delete → invalidate.

### Pitfall 4: companySettings missing for new tenant on first booking flow visit

**What goes wrong:** `getCompanySettings()` returns `undefined` for a new tenant if no
seed row exists. The booking flow and admin panel both call this method and destructure
the result without null-checking.

**How to avoid:** Call `seedTenantCompanySettings` immediately after `createTenant` in the
POST /tenants route handler. This is the correct moment — tenant creation is when the
settings row should first exist, independent of whether an admin is later provisioned.

### Pitfall 5: hostnameCache variable name collision after export

**What goes wrong:** If `hostnameCache` is exported by name, any file importing it could
accidentally mutate it. The `invalidateTenantCache` function is a safer API.

**How to avoid:** Export only `invalidateTenantCache`, NOT the cache instance itself. The
cache remains an implementation detail of the middleware module.

---

## Code Examples

### Migration SQL

```sql
-- supabase/migrations/20260515000002_phase43_users_password.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;
```

No NOT NULL constraint — provisioned users have a password; Supabase-auth users do not.
The column is nullable by design.

### Drizzle Schema Update

```typescript
// shared/schema.ts — users table, add after profileImageUrl line:
password: text("password"),  // bcrypt hash; null for OAuth-only users
```

### IStorage interface additions

```typescript
// Global Registry section at bottom of IStorage interface
provisionTenantAdmin(tenantId: number, email: string, hashedPassword: string): Promise<{ userId: string }>;
seedTenantCompanySettings(tenantId: number, companyName: string): Promise<void>;
```

### seedTenantCompanySettings call site (POST /tenants)

```typescript
// server/routes/super-admin.ts — in POST /tenants, after existing createTenant + addDomain calls:
await storage.seedTenantCompanySettings(tenant.id, name.trim());
res.status(201).json({ ...tenant, primaryDomain: domain.hostname });
```

---

## Runtime State Inventory

No rename/refactor involved. Not applicable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js crypto (built-in) | UUID + random password | Yes | Node 24.13.0 | — |
| bcrypt npm package | Password hashing | Yes | 6.0.0 | — |
| lru-cache npm package | Cache invalidation | Yes | (already installed) | — |
| PostgreSQL (Supabase) | DB writes | Yes (remote) | — | — |
| Supabase CLI | Migration apply | Pending (project pattern) | — | — |

No blocking missing dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, no vitest.config, no pytest.ini) |
| Config file | none |
| Quick run command | `npm run check` (TypeScript type check) |
| Full suite command | `npm run check` |

No automated test infrastructure exists in the project. All validation is manual smoke
testing.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TO-05 | POST /provision creates users + user_tenants rows with hashed password | manual-only | `npm run check` (types only) | N/A |
| TO-06 | POST /tenants seeds companySettings row | manual-only | `npm run check` (types only) | N/A |
| TO-07 | Domain add/remove invalidates LRU cache entry | manual-only | `npm run check` (types only) | N/A |

**Justification for manual-only:** No test framework installed. TypeScript check validates
types; runtime behavior verified by browser smoke test against dev server.

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` passes + manual smoke test: provision a tenant admin via
  /superadmin, visit the new tenant's domain, confirm booking flow loads without error

### Wave 0 Gaps

None — no test files to create. TypeScript type check is the automated gate.

---

## Open Questions

1. **Login flow for provisioned tenant admins**
   - What we know: Phase 43 creates a bcrypt-hashed password in `users.password`; the
     current auth system uses Supabase JWT exclusively; no local login route exists.
   - What's unclear: How will provisioned tenant admins actually log in? The password is
     generated but there is no endpoint to verify it.
   - Recommendation: Phase 43 scope is limited to CREATING the credential (TO-05 says
     "create a user with bcrypt-hashed password"). The login route is NOT in scope for this
     phase. The password is handed to the tenant operator who will use it in a future
     phase's login endpoint. Do not add a login route in this phase.

2. **companySettings unique constraint per tenant**
   - What we know: The schema has no unique constraint on `(tenantId)` in companySettings.
     Multiple rows per tenant are technically allowed. `getCompanySettings()` uses
     `.limit(1)`, so the first row wins.
   - What's unclear: Should `seedTenantCompanySettings` use INSERT ... ON CONFLICT DO
     NOTHING on tenantId, or is a plain insert sufficient?
   - Recommendation: Use `.onConflictDoNothing()` as defensive coding even without a
     constraint. A simple INSERT is also acceptable since new tenants have zero settings rows.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `server/middleware/tenant.ts` — confirmed `hostnameCache` is
  module-private LRUCache instance; `resolveTenantMiddleware` exported separately.
- Direct code inspection: `shared/schema.ts` lines 12–24 — `users` table has NO `password`
  column; nullable columns are the norm (no NOT NULL without explicit `.notNull()`).
- Direct code inspection: `shared/schema.ts` lines 799–856 — `companySettings` columns;
  all except `id` and `tenantId` have `.default()` values; no mandatory NOT NULL besides
  those two.
- Direct code inspection: `server/storage.ts` lines 417–423 — IStorage global registry
  section pattern; lines 2351–2358 `createTenant` implementation shows the exact insert
  pattern to follow.
- Direct code inspection: `server/routes/super-admin.ts` — existing POST /tenants and
  DELETE /domains/:id route handlers; bcrypt already imported at line 1.
- `npm list bcrypt` — confirmed bcrypt@6.0.0 installed.
- `node --version` — confirmed Node v24.13.0; `crypto.randomUUID()` is available.

### Secondary (MEDIUM confidence)

- Drizzle ORM transaction pattern: `db.transaction(async (tx) => { ... })` — standard
  Drizzle API; consistent with patterns seen in storage.ts.
- `lru-cache` `.delete(key)` API — confirmed by existing `.set()` and `.get()` usage in
  tenant.ts; `.delete()` is the standard LRUCache method.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — patterns directly derived from existing code; no new libraries
- Pitfalls: HIGH — derived from direct schema/code inspection, not training data
- Migration need: HIGH — `users.password` column confirmed absent from schema

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable codebase, no fast-moving dependencies)
