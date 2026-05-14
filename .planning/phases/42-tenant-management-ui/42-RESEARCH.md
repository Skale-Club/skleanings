# Phase 42: Tenant Management UI — Research

**Researched:** 2026-05-13
**Domain:** React Admin UI + Express API — Tenant/Domain CRUD in existing super-admin panel
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TO-01 | Super-admin lists all tenants with name, slug, status, primary domain, created-at | GET /api/super-admin/tenants → TenantsSection component |
| TO-02 | Super-admin creates tenant (name, slug, primary domain) — new rows in tenants + domains (isPrimary=true) | POST /api/super-admin/tenants → Dialog form → IStorage.createTenant + IStorage.addDomain |
| TO-03 | Super-admin adds extra hostname to tenant; removes non-primary domain | POST/DELETE /api/super-admin/tenants/:id/domains → IStorage.addDomain / IStorage.removeDomain |
| TO-04 | Super-admin toggles tenant status active/inactive | PATCH /api/super-admin/tenants/:id/status → IStorage.updateTenantStatus |
</phase_requirements>

---

## Summary

Phase 42 adds a Tenants section to the existing `/superadmin` panel. The work touches three layers: (1) IStorage interface + DatabaseStorage implementation with five new methods, (2) five new Express routes in `server/routes/super-admin.ts` behind `requireSuperAdmin`, and (3) a new `TenantsSection` component + `useSuperAdminTenants` hooks following the exact patterns already established in Phase 37.

The super-admin panel deliberately avoids React Query in its hooks — it uses `useQuery`/`useMutation` from `@tanstack/react-query` via the `useSuperAdmin` hook file (which is different from the tenant-scoped admin). This is already working: `useSuperAdminStats`, `useSuperAdminHealth`, etc. all follow the same `superAdminFetch` helper pattern. New tenant hooks must follow that identical pattern.

The key implementation risk is slug uniqueness validation — the slug column has a UNIQUE constraint in the database, so the API must return a clear 409 conflict message, and the frontend must surface it gracefully.

**Primary recommendation:** Three plans — (1) IStorage methods + DatabaseStorage implementation, (2) API routes, (3) TenantsSection UI + hooks wired into Dashboard.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | DB queries for tenants/domains tables | Project ORM — all storage uses it |
| @tanstack/react-query | existing | Data fetching in hooks (useQuery/useMutation) | Already used by all useSuperAdmin* hooks |
| shadcn/ui Table | existing | Tenant list table | project standard; file exists at client/src/components/ui/table.tsx |
| shadcn/ui Dialog | existing | "Add tenant" + "Manage domains" modals | file exists at client/src/components/ui/dialog.tsx |
| shadcn/ui Badge | existing | Status indicator (active/inactive) | used for health check status in existing panel |
| shadcn/ui Button, Input, Label | existing | Form controls | used throughout existing super-admin |

**Installation:** No new packages required.

---

## Architecture Patterns

### Existing super-admin pattern (verified by reading source files)

```
server/routes/super-admin.ts        ← add new routes here (requireSuperAdmin guard)
server/storage.ts                   ← add methods to IStorage + DatabaseStorage
client/src/hooks/useSuperAdmin.ts   ← add new hook functions here
client/src/pages/SuperAdmin.tsx     ← add TenantsSection component + wire into Dashboard
```

### Pattern 1: IStorage Extension

New methods go at the END of the `IStorage` interface (after CalendarSync section, before closing brace). They are NOT tenant-scoped — they query global registry tables (`tenants`, `domains`) without a `tenantId` filter. DatabaseStorage implements them using direct Drizzle queries against the global tables.

```typescript
// In IStorage interface — global registry methods (no tenantId scope)
getTenants(): Promise<TenantRow[]>;
createTenant(data: { name: string; slug: string }): Promise<TenantRow>;
updateTenantStatus(id: number, status: string): Promise<TenantRow>;
getTenantDomains(tenantId: number): Promise<DomainRow[]>;
addDomain(tenantId: number, hostname: string, isPrimary: boolean): Promise<DomainRow>;
removeDomain(id: number): Promise<void>;
```

Where `TenantRow` and `DomainRow` are inlined types:
```typescript
// Add near top of storage.ts or inline in interface — not yet declared in schema.ts
import { tenants, domains } from "@shared/schema";
type TenantRow = typeof tenants.$inferSelect;
type DomainRow  = typeof domains.$inferSelect;
```

Note: `tenants` and `domains` ARE exported from `@shared/schema` (verified: lines 32, 41 of schema.ts). They are NOT yet declared as named `Tenant`/`Domain` types — the plan must add `$inferSelect` usage.

### Pattern 2: DatabaseStorage Implementation

These methods use `db` directly (not `this.tenantId`), since they operate on the global registry.

```typescript
async getTenants(): Promise<TenantRow[]> {
  return await db.select().from(tenants).orderBy(asc(tenants.createdAt));
}

async createTenant(data: { name: string; slug: string }): Promise<TenantRow> {
  const [row] = await db.insert(tenants).values({
    name: data.name,
    slug: data.slug,
    status: "active",
  }).returning();
  return row;
}

async updateTenantStatus(id: number, status: string): Promise<TenantRow> {
  const [row] = await db.update(tenants)
    .set({ status, updatedAt: new Date() })
    .where(eq(tenants.id, id))
    .returning();
  return row;
}

async getTenantDomains(tenantId: number): Promise<DomainRow[]> {
  return await db.select().from(domains).where(eq(domains.tenantId, tenantId));
}

async addDomain(tenantId: number, hostname: string, isPrimary: boolean): Promise<DomainRow> {
  const [row] = await db.insert(domains).values({ tenantId, hostname, isPrimary }).returning();
  return row;
}

async removeDomain(id: number): Promise<void> {
  await db.delete(domains).where(eq(domains.id, id));
}
```

### Pattern 3: Super-admin API Routes

Added to `server/routes/super-admin.ts` before the export line. All routes use `requireSuperAdmin` middleware. They access `storage` (the global `DatabaseStorage.forTenant(1)` singleton) because super-admin routes bypass tenant resolution — but for registry methods (tenants/domains) this is fine since they don't filter by tenantId anyway.

```typescript
// GET /api/super-admin/tenants
router.get("/tenants", requireSuperAdmin, async (_req, res) => {
  try {
    const allTenants = await storage.getTenants();
    // Join primary domain per tenant (separate query or left join)
    res.json(allTenants);
  } catch (err) {
    console.error("[super-admin] /tenants GET error:", err);
    res.status(500).json({ message: "Failed to fetch tenants" });
  }
});

// POST /api/super-admin/tenants
router.post("/tenants", requireSuperAdmin, async (req, res) => {
  const { name, slug, primaryDomain } = req.body;
  // validate required fields, then:
  const tenant = await storage.createTenant({ name, slug });
  await storage.addDomain(tenant.id, primaryDomain, true);
  res.status(201).json(tenant);
});
```

**Slug uniqueness:** `tenants.slug` is UNIQUE in DB. Catch pg unique violation (error code `23505`) and return `409 { message: "Slug already taken" }`.

### Pattern 4: React Hooks

Follow `useSuperAdmin.ts` exactly — `superAdminFetch` helper, `useQuery`/`useMutation` from `@tanstack/react-query`, `queryClient.invalidateQueries` on mutations.

```typescript
// Add to client/src/hooks/useSuperAdmin.ts

export interface TenantRow {
  id: number;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  primaryDomain?: string;   // populated by API join
}

export interface DomainRow {
  id: number;
  tenantId: number;
  hostname: string;
  isPrimary: boolean;
  createdAt: string;
}

export function useSuperAdminTenants(enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery<TenantRow[]>({
    queryKey: ["/api/super-admin/tenants"],
    queryFn: () => superAdminFetch<TenantRow[]>("/api/super-admin/tenants"),
    enabled,
    retry: false,
  });

  const createTenant = useMutation<TenantRow, Error, { name: string; slug: string; primaryDomain: string }>({
    mutationFn: (data) =>
      superAdminFetch<TenantRow>("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
  });

  const toggleStatus = useMutation<TenantRow, Error, { id: number; status: string }>({
    mutationFn: ({ id, status }) =>
      superAdminFetch<TenantRow>(`/api/super-admin/tenants/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants"] });
    },
  });

  return { query, createTenant, toggleStatus };
}

export function useSuperAdminTenantDomains(tenantId: number | null, enabled: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery<DomainRow[]>({
    queryKey: ["/api/super-admin/tenants", tenantId, "domains"],
    queryFn: () => superAdminFetch<DomainRow[]>(`/api/super-admin/tenants/${tenantId}/domains`),
    enabled: enabled && tenantId !== null,
    retry: false,
  });

  const addDomain = useMutation<DomainRow, Error, { hostname: string }>({
    mutationFn: ({ hostname }) =>
      superAdminFetch<DomainRow>(`/api/super-admin/tenants/${tenantId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "domains"] });
    },
  });

  const removeDomain = useMutation<void, Error, number>({
    mutationFn: (domainId) =>
      superAdminFetch<void>(`/api/super-admin/domains/${domainId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/tenants", tenantId, "domains"] });
    },
  });

  return { query, addDomain, removeDomain };
}
```

### Pattern 5: TenantsSection UI Component

Component structure in `SuperAdmin.tsx`:

```
TenantsSection
├── Section header + "Add Tenant" Button (brand yellow, rounded-full)
├── TenantsTable (shadcn Table)
│   └── Rows: name | slug | status Badge | primary domain | created-at | Actions
│       └── Actions: "Manage Domains" Button | Toggle Status Button
├── CreateTenantDialog (shadcn Dialog)
│   └── Form: name (text), slug (text), primaryDomain (text)
└── ManageDomainsDialog (shadcn Dialog, opened per-tenant)
    ├── List of domains: hostname | isPrimary badge | Delete button (blocked if isPrimary)
    └── Add domain form: hostname input + "Add" button
```

Wire into `Dashboard` component as a new `<section>` (same structure as existing Platform Stats, Health Check sections).

### Pattern 6: Tenants list — primary domain join

The `/api/super-admin/tenants` response should include `primaryDomain` to avoid a separate fetch per row. Two implementation options:

**Option A (recommended):** Raw SQL join in the API route handler — run a single query joining `tenants` LEFT JOIN `domains WHERE is_primary = true`. This avoids adding join logic to IStorage (keeps storage methods simple) and is fine for super-admin use since it queries global tables.

**Option B:** Two queries in route handler — `getTenants()` then `getTenantDomains(id)` for each. Creates N+1. Do not use.

```typescript
// In route handler, using db directly (not storage):
const rows = await db
  .select({
    id: tenants.id,
    name: tenants.name,
    slug: tenants.slug,
    status: tenants.status,
    createdAt: tenants.createdAt,
    primaryDomain: domains.hostname,
  })
  .from(tenants)
  .leftJoin(domains, and(eq(domains.tenantId, tenants.id), eq(domains.isPrimary, true)))
  .orderBy(asc(tenants.createdAt));
```

### Anti-Patterns to Avoid

- **Do not use `res.locals.storage` in super-admin routes** — super-admin routes are mounted before `resolveTenantMiddleware` and `res.locals.storage` is not populated. Use `storage` (global singleton) or `db` directly.
- **Do not add tenant-scoped versions of getTenants/getDomains to IStorage** — these are global registry operations, not per-tenant operations. Keep them as methods on DatabaseStorage that ignore `this.tenantId`.
- **Do not allow deletion of primary domain** — guard in route: if `domain.isPrimary === true`, return 400 `{ message: "Cannot remove primary domain" }`.
- **Do not forget slug validation on create** — catch PostgreSQL error code `23505` (unique_violation) and map to a 409 response.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table UI | Custom HTML table | shadcn Table (already installed) | Consistent styling, accessible |
| Modal/Dialog | Custom CSS overlay | shadcn Dialog (already installed) | Focus trap, keyboard dismiss |
| Status badge | Custom span + styles | shadcn Badge with className | Already used for health check status |
| Fetch with error handling | Raw fetch in component | `superAdminFetch` helper (already in useSuperAdmin.ts) | Handles JSON parse, throws typed Error |

---

## Common Pitfalls

### Pitfall 1: Slug unique constraint not surfaced to UI
**What goes wrong:** User submits "create tenant" with existing slug → 500 from DB constraint violation → UI shows generic error.
**Why it happens:** PostgreSQL throws error code `23505` (unique_violation) which is not caught specifically.
**How to avoid:** Wrap insert in try/catch, detect `err.code === '23505'` (or `err.message.includes('unique')`), return `409 { message: "Slug already taken" }`.
**Warning signs:** Test by creating the same slug twice.

### Pitfall 2: Removing primary domain
**What goes wrong:** Super-admin deletes primary domain → tenant has no primary domain → LRU cache lookup fails → tenant becomes unreachable.
**Why it happens:** No guard in delete route.
**How to avoid:** In `DELETE /api/super-admin/domains/:id`, fetch the domain first, return 400 if `isPrimary === true`.

### Pitfall 3: res.locals.storage not available in super-admin routes
**What goes wrong:** Accessing `res.locals.storage` in a super-admin route → `undefined` → runtime error.
**Why it happens:** `resolveTenantMiddleware` runs AFTER super-admin routes in the middleware chain (verified in routes.ts lines 31-35).
**How to avoid:** Use `import { storage } from "../storage"` and `import { db } from "../db"` directly in super-admin routes — as the existing super-admin.ts already does.

### Pitfall 4: Hostname uniqueness collision
**What goes wrong:** Adding a hostname that already belongs to another tenant → DB unique constraint on `domains.hostname`.
**Why it happens:** `hostname` is UNIQUE across all tenants (verified in schema.ts line 44).
**How to avoid:** Catch `23505` on domain insert, return `409 { message: "Hostname already registered" }`.

### Pitfall 5: Status toggle shows stale value
**What goes wrong:** Toggle status → mutation succeeds → table still shows old status.
**Why it happens:** Forgot `queryClient.invalidateQueries` after mutation.
**How to avoid:** `onSuccess` in `toggleStatus` mutation MUST invalidate `["/api/super-admin/tenants"]`.

---

## API Route Design

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| GET | `/api/super-admin/tenants` | List all tenants with primary domain (LEFT JOIN) | requireSuperAdmin |
| POST | `/api/super-admin/tenants` | Create tenant + primary domain row | requireSuperAdmin |
| PATCH | `/api/super-admin/tenants/:id/status` | Toggle active/inactive | requireSuperAdmin |
| GET | `/api/super-admin/tenants/:id/domains` | List all domains for tenant | requireSuperAdmin |
| POST | `/api/super-admin/tenants/:id/domains` | Add non-primary domain | requireSuperAdmin |
| DELETE | `/api/super-admin/domains/:id` | Delete non-primary domain | requireSuperAdmin |

---

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. All packages already installed. No new CLI tools, services, or runtimes required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest/vitest config found) |
| Config file | None — Wave 0 must create if needed |
| Quick run command | `npm run check` (TypeScript type checking) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TO-01 | GET /api/super-admin/tenants returns list | manual smoke | `npm run check` | N/A |
| TO-02 | POST /api/super-admin/tenants creates tenant + domain | manual smoke | `npm run check` | N/A |
| TO-03 | POST/DELETE domain endpoints work | manual smoke | `npm run check` | N/A |
| TO-04 | PATCH status toggles correctly | manual smoke | `npm run check` | N/A |

No automated test infrastructure exists in this project. Validation is TypeScript type-checking + manual browser smoke test on the super-admin panel.

### Wave 0 Gaps

None — existing infrastructure (TypeScript + shadcn) covers all requirements. No test files to create.

---

## Open Questions

1. **Should IStorage methods be added at all, or use `db` directly in routes?**
   - What we know: Existing super-admin routes already use `storage` (for company settings) AND `db` directly (for stats counts)
   - What's unclear: Consistency preference — IStorage addition vs. direct db in routes
   - Recommendation: Add to IStorage for the write operations (createTenant, addDomain, removeDomain, updateTenantStatus); use direct `db` with LEFT JOIN for the GET /tenants list query (avoids N+1 without complex IStorage method signature)

2. **Hostname format validation**
   - What we know: `domains.hostname` is stored as plain text (e.g., "localhost", "tenant1.xkedule.com")
   - What's unclear: Should we validate hostname format on the server (no protocol, no trailing slash)?
   - Recommendation: Add basic validation — strip `https://`, `http://`, trailing slash before insert; return 400 if result is empty string.

---

## Sources

### Primary (HIGH confidence)

- Direct source file reads: `client/src/pages/SuperAdmin.tsx` — confirmed no React Query, uses useSuperAdmin hooks pattern, sections structure
- Direct source file reads: `client/src/hooks/useSuperAdmin.ts` — confirmed `superAdminFetch` helper, `useQuery`/`useMutation` pattern
- Direct source file reads: `server/routes/super-admin.ts` — confirmed `requireSuperAdmin` guard, `storage` singleton usage, Router pattern
- Direct source file reads: `server/routes.ts` — confirmed super-admin mounted BEFORE `resolveTenantMiddleware` (lines 31-35)
- Direct source file reads: `server/storage.ts` — confirmed IStorage interface location, `DatabaseStorage.forTenant()` pattern, tenantId scoping
- Direct source file reads: `shared/schema.ts` — confirmed `tenants` table structure (id, name, slug, status, createdAt, updatedAt), `domains` table structure (id, tenantId, hostname, isPrimary, createdAt, updatedAt)
- Direct source file reads: `.planning/REQUIREMENTS.md` — TO-01 through TO-04 requirements text

### Secondary (MEDIUM confidence)

- PostgreSQL unique constraint error code `23505` — standard pg error code, well-known

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified present by file system check
- Architecture patterns: HIGH — read actual source files, not assumed
- Pitfalls: HIGH — derived from actual codebase constraints (middleware order, DB constraints in schema)
- API design: HIGH — follows identical pattern to existing super-admin routes

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable domain — no fast-moving dependencies)
