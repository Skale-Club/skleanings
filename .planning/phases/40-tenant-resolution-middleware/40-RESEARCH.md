# Phase 40: Tenant Resolution Middleware - Research

**Researched:** 2026-05-13
**Domain:** Express.js middleware / LRU cache / TypeScript module augmentation / multi-tenant request routing
**Confidence:** HIGH

---

## Summary

Phase 40 inserts a tenant resolution layer between Express's request parsing and all business route handlers. The middleware reads `req.hostname` (the Host header, minus the port), looks up the matching row in the `domains` table, and attaches `res.locals.tenant` and `res.locals.storage` (a `DatabaseStorage.forTenant(tenantId)` instance) to the response object. Unrecognised hostnames receive `404` immediately. A module-level LRU cache (max 500 entries, 5-minute TTL) prevents per-request DB queries.

The two structural deliverables are: (1) a new `server/middleware/tenant.ts` file that exports the middleware, and (2) replacing the `import { storage } from "../storage"` singleton in every business route file with `const storage = res.locals.storage`. The super-admin routes (`/api/super-admin/*`) are explicitly bypassed — they operate on the global DB connection directly.

**Primary recommendation:** Add `lru-cache` v11 as a dependency. Write the middleware in `server/middleware/tenant.ts`. Wire it in `server/index.ts` (or `server/routes.ts`) after session middleware but before any business router. Add `server/types/locals.d.ts` to augment `Express.Locals`.

The `server/storage/index.ts` modular storage (used only by `analytics.ts`) is out of scope — analytics functions are not part of `IStorage` and are called directly, not through `res.locals.storage`. Only files that import `storage` from `"../storage"` (the `DatabaseStorage` class) need to be migrated.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MT-09 | Requests with an unknown hostname (not in `domains` table) receive 404 before any business route handler | Middleware with DB lookup + cache miss path; short-circuit with `res.status(404).json()` |
| MT-10 | Second request for same hostname does not hit the DB — served from LRU cache (max 500 entries, 5-minute TTL) | `lru-cache` v11 with `max: 500`, `ttl: 300_000` — cache populated on first hit |
| MT-11 | `res.locals.tenant` is populated with resolved tenant object on every successfully resolved request | Middleware sets `res.locals.tenant = domainRow.tenant` after successful lookup |
| MT-12 | All business route handlers access `res.locals.storage` — global `storage` singleton import absent from business routes | Replace `import { storage }` with `const storage = res.locals.storage` in every applicable route file (enumerated below) |
| MT-13 | Requests to `/api/super-admin/*` are not subject to tenant resolution and operate on the global DB directly | Route ordering in `server/routes.ts`: mount super-admin router BEFORE `resolveTenantMiddleware`; or use `unless`-style path guard inside middleware |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- TypeScript throughout — all code must type-check via `npm run check`
- Express.js backend with `server/index.ts` as entry point; middleware registered via `registerRoutes(app)`
- All DB operations go through `server/storage.ts` implementing `IStorage` — the `DatabaseStorage.forTenant()` factory exists as of Phase 39
- No Redux; no global state except the singleton `storage` (which becomes the fallback for super-admin routes)
- Database migrations: Supabase CLI only — Phase 40 adds NO schema changes; `domains` table already exists from Phase 38
- `npm run check` must pass after changes

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lru-cache` | 11.3.6 (latest) | Hostname-to-tenant LRU cache | Industry-standard; pure ESM; TTL support built-in; not yet in package.json |
| `express` | existing (^4.21.2) | Middleware registration | Already in use |
| `drizzle-orm` | existing (^0.39.3) | `domains` + `tenants` table query | Already in use; `eq()` for hostname lookup |

**lru-cache is NOT currently in package.json** — it must be added.

**Installation:**
```bash
npm install lru-cache
```

Verified version: `11.3.6` (published May 2025 — confirmed via `npm view lru-cache version`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `lru-cache` npm package | Hand-rolled Map with TTL | `lru-cache` handles eviction, TTL, and max-size correctly; hand-rolling is a pitfall (see below) |
| `res.locals.storage` injection | Function argument injection | `res.locals` is the Express convention for per-request state; it avoids threading `storage` through every call site |

---

## Architecture Patterns

### Recommended Project Structure

```
server/
├── middleware/
│   ├── auth.ts            # existing
│   └── tenant.ts          # NEW — resolveTenantMiddleware
├── types/
│   ├── session.d.ts       # existing — superAdmin session augmentation
│   └── locals.d.ts        # NEW — Express.Locals augmentation
├── routes.ts              # mount super-admin BEFORE tenant middleware
└── index.ts               # wire middleware after session, before routes
```

### Pattern 1: Middleware with LRU Cache

**What:** Module-level LRU cache keyed by hostname. Middleware queries `domains` JOIN `tenants` on cache miss, populates cache, sets `res.locals`.

**When to use:** Every incoming request except `/api/super-admin/*`.

```typescript
// server/middleware/tenant.ts
// Source: lru-cache v11 official README + Express middleware conventions
import { LRUCache } from "lru-cache";
import { db } from "../db";
import { domains, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DatabaseStorage } from "../storage";
import type { Request, Response, NextFunction } from "express";

type CachedTenant = typeof tenants.$inferSelect;

const hostnameCache = new LRUCache<string, CachedTenant>({
  max: 500,
  ttl: 5 * 60 * 1000, // 5-minute TTL in ms
});

export async function resolveTenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Strip port from Host header — req.hostname does this automatically
  const hostname = req.hostname;

  // Check cache first
  let tenant = hostnameCache.get(hostname);

  if (!tenant) {
    // DB lookup: JOIN domains -> tenants
    const [row] = await db
      .select({ tenant: tenants })
      .from(domains)
      .innerJoin(tenants, eq(domains.tenantId, tenants.id))
      .where(eq(domains.hostname, hostname))
      .limit(1);

    if (!row) {
      res.status(404).json({ message: "Unknown tenant" });
      return;
    }

    tenant = row.tenant;
    hostnameCache.set(hostname, tenant);
  }

  res.locals.tenant = tenant;
  res.locals.storage = DatabaseStorage.forTenant(tenant.id);
  next();
}
```

### Pattern 2: TypeScript Module Augmentation for res.locals

**What:** Extend `Express.Locals` interface so `res.locals.storage` and `res.locals.tenant` are typed without `any` casts.

**Established project precedent:** `server/types/session.d.ts` already augments `express-session.SessionData` using the same pattern.

```typescript
// server/types/locals.d.ts
import type { DatabaseStorage } from "../storage";
import type { tenants } from "@shared/schema";

declare global {
  namespace Express {
    interface Locals {
      tenant?: typeof tenants.$inferSelect;
      storage?: DatabaseStorage;
    }
  }
}
```

Note: `DatabaseStorage` has a `private constructor` — it can only be instantiated via `forTenant()`. The type is still importable for declaration use.

### Pattern 3: Route-Level storage Access

**What:** Each business route handler reads `res.locals.storage` instead of the module-level import.

**Before (current — 30+ files):**
```typescript
import { storage } from "../storage";
// ...
router.get("/", async (req, res) => {
  const bookings = await storage.getBookings();
});
```

**After:**
```typescript
// No storage import at module level
router.get("/", async (req, res) => {
  const storage = res.locals.storage!;
  const bookings = await storage.getBookings();
});
```

### Pattern 4: Bypass for Super-Admin Routes

**What:** The super-admin router is mounted before `resolveTenantMiddleware` is applied — or the middleware skips requests whose path starts with `/api/super-admin`.

**Option A (preferred — ordering in routes.ts):**
```typescript
// server/routes.ts — mount super-admin FIRST, before tenant middleware
app.use("/api/super-admin", superAdminRouter);
app.use(resolveTenantMiddleware);          // applied to everything after
app.use("/api/bookings", bookingsRouter);
// ... all other business routers
```

**Option B (path guard inside middleware):**
```typescript
if (req.path.startsWith("/api/super-admin")) {
  return next();
}
```

Option A is cleaner — no path-string duplication inside the middleware function.

### Anti-Patterns to Avoid

- **Hand-rolling LRU cache:** A plain `Map` has no eviction or TTL — it will grow unbounded in production. Use `lru-cache`.
- **Using `req.headers.host` directly:** The `host` header includes the port (e.g., `localhost:5000`). Use `req.hostname` instead — Express strips the port automatically.
- **Applying tenant middleware to ALL routes globally in index.ts before super-admin:** The super-admin paths must be reachable without a valid tenant in the `domains` table.
- **Forgetting to handle async errors in middleware:** An unhandled rejected promise in the middleware will hang the request. Either wrap in try/catch or use the Express 5 async middleware pattern. Express 4 does not auto-catch async errors.
- **Importing `DatabaseStorage` class directly in route files:** Route files should only access `res.locals.storage` — they must not import `DatabaseStorage` and call `forTenant()` themselves.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LRU eviction with TTL | `Map<string, {value, expiry}>` | `lru-cache` | TTL purging, max-size eviction, concurrent access safety all handled |
| TypeScript `res.locals` typing | `(res.locals as any).storage` | `locals.d.ts` augmentation | Type safety without casts; matches project precedent in `session.d.ts` |

---

## Complete File Inventory for MT-12

The following files import `storage` from `"../storage"` or `"../../storage"` and require the `res.locals.storage` migration. This is the exhaustive list from the codebase audit:

**Route files (direct route handlers — highest priority):**
- `server/routes/analytics.ts` — imports from `"../storage/index"` (NOT `DatabaseStorage`) — treat separately (see note)
- `server/routes/auth-routes.ts`
- `server/routes/availability.ts`
- `server/routes/blog.ts`
- `server/routes/bookings.ts`
- `server/routes/calendar-sync.ts`
- `server/routes/catalog.ts`
- `server/routes/chat/index.ts`
- `server/routes/chat/dependencies.ts` — also imports `IStorage` type; has DI pattern (see note)
- `server/routes/client.ts`
- `server/routes/company.ts`
- `server/routes/contacts.ts`
- `server/routes/faqs.ts`
- `server/routes/integrations/ai.ts`
- `server/routes/integrations/ghl.ts`
- `server/routes/integrations/google-calendar.ts`
- `server/routes/integrations/resend.ts`
- `server/routes/integrations/stripe.ts`
- `server/routes/integrations/telegram.ts`
- `server/routes/integrations/twilio.ts`
- `server/routes/notification-logs.ts`
- `server/routes/payments.ts`
- `server/routes/recurring-bookings.ts`
- `server/routes/service-areas.ts`
- `server/routes/staff.ts`
- `server/routes/super-admin.ts` — **EXCLUDED from migration (MT-13)** — keeps global `storage`
- `server/routes/user-routes.ts`

**Lib files (called from routes — indirect):**
- `server/lib/auth.ts`
- `server/lib/availability.ts`
- `server/lib/booking-client-sync.ts`
- `server/lib/booking-ghl-sync.ts`
- `server/lib/email-resend.ts`
- `server/lib/google-calendar.ts`
- `server/lib/notification-logger.ts`
- `server/lib/seo-injector.ts`
- `server/lib/staff-availability.ts`
- `server/lib/stripe.ts`
- `server/lib/time-slot-lock.ts`

**Service files (cron workers — no req/res context):**
- `server/services/blog-generator.ts`
- `server/services/booking-email-reminders.ts`
- `server/services/calendar-sync-worker.ts`
- `server/services/recurring-booking-generator.ts`
- `server/services/recurring-booking-reminder.ts`

**Infrastructure (keep using global storage):**
- `server/index.ts` — imports for `initializeSeedData`; does not call business methods directly
- `server/lib/seeds.ts` — seed data for tenant 1; can keep global storage
- `server/scripts/seed.ts` — CLI script; can keep global storage

**Critical note on lib files:** Lib files like `server/lib/auth.ts`, `server/lib/availability.ts`, etc. are called FROM route handlers but take `req`/`res` as parameters. The cleanest approach is to pass `storage` (from `res.locals.storage`) as a parameter to these lib functions rather than having them import the global singleton. This is a parameter-threading refactor, not a `res.locals` access pattern.

**Critical note on analytics.ts:** `analytics.ts` imports from `"../storage/index"` (the modular storage, NOT `DatabaseStorage`). The `upsertVisitorSession` and related analytics functions are NOT on `IStorage` — they live in the analytics module which is tenant-unaware. This file needs separate consideration; analytics data is likely intentionally global across tenants in Phase 40 scope.

**Critical note on chat/dependencies.ts:** The chat module has an existing DI pattern (`setChatDependencies`) that replaces the storage instance. The migration for chat routes should leverage this DI container rather than direct `res.locals` access in every handler.

**Critical note on service/cron files:** Cron workers run outside of request context — they have no `res.locals`. These cannot receive a tenant-scoped storage from middleware. They must either: (a) continue using the global `storage` (tenant 1 only), or (b) receive tenant IDs from the data they process. This is a Phase 40 constraint: cron workers are NOT migrated in this phase.

---

## Common Pitfalls

### Pitfall 1: req.hostname vs req.headers.host

**What goes wrong:** Using `req.headers.host` returns `localhost:5000` — including the port. Querying the `domains` table for `localhost:5000` fails even though `localhost` is seeded as a valid hostname.

**Why it happens:** HTTP/1.1 includes port in the `Host` header unless it's the default (80/443). Development servers run on 5000.

**How to avoid:** Always use `req.hostname` — Express parses `Host` and strips the port automatically.

**Warning signs:** All requests returning 404 in development.

### Pitfall 2: Async Error Not Forwarded to Express

**What goes wrong:** DB lookup throws; the unhandled rejection hangs the request or crashes the process.

**Why it happens:** Express 4 does not automatically catch async errors in middleware.

**How to avoid:**
```typescript
export async function resolveTenantMiddleware(req, res, next) {
  try {
    // ... lookup logic
  } catch (err) {
    next(err); // forward to Express error handler
  }
}
```

**Warning signs:** Requests that hang indefinitely on network errors.

### Pitfall 3: LRU Cache Serving Stale Tenant Data

**What goes wrong:** A tenant's status changes to `inactive` or a domain is removed from the DB, but the cache continues serving the old entry for up to 5 minutes.

**Why it happens:** The 5-minute TTL is intentional for performance, but there's no invalidation mechanism.

**How to avoid:** Accept this behavior in Phase 40 (acceptable for SaaS platforms). Document that domain/tenant changes take up to 5 minutes to propagate. Do NOT add per-update cache invalidation in this phase.

**Warning signs:** Would only surface during operational domain-change testing.

### Pitfall 4: TypeScript Private Constructor Prevents Type Import

**What goes wrong:** `DatabaseStorage` has `private constructor` — attempting `new DatabaseStorage(...)` outside the class throws a TypeScript error.

**Why it happens:** This is by design (forces `forTenant()` usage), but the class name must still be importable for the `locals.d.ts` type declaration.

**How to avoid:** Import the class type for declaration use only:
```typescript
import type { DatabaseStorage } from "../storage";
```
The `import type` form only imports the type, not the value — no instantiation is possible, so no conflict.

### Pitfall 5: Lib Functions Have No Access to res.locals

**What goes wrong:** `server/lib/auth.ts` calls `storage.getUserByEmail()` but lib functions don't receive `res` — only `req`, `res`, `next` if they're middleware themselves.

**Why it happens:** The storage singleton is module-level in lib files; they can't access `res.locals`.

**How to avoid:** Pass storage as a function parameter:
```typescript
// Before
export async function requireAdmin(req, res, next) {
  const user = await storage.getUser(sess.userId);
}

// After
export async function requireAdmin(req, res, next) {
  const storage = res.locals.storage!;
  const user = await storage.getUser(sess.userId);
}
```
For lib functions not directly in middleware position (e.g., `booking-ghl-sync.ts`), thread the storage instance as an explicit parameter.

### Pitfall 6: super-admin Routes Break if Tenant Middleware Applied First

**What goes wrong:** Middleware returns 404 for `/api/super-admin/*` because there's no domain row for `localhost` matching the super-admin hostname in some environments.

**Why it happens:** Super-admin operates on the global DB — it should never require tenant resolution.

**How to avoid:** Mount `superAdminRouter` in `routes.ts` BEFORE applying `resolveTenantMiddleware`. Use `app.use("/api/super-admin", superAdminRouter)` first, then `app.use(resolveTenantMiddleware)`.

---

## Code Examples

### lru-cache v11 Instantiation

```typescript
// Source: lru-cache v11 README (npm registry)
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, TenantRow>({
  max: 500,         // maximum number of entries
  ttl: 300_000,     // TTL in milliseconds (5 minutes)
});

// Set
cache.set(key, value);

// Get (returns undefined on miss or expired)
const value = cache.get(key);
```

Note: `lru-cache` v10+ uses named export `LRUCache` (not default export). It is pure ESM. The project uses `"type": "module"` in package.json, so this is compatible.

### Drizzle JOIN for Domain -> Tenant Lookup

```typescript
// Source: Drizzle ORM docs — innerJoin + eq
import { db } from "../db";
import { domains, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

const [row] = await db
  .select({ tenant: tenants })
  .from(domains)
  .innerJoin(tenants, eq(domains.tenantId, tenants.id))
  .where(eq(domains.hostname, hostname))
  .limit(1);
```

### Express.Locals Augmentation

```typescript
// server/types/locals.d.ts
// Source: Express TypeScript docs — same pattern used in session.d.ts
import type { DatabaseStorage } from "../storage";
import type { tenants } from "@shared/schema";

declare global {
  namespace Express {
    interface Locals {
      tenant?: typeof tenants.$inferSelect;
      storage?: DatabaseStorage;
    }
  }
}
```

### Middleware Registration Order (routes.ts)

```typescript
export async function registerRoutes(server: Server, app: Express) {
  // 1. Super-admin routes — bypasses tenant resolution (MT-13)
  app.use("/api/super-admin", superAdminRouter);

  // 2. Tenant resolution middleware — applies to ALL routes below
  app.use(resolveTenantMiddleware);

  // 3. All business routers
  app.use("/api/bookings", bookingsRouter);
  // ... etc
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global `storage` singleton | `res.locals.storage` per-request | Phase 40 | Each request gets tenant-scoped storage |
| `import { storage }` in routes | `const storage = res.locals.storage!` | Phase 40 | Global import removed from business routes |
| All hostnames served same data | 404 for unknown hostname | Phase 40 | Tenant isolation enforced at HTTP layer |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | Running | — |
| `lru-cache` npm package | MT-10 | No (not in package.json) | 11.3.6 available | None — must install |
| `domains` table | MT-09, MT-10 | Yes (Phase 38 complete) | — | — |
| `tenants` table | MT-11 | Yes (Phase 38 complete) | — | — |
| `DatabaseStorage.forTenant()` | MT-11, MT-12 | Yes (Phase 39 complete) | — | — |

**Missing dependencies with no fallback:**
- `lru-cache` — must be added via `npm install lru-cache` in the first plan of this phase.

---

## Validation Architecture

nyquist_validation is enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, vitest.config, pytest.ini found) |
| Config file | None |
| Quick run command | `npm run check` (TypeScript only) |
| Full suite command | `npm run check` |

No automated test infrastructure exists in this project. Validation is performed via TypeScript type checking (`npm run check`) and manual smoke tests against a running dev server.

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MT-09 | Unknown hostname returns 404 | manual smoke | curl -H "Host: unknown.example.com" http://localhost:5000/api/categories | N/A |
| MT-10 | Second request served from cache (no DB hit) | manual (log-based) | Add console.log in middleware; verify single DB query on second call | N/A |
| MT-11 | res.locals.tenant populated | manual smoke | Add debug endpoint; check tenant object in response | N/A |
| MT-12 | No global storage import in business routes | `npm run check` | `npm run check` | N/A |
| MT-13 | /api/super-admin unrestricted | manual smoke | curl -H "Host: unknown.example.com" http://localhost:5000/api/super-admin/login | N/A |

### Sampling Rate

- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check` + manual smoke tests against `npm run dev`
- **Phase gate:** TypeScript clean + all 5 success criteria manually verified before `/gsd:verify-work`

### Wave 0 Gaps

None — no new test files need to be created. Validation is TypeScript + manual.

---

## Open Questions

1. **analytics.ts uses `storage/index.ts`, not `DatabaseStorage`**
   - What we know: `server/routes/analytics.ts` imports from `"../storage/index"` (the modular, non-class-based storage). Analytics functions (`upsertVisitorSession`, `getOverviewData`, etc.) are NOT part of `IStorage`.
   - What's unclear: Should analytics data be tenant-scoped? The modular storage has no `forTenant()` mechanism.
   - Recommendation: Defer analytics tenant-scoping to a later phase. Phase 40 should leave `analytics.ts` using the modular storage as-is. The planner should mark this file as "out of scope" for MT-12.

2. **Cron/service workers have no req/res context**
   - What we know: `server/services/*.ts` files import the global `storage` but run outside HTTP request context.
   - What's unclear: How should cron workers resolve which tenant(s) to operate on in a true multi-tenant scenario?
   - Recommendation: Phase 40 scope does NOT migrate cron workers. They continue using `DatabaseStorage.forTenant(1)` (the global singleton). This is acceptable since all current customers are tenant 1.

3. **chat/dependencies.ts DI container**
   - What we know: Chat has a `setChatDependencies` pattern that accepts a custom `IStorage`. The chat route also directly imports `storage`.
   - What's unclear: Should `chat/index.ts` and `chat/dependencies.ts` be migrated together as a unit?
   - Recommendation: Migrate `chat/index.ts` to use `res.locals.storage`. Update `setChatDependencies` default to read from `res.locals.storage` at call time (rather than at module import time).

---

## Sources

### Primary (HIGH confidence)

- Direct codebase audit — `server/storage.ts` lines 414-2332 (DatabaseStorage class, forTenant factory, singleton export)
- Direct codebase audit — `server/routes/` (30+ files with `import { storage }` enumerated)
- Direct codebase audit — `server/types/session.d.ts` (TypeScript augmentation precedent)
- Direct codebase audit — `shared/schema.ts` (tenants/domains table structure)
- `npm view lru-cache version` — confirmed 11.3.6 as latest
- `package.json` — confirmed `lru-cache` is NOT currently a dependency

### Secondary (MEDIUM confidence)

- `lru-cache` v11 README (npm registry) — API: named export `LRUCache`, `max` and `ttl` constructor options
- Express.js TypeScript docs — `Express.Locals` augmentation pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — lru-cache version confirmed via npm; all other libraries already present
- Architecture: HIGH — middleware pattern is standard Express; TypeScript augmentation pattern established in project
- Pitfalls: HIGH — all derived from direct code inspection (async middleware, hostname parsing, private constructor)
- File inventory (MT-12): HIGH — complete grep audit of all `import { storage }` occurrences

**Research date:** 2026-05-13
**Valid until:** 2026-06-12 (stable domain — 30 days)
