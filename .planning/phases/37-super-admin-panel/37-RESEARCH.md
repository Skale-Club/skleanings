# Phase 37: Super-Admin Panel - Research

**Researched:** 2026-05-11
**Domain:** Express session auth, in-memory ring buffer, React route isolation, server stats aggregation
**Confidence:** HIGH

---

## Summary

Phase 37 adds a `/superadmin` panel accessible only via separate env-var credentials (`SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD_HASH`). The panel provides platform operators with tenant stats, health checks, company-settings editing, and recent server error logs — without touching the tenant Supabase auth flow at all.

The project already has `bcrypt ^6.0.0` installed (currently unused), `express-session` with MemoryStore configured in `server/index.ts`, and `req.session` augmentation is possible via TypeScript module declaration. The existing `requireAdmin` middleware (in `server/lib/auth.ts`) is completely separate from the new `requireSuperAdmin` — the two auth flows are orthogonal: tenant admin uses Supabase JWT Bearer tokens; super-admin uses session cookie set at POST `/api/super-admin/login`.

The router pattern is already established: create `server/routes/super-admin.ts`, export a router, mount it in `server/routes.ts` at `app.use("/api/super-admin", superAdminRouter)`. On the frontend, add a `/superadmin` route in `App.tsx` — isolated from the `/admin` block, no Navbar/Footer, no AuthContext dependency.

**Primary recommendation:** Use `req.session.superAdmin = { authenticated: true }` as the session namespace. Implement a module-level ring buffer (`const errorLog: ErrorEntry[] = []`) in `server/lib/error-log.ts`, patch `console.error` in `server/index.ts` startup, and expose it via `GET /api/super-admin/error-logs`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SADM-01 | `/superadmin` route accessible only with `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD_HASH` env vars — returns 403 for any other session | Session cookie auth pattern; bcrypt.compare() available; TypeScript session augmentation needed |
| SADM-02 | Panel shows stats: total bookings, customers, services, staff count, DB uptime | `storage.ts` exposes `getBookings()`, `getContacts()`, `getServices()`, `getStaffMembers()`; need 4 simple `COUNT(*)` helpers or inline `db.select({ count: sql... })` queries |
| SADM-03 | Health check: DB connected, migrations applied count, required env vars present | `ensureDatabaseReady()` exists; `supabase/migrations/` directory is countable; `collectRuntimeEnvDiagnostics()` already in `server/lib/runtime-env.ts` |
| SADM-04 | Super-admin can view and edit `companySettings` without tenant admin login | `storage.getCompanySettings()` / `storage.updateCompanySettings()` already exist; reuse in new super-admin routes behind `requireSuperAdmin` |
| SADM-05 | Last 50 server error logs visible in panel | In-memory ring buffer (max 50 entries) in new `server/lib/error-log.ts`; patch `console.error` in `server/index.ts` after session middleware |
| SADM-06 | `/api/super-admin/*` returns 403 without valid super-admin session cookie | `requireSuperAdmin` middleware checks `req.session.superAdmin?.authenticated === true`; returns 403 (not 401) to avoid leaking auth method |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `bcrypt` | ^6.0.0 | Password hash comparison for super-admin login | Already in package.json, matches CLAUDE.md reference |
| `express-session` | ^1.18.2 | Session cookie for super-admin auth state | Already configured in `server/index.ts` with MemoryStore |
| `express` Router | existing | `/api/super-admin/*` route group | Same pattern as all other route files |
| React + Wouter | existing | `/superadmin` frontend page | Same pattern as `/admin`, `/account`, `/staff` routes |
| shadcn/ui + Tailwind | existing | Panel UI components | Project standard; Card, Badge, Table components available |

**No new npm installs required.** All dependencies exist.

### TypeScript Session Augmentation (required)

`express-session` ships its own `SessionData` interface. To add `superAdmin` without `(req.session as any)`, declare a module augmentation:

```typescript
// server/types/session.d.ts  (new file)
import "express-session";
declare module "express-session" {
  interface SessionData {
    superAdmin?: { authenticated: true };
  }
}
```

This is the TypeScript-idiomatic approach — confirmed by `@types/express-session` package design.

---

## Architecture Patterns

### Recommended File Structure (new files only)

```
server/
├── lib/
│   └── error-log.ts          # In-memory ring buffer, max 50 entries
├── routes/
│   └── super-admin.ts        # All /api/super-admin/* handlers
└── types/
    └── session.d.ts          # express-session SessionData augmentation

client/src/
├── pages/
│   └── SuperAdmin.tsx        # Standalone page (no Navbar/Footer/AuthContext)
└── hooks/
    └── useSuperAdmin.ts      # React Query hooks for super-admin API
```

Routes.ts addition (one line):
```
app.use("/api/super-admin", superAdminRouter);
```

App.tsx addition (one block in Router function, alongside `/admin` and `/staff` blocks):
```typescript
const isSuperAdminRoute = location.startsWith('/superadmin');
// ... Suspense + Switch with Route path="/superadmin" component={SuperAdmin}
```

### Pattern 1: Super-Admin Session Auth

**What:** POST `/api/super-admin/login` validates email + bcrypt hash, sets `req.session.superAdmin`. All other `/api/super-admin/*` routes use `requireSuperAdmin` middleware.

**When to use:** Simpler than HTTP Basic (avoids browser native dialog), avoids Supabase entirely.

```typescript
// server/routes/super-admin.ts
import bcrypt from "bcrypt";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

const router = Router();

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session.superAdmin?.authenticated === true) {
    return next();
  }
  return res.status(403).json({ message: "Super-admin access required" });
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

  if (!expectedEmail || !expectedHash || !email || !password) {
    return res.status(403).json({ message: "Invalid credentials" });
  }

  const emailMatch = email.toLowerCase() === expectedEmail.toLowerCase();
  const hashMatch = await bcrypt.compare(password, expectedHash);

  if (!emailMatch || !hashMatch) {
    return res.status(403).json({ message: "Invalid credentials" });
  }

  req.session.superAdmin = { authenticated: true };
  return res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});
```

### Pattern 2: In-Memory Error Ring Buffer

**What:** A module-level array capped at 50 entries. `console.error` is monkey-patched once at server startup. Ring buffer is exposed via the super-admin route.

```typescript
// server/lib/error-log.ts
export interface ErrorEntry {
  timestamp: string;   // ISO 8601
  message: string;
  stack?: string;
}

const MAX_ENTRIES = 50;
const errorLog: ErrorEntry[] = [];

export function appendError(entry: ErrorEntry) {
  errorLog.push(entry);
  if (errorLog.length > MAX_ENTRIES) {
    errorLog.shift();
  }
}

export function getRecentErrors(): ErrorEntry[] {
  return [...errorLog].reverse(); // most recent first
}

let patched = false;
export function patchConsoleError() {
  if (patched) return;
  patched = true;
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalError(...args);
    const message = args.map(a => (a instanceof Error ? a.message : String(a))).join(" ");
    const stack = args.find(a => a instanceof Error) instanceof Error
      ? (args.find(a => a instanceof Error) as Error).stack
      : undefined;
    appendError({ timestamp: new Date().toISOString(), message, stack });
  };
}
```

Call `patchConsoleError()` early in `server/index.ts` (before `registerRoutes`).

### Pattern 3: Stats Aggregation via Inline Drizzle Queries

Rather than adding 4 methods to `IStorage` (which requires interface + implementation), use inline `db.select()` calls directly in the super-admin route handler. Stats are a read-only dashboard concern — no need to pollute the general storage interface.

```typescript
// server/routes/super-admin.ts
import { db } from "../db";
import { bookings, contacts, services, staffMembers } from "@shared/schema";
import { count, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

router.get("/stats", requireSuperAdmin, async (_req, res) => {
  const [
    [{ bookingCount }],
    [{ contactCount }],
    [{ serviceCount }],
    [{ staffCount }],
  ] = await Promise.all([
    db.select({ bookingCount: count() }).from(bookings),
    db.select({ contactCount: count() }).from(contacts),
    db.select({ serviceCount: count() }).from(services).where(eq(services.isArchived, false)),
    db.select({ staffCount: count() }).from(staffMembers).where(eq(staffMembers.isActive, true)),
  ]);

  const uptimeSeconds = Math.floor(process.uptime());

  res.json({
    totalBookings: Number(bookingCount),
    totalContacts: Number(contactCount),
    totalServices: Number(serviceCount),
    totalStaff: Number(staffCount),
    serverUptimeSeconds: uptimeSeconds,
  });
});
```

### Pattern 4: Health Check

```typescript
router.get("/health", requireSuperAdmin, async (_req, res) => {
  const { collectRuntimeEnvDiagnostics } = await import("../lib/runtime-env");
  const diagnostics = collectRuntimeEnvDiagnostics();

  let dbConnected = false;
  try {
    const { ensureDatabaseReady } = await import("../db");
    await ensureDatabaseReady();
    dbConnected = true;
  } catch {}

  // Count migration files on disk
  const fs = await import("fs");
  const path = await import("path");
  const migDir = path.join(process.cwd(), "supabase", "migrations");
  let migrationCount = 0;
  try {
    const files = fs.readdirSync(migDir).filter(f => f.endsWith(".sql"));
    migrationCount = files.length;
  } catch {}

  res.json({
    dbConnected,
    migrationCount,
    envErrors: diagnostics.errors,
    envWarnings: diagnostics.warnings,
  });
});
```

**Migration count note:** There are currently **29 migration files** in `supabase/migrations/` as of Phase 36. The health check counts `.sql` files in that directory at runtime — simple and reliable.

### Pattern 5: Frontend Route Isolation

`/superadmin` must NOT render Navbar, Footer, or ChatWidget, and must NOT wrap with `AuthProvider` context. Follow the same isolation pattern used for `/admin`:

```typescript
// client/src/App.tsx  — inside Router()
const isSuperAdminRoute = location.startsWith('/superadmin');

if (isSuperAdminRoute) {
  return (
    <Suspense fallback={fallback}>
      <Switch>
        <Route path="/superadmin" component={SuperAdmin} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
```

The `SuperAdmin` page manages its own "logged in" state via a local cookie check (`GET /api/super-admin/me`).

### Anti-Patterns to Avoid

- **Do NOT add `superAdmin` to the existing `users` table or Supabase auth** — the spec explicitly requires separate env-var credentials.
- **Do NOT use HTTP Basic auth** — triggers browser native dialog, poor UX, harder to style a custom login page.
- **Do NOT use `(req.session as any)`** — add the TypeScript module augmentation in `server/types/session.d.ts` instead.
- **Do NOT persist error logs to the DB** — ring buffer is in-memory per spec (SADM-05).
- **Do NOT add `requireSuperAdmin` to existing admin routes** — super-admin routes are additive, existing `requireAdmin` routes are unchanged.
- **Do NOT import `AuthContext` in `SuperAdmin.tsx`** — it depends on Supabase which the super-admin flow does not use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing/comparison | Custom hash scheme | `bcrypt.compare()` | bcrypt ^6.0.0 already installed; bcrypt is timing-safe |
| Session management | JWT or custom cookie | `express-session` (already configured) | MemoryStore already running in index.ts |
| TypeScript session types | `(req.session as any)` | Module augmentation of `SessionData` | Correct approach, compile-time safe |
| Stats queries | New `IStorage` methods | Inline `db.select({ count: count() })` | Stats are dashboard-only; no need to pollute storage interface |
| Env var validation | Custom checks | `collectRuntimeEnvDiagnostics()` in `server/lib/runtime-env.ts` | Already implemented, covers all required env vars |

---

## Runtime State Inventory

Step 2.5: SKIPPED — this is a greenfield addition phase, not a rename/refactor/migration.

---

## Environment Availability

Step 2.6: No new external dependencies. All required tools are already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bcrypt` | SADM-01 password check | Yes | ^6.0.0 | — |
| `express-session` | SADM-01 session cookie | Yes | ^1.18.2 | — |
| Node.js `fs` module | SADM-03 migration count | Yes | built-in | — |
| `process.uptime()` | SADM-02 uptime | Yes | built-in | — |

---

## Common Pitfalls

### Pitfall 1: Session Cookie Not Sent from Frontend (SameSite / Secure)
**What goes wrong:** The session cookie set in `POST /api/super-admin/login` is not sent on subsequent requests from the React client in development.
**Why it happens:** `server/index.ts` sets `cookie: { secure: process.env.NODE_ENV === 'production' }` — so in dev (HTTP) `secure: false` is fine. But if the frontend makes cross-origin requests, `SameSite` defaults may block the cookie.
**How to avoid:** Since both client and API are served on the same origin (port 5000 via Vite proxy), cookies will be sent correctly in dev. In production (Vercel), the session cookie is secure and same-origin.
**Warning signs:** `403` on all routes after a successful login response.

### Pitfall 2: `console.error` Patched After Some Errors
**What goes wrong:** Early server errors (before `patchConsoleError()` is called) are not captured in the ring buffer.
**Why it happens:** `patchConsoleError()` must be called before `registerRoutes()` and `initializeSeedData()`. Place it as the first call after the express app is created.
**How to avoid:** Call `patchConsoleError()` in `server/index.ts` directly after imports, before all async startup.
**Warning signs:** Ring buffer is empty even though server has logged errors.

### Pitfall 3: `req.session.superAdmin` TypeScript Error Without Augmentation
**What goes wrong:** TypeScript reports "Property 'superAdmin' does not exist on type 'Session & Partial<SessionData>'" and code won't compile.
**Why it happens:** `express-session`'s `SessionData` interface doesn't have `superAdmin` by default.
**How to avoid:** Create `server/types/session.d.ts` with the module augmentation before writing any session access code.
**Warning signs:** TypeScript `npm run check` fails on session property access.

### Pitfall 4: Timing Attack on Email/Password Check
**What goes wrong:** An attacker can detect whether the email matches by measuring response time (bcrypt is skipped when email doesn't match).
**Why it happens:** Short-circuit evaluation: `if (emailMatch && hashMatch)` skips `bcrypt.compare` when email is wrong.
**How to avoid:** Always call `bcrypt.compare()` regardless of email match (use dummy hash comparison if needed), or use `Promise.all([emailCheck, bcrypt.compare()])` so timing is consistent.
**Warning signs:** Not directly observable — but matters for production security.

### Pitfall 5: Stats Endpoint Slow on Large Datasets
**What goes wrong:** `COUNT(*)` on `bookings` table is slow.
**Why it happens:** No index on booking count (full table scan).
**How to avoid:** For a single-tenant platform at current scale this is acceptable. Add a note in the route to cache stats if needed. `Promise.all` parallelizes all 4 counts.
**Warning signs:** Stats endpoint latency > 500ms.

### Pitfall 6: Migration Count Is Wrong If `supabase/migrations/` Has Non-SQL Files
**What goes wrong:** Health check reports wrong migration count.
**Why it happens:** `readdirSync` counts all files if not filtered.
**How to avoid:** Filter to `f.endsWith(".sql")` — already shown in Pattern 4.

---

## Code Examples

### Password Hash Generation (admin run once, set env var)

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yourpassword', 12).then(h => console.log(h))"
# Output: $2b$12$...  → set as SUPER_ADMIN_PASSWORD_HASH
```

### Complete `/api/super-admin/company-settings` Handlers

```typescript
// GET — view settings
router.get("/company-settings", requireSuperAdmin, async (_req, res) => {
  try {
    const settings = await storage.getCompanySettings();
    return res.json(settings);
  } catch (err) {
    return res.status(500).json({ message: (err as Error).message });
  }
});

// PATCH — edit settings (partial update)
router.patch("/company-settings", requireSuperAdmin, async (req, res) => {
  try {
    const updated = await storage.updateCompanySettings(req.body);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: (err as Error).message });
  }
});
```

### Session Check Endpoint (for frontend "am I logged in?" check)

```typescript
router.get("/me", (req, res) => {
  if (req.session.superAdmin?.authenticated === true) {
    return res.json({ authenticated: true });
  }
  return res.status(403).json({ authenticated: false });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt v5 API | bcrypt v6 — async API unchanged | 2024 | No API change; `bcrypt.compare(plain, hash)` is the same |
| express-session flat cookie | express-session + MemoryStore (already in use) | Set up in prior phases | Already configured; just extend `SessionData` |

---

## Open Questions

1. **`SUPER_ADMIN_PASSWORD_HASH` vs `SUPER_ADMIN_PASSWORD`**
   - What we know: CLAUDE.md says "ADMIN_PASSWORD_HASH" uses bcrypt. The spec says `SUPER_ADMIN_PASSWORD_HASH`.
   - What's unclear: Should the hash use bcrypt cost factor 10 or 12?
   - Recommendation: Use 12 (more secure, acceptable performance since login is rare). Document this in the plan task for env-var setup.

2. **Company settings edit scope in super-admin panel**
   - What we know: SADM-04 says "view and edit companySettings". The existing admin CompanySettingsSection has many tabs.
   - What's unclear: Should the super-admin panel have a full copy of the admin settings UI, or a simplified subset?
   - Recommendation: Simple JSON-based form or a subset (company name, contact info, timezone) — per the "simplicity over feature parity" memory directive. Do NOT replicate the full admin CompanySettingsSection.

3. **Session persistence across server restarts**
   - What we know: MemoryStore loses sessions on restart.
   - What's unclear: Is this acceptable for the super-admin use case?
   - Recommendation: Yes — super-admin sessions are rare and operator-controlled. MemoryStore is sufficient. Document that operators must re-login after a server restart.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no test config files found) |
| Config file | None — no pytest.ini, jest.config.*, vitest.config.* found |
| Quick run command | `npm run check` (TypeScript type checking only) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SADM-01 | POST /api/super-admin/login returns 403 with wrong creds | manual smoke | — | N/A |
| SADM-01 | POST /api/super-admin/login returns 200 with correct creds | manual smoke | — | N/A |
| SADM-02 | GET /api/super-admin/stats returns all 4 counts | manual smoke | — | N/A |
| SADM-03 | GET /api/super-admin/health returns dbConnected + migrationCount | manual smoke | — | N/A |
| SADM-04 | GET/PATCH /api/super-admin/company-settings works | manual smoke | — | N/A |
| SADM-05 | GET /api/super-admin/error-logs returns ring buffer | manual smoke | — | N/A |
| SADM-06 | All /api/super-admin/* return 403 without session | manual smoke | — | N/A |

**No automated test framework exists in the project.** Verification is TypeScript compilation (`npm run check`) plus manual browser testing.

### Sampling Rate
- **Per task commit:** `npm run check`
- **Per wave merge:** `npm run check && npm run build`
- **Phase gate:** `npm run build` succeeds + manual browser smoke test of all 6 SADM requirements

### Wave 0 Gaps
- None — no test infrastructure to create; manual smoke testing is the verification method for this project.

---

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `server/index.ts` — session configuration, MemoryStore setup
- Direct source code inspection: `server/lib/auth.ts` — `requireAdmin` middleware pattern to replicate
- Direct source code inspection: `server/routes.ts` — router mounting pattern
- Direct source code inspection: `server/lib/runtime-env.ts` — `collectRuntimeEnvDiagnostics()` reuse
- Direct source code inspection: `server/db.ts` — `ensureDatabaseReady()` for health check
- Direct source code inspection: `shared/schema.ts` — tables available for COUNT queries
- Direct source code inspection: `package.json` — bcrypt ^6.0.0, express-session ^1.18.2 confirmed installed
- Direct source code inspection: `client/src/App.tsx` — route isolation pattern (`isAdminRoute`, `isStaffRoute` blocks)
- Direct source code inspection: `supabase/migrations/` — 29 migration files confirmed (through Phase 36)

### Secondary (MEDIUM confidence)
- `@types/express-session` interface design — `SessionData` augmentation pattern is the documented approach for adding custom properties

### Tertiary (LOW confidence)
- None needed — all findings verified from source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json, all patterns verified in source
- Architecture: HIGH — directly derived from existing patterns in the codebase
- Pitfalls: HIGH — derived from TypeScript types and known session/bcrypt behavior
- Env var design: MEDIUM — bcrypt cost factor 12 is a reasonable recommendation but could differ from operator preference

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable deps, slow-moving domain)
