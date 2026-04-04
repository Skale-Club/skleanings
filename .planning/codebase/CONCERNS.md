# Codebase Concerns

**Analysis Date:** 2026-04-04

## Testing Gaps

**No Automated Test Suite:**
- No test framework configured (no Jest, Vitest, or similar)
- No test files found anywhere in the codebase (`*.test.*`, `*.spec.*`)
- Critical flows (booking, admin CRUD, availability) require manual verification per `AGENTS.md`
- Risk: Silent regressions in business-critical functionality

## Error Handling Issues

**Silent Failures in Critical Paths:**
- Files: `server/routes/chat/utils.ts`, `server/lib/auth.ts`, `server/lib/google-calendar.ts`
- Many catch blocks return `null`, `[]`, or `{}` without logging errors
- Example at `server/lib/auth.ts:34`: `catch { return null; }` swallows errors entirely
- Impact: Failures are invisible to operators; debugging requires code inspection
- Fix: Add error logging with context before returning defaults

**Empty Returns Without Context:**
- Files: `server/storage.ts:504`, `server/storage.ts:556`, `server/storage.ts:594`
- Pattern: `if (relations.length === 0) return []` without indication of why data is empty
- Risk: Distinguishing between "no data" and "query failed" is impossible

## Authentication & Session Concerns

**Dual Auth Middleware:**
- Files: `server/middleware/auth.ts` (56 lines), `server/lib/auth.ts` (79 lines)
- Both export `requireAuth` and `requireAdmin` - inconsistent naming and behavior
- `server/middleware/auth.ts` uses `req.session` but `server/lib/auth.ts` uses Bearer tokens
- `server/middleware/auth.ts:43` - `requireAdmin` checks session but assumes Supabase token in `requireAuth`
- Fix: Consolidate to single auth strategy

**Insecure Session Secret Fallback:**
- File: `server/index.ts:43`
- Code: `secret: process.env.SESSION_SECRET || "default_secret"`
- Risk: Default secret allows session hijacking in misconfigured deployments
- Fix: Fail startup if `SESSION_SECRET` is missing in production

**Memory Store for Sessions:**
- File: `server/index.ts:40`
- Uses `MemoryStore` which does not persist across server restarts
- Users lose sessions on deploy/restart
- Fix: Use PostgreSQL session store (`connect-pg-simple`) or Redis

## Security Considerations

**API Key Exposure via Error Messages:**
- Files: `server/lib/stripe.ts:11`, `server/lib/openai.ts:17`, `server/lib/gemini.ts:22`
- Integration errors reveal configuration requirements but may leak implementation details
- Example: `throw new Error("Stripe not connected...")` exposes integration flow
- Risk: Information disclosure about missing integrations

**Missing Input Validation:**
- File: `server/routes/bookings.ts`
- Most routes lack Zod validation on incoming POST/PUT payloads
- Risk: Invalid data corrupts database; injection attacks possible
- Fix: Add Zod schemas to all mutation endpoints

**Raw SQL in Storage Layer:**
- File: `server/storage.ts:367-425`
- Uses `db.execute(sql`ALTER TABLE...`)` for migrations instead of Drizzle migrations
- Risk: SQL injection (low probability), schema drift, migration failures
- Fix: Use proper Drizzle migrations via `drizzle-kit`

## Performance Bottlenecks

**Large Monolithic Files:**
- `server/storage.ts`: 1724 lines - single file handles all database operations
- `server/routes/chat/message-handler.ts`: 1616 lines - massive message handling logic
- `server/routes.ts`: 62 lines (router registration) but 2800+ total route code
- Impact: Hard to test, reason about, and maintain
- Fix: Break into domain-specific modules (e.g., `storage/bookings.ts`, `storage/users.ts`)

**No Caching Strategy:**
- Chat config caches manually (`server/routes/chat/index.ts:32`)
- No Redis or distributed caching for expensive queries
- Repeated availability checks hit database repeatedly

**N+1 Query Risk:**
- File: `server/storage.ts`
- Relationships loaded separately (e.g., booking items fetched per booking)
- Example: `getBookingWithItems` may trigger multiple queries

## Dependency & Configuration Risks

**Environment Variable Confusion:**
- 106+ occurrences of `process.env` with inconsistent naming
- Multiple fallbacks: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `VITE_SUPABASE_URL`
- Risk: Unexpected behavior when expected env vars are missing
- Fix: Document all required env vars; validate at startup

**Outdated Stripe API Version:**
- File: `server/lib/stripe.ts:13`
- Uses `apiVersion: "2026-03-25.dahlia"` - future-dated API version
- Risk: API deprecation or breaking changes without notice

**Missing Graceful Degradation:**
- Integrations (Stripe, GHL, Twilio, Telegram) fail without fallback
- File: `server/routes/payments.ts`
- If Stripe is down, entire checkout flow breaks
- Fix: Queue payments for retry or show fallback messaging

## Fragile Areas

**Chat Tool Registry:**
- File: `server/routes/chat/tools/registry.ts`
- Complex tool registration with magic strings
- Adding/removing tools requires manual coordination

**Rate Limiting Inconsistency:**
- File: `server/lib/rate-limit.ts`
- Only chat endpoints have rate limiting
- Public endpoints (catalog, company settings) unprotected
- Fix: Apply rate limiting at API gateway level or middleware

**Calendar Reconnection Logic:**
- Files: `server/lib/google-calendar.ts`, `server/integrations/ghl.ts`
- Complex OAuth flows with multiple retry mechanisms
- Tokens expire silently; reconnect banner shown but flow may fail

## Missing Documentation

**No API Documentation:**
- `shared/routes.ts` exists but no OpenAPI/Swagger spec
- Developers must read code to understand endpoints

**No Architecture Decision Records (ADRs):**
- Key decisions undocumented (why Drizzle? why Express? why Supabase?)

**No Runbook:**
- No guidance for common operational tasks (database recovery, integration reconnection)

---

*Concerns audit: 2026-04-04*
