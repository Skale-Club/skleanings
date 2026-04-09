# Architecture

**Analysis Date:** 2026-04-04

## Pattern Overview

**Overall:** Monorepo with client-server architecture using Express API and React frontend

**Key Characteristics:**
- Single server handles both API and serves client assets in production
- Shared schemas and types between client and server via `@shared` alias
- Database-first design with Drizzle ORM for type-safe queries
- Session-based authentication with express-session

## Layers

**Frontend (Client):**
- Purpose: React UI for customer booking and admin management
- Location: `client/src/`
- Contains: Pages, components, hooks, contexts, utilities
- Depends on: React, TanStack Query, Radix UI, Tailwind CSS
- Used by: End users and administrators via browser

**Backend (Server):**
- Purpose: REST API, authentication, business logic, database access
- Location: `server/`
- Contains: Express routes, services, middleware, storage layer
- Depends on: Express, Drizzle ORM, Zod validation
- Used by: Client via HTTP calls

**Shared:**
- Purpose: Database schemas, Zod validation schemas, API route types
- Location: `shared/`
- Contains: Drizzle table definitions, insert schemas, route definitions
- Depends on: Drizzle ORM, Zod
- Used by: Both client and server for type safety

**Database:**
- Purpose: Persistent storage for bookings, services, users, settings
- Technology: PostgreSQL via Drizzle ORM
- Location: Managed in `server/storage.ts`

## Data Flow

**Customer Booking Flow:**
1. Customer visits site → React loads with lazy-loaded pages
2. Customer selects services → Added to cart context
3. Customer fills booking form → POST to `/api/bookings`
4. Server validates with Zod → Stores in PostgreSQL
5. Customer redirected to confirmation page

**Admin Management Flow:**
1. Admin logs in at `/admin-login` → Session created
2. Admin accesses `/admin` → Dashboard loads
3. Admin makes CRUD changes → API calls to `/api/bookings`, `/api/services`, etc.
4. Server validates → Updates database via storage layer

**API Request Flow:**
1. Client makes HTTP request to `/api/*`
2. Express routes request to handler in `server/routes/`
3. Handler validates input with Zod schemas from `shared/`
4. Handler calls storage functions from `server/storage.ts`
5. Storage executes Drizzle queries against PostgreSQL
6. Response returned to client

**State Management:**
- React Query for server state (bookings, services, settings)
- React Context for client state (cart, auth, theme, company settings)
- Server-side session storage for admin authentication

## Key Abstractions

**Routes:**
- Purpose: API endpoint definitions and handlers
- Examples: `server/routes/bookings.ts`, `server/routes/availability.ts`
- Pattern: Route file exports Express router with CRUD handlers

**Storage:**
- Purpose: Database abstraction layer
- Examples: `server/storage.ts` (68KB - large file with all CRUD operations)
- Pattern: Drizzle query builder with typed functions for each table

**Services:**
- Purpose: Business logic and external integrations
- Examples: `server/services/blog-generator.ts`, `server/services/cron.ts`
- Pattern: AI-powered blog generation, scheduled tasks

## Entry Points

**Server:**
- Location: `server/index.ts`
- Triggers: Node.js process (`npm run dev` or `npm run start`)
- Responsibilities: Express app initialization, route registration, static file serving, cron job startup

**Client:**
- Location: `client/src/main.tsx`
- Triggers: Browser loads `client/index.html`
- Responsibilities: React app mount, routing setup, provider composition

**Build:**
- Location: `script/build.mjs`
- Triggers: `npm run build` or Vercel deployment
- Responsibilities: Client build with Vite, server bundling with esbuild

## Error Handling

**Strategy:** Express error middleware with status codes and JSON responses

**Patterns:**
- Zod validation errors return 400 with field details
- Not found errors return 404 with message
- Database errors return 500 with generic message
- Route handlers wrap in try-catch for async errors

## Cross-Cutting Concerns

**Logging:** Custom `log()` function in `server/index.ts` with timestamps and JSON response capturing for API routes

**Validation:** Zod schemas defined in `shared/` used for both request validation and type inference

**Authentication:** Session-based auth using `express-session` with MemoryStore; admin check middleware in `server/middleware/`

**Database:** Drizzle ORM with PostgreSQL; tables defined in `shared/schema.ts`; migrations via Drizzle Kit
