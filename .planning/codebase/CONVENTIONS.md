# Coding Conventions

**Analysis Date:** 2026-04-04

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `Admin.tsx`, `ServiceCard.tsx`, `ChatWidget.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `use-auth.ts`, `use-booking.ts`, `use-toast.ts`)
- Utils/lib: camelCase (e.g., `utils.ts`, `analytics.ts`, `queryClient.ts`)
- Server routes: camelCase (e.g., `auth-routes.ts`, `blog.ts`)
- Shared schemas: camelCase (e.g., `schema.ts`, `routes.ts`)

**Functions:**
- React components: PascalCase (exported function components)
- Hooks: camelCase starting with `use` (e.g., `useAuth()`, `useSupabaseAuth()`)
- Server utilities: camelCase (e.g., `log()`, `fetchUser()`)

**Variables:**
- camelCase for most variables (e.g., `user`, `isLoading`, `queryClient`)
- PascalCase for React components and types
- SCREAMING_SNAKE_CASE for constants (e.g., `ROLE_FETCH_RETRY_DELAYS_MS`)

**Types:**
- PascalCase for all type definitions (e.g., `AuthContextType`, `UserRole`, `Booking`)
- TypeScript interfaces preferred for object shapes
- Zod schemas for validation with `insertXSchema` naming pattern

## Code Style

**Formatting:**
- No configured formatter - relies on editor defaults
- Indentation: 2 spaces (per AGENTS.md guidelines)
- No automated code formatting in build pipeline

**Linting:**
- No ESLint or other linter configured
- No lint script in package.json
- TypeScript `strict: true` enabled in tsconfig.json
- `npm run check` runs TypeScript type checking only

**TypeScript Configuration:**
- Target: ES2018
- Module: ESNext
- Strict mode enabled
- Path aliases configured: `@/*` for `client/src/*`, `@shared/*` for `shared/*`

## Import Organization

**Order:**
1. React imports (from "react")
2. External libraries (from "@tanstack/react-query", "wouter", etc.)
3. Path alias imports (from "@/", "@shared/")
4. Relative imports (from "./" or "../")

**Path Aliases Used:**
```typescript
import { useAuth } from "@/hooks/use-auth";
import type { BlogPost } from "@shared/schema";
import { ServiceCard } from "@/components/ui/ServiceCard";
```

**Example from `client/src/pages/Home.tsx`:**
```typescript
import { useEffect, useRef, useState } from "react";
import { useCategories, useServices } from "@/hooks/use-booking";
import { Link, useLocation } from "wouter";
import { ArrowRight, Star, Shield, Clock } from "lucide-react";
import { CartSummary } from "@/components/CartSummary";
import { useQuery } from "@tanstack/react-query";
import type { BlogPost, HomepageContent } from "@shared/schema";
```

## Error Handling

**Client-side:**
- React Query handles API errors with throw and error boundaries
- Custom `fetchJsonOrThrow` helper for API calls
- Error states handled with isLoading/isError pattern

**Server-side:**
- Zod validation for request bodies
- Custom error schemas in `shared/routes.ts`
- Try/catch blocks with graceful fallbacks (e.g., role fetching with retries)

**Example pattern from `client/src/context/AuthContext.tsx`:**
```typescript
try {
  for (let attempt = 0; attempt < ROLE_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    // Fetch with retries
  }
} catch {
  // Silently fail — role stays null
} finally {
  if (!cancelled) setLoading(false);
}
```

## Logging

**Framework:** Console-based

**Server logging (`server/lib/logger.ts`):**
```typescript
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
```

**Client analytics:**
- `trackCTAClick()`, `trackCallClick()` in `client/src/lib/analytics.ts`
- Vercel Analytics and Speed Insights integrated

## Comments

**When to Comment:**
- Complex logic with retry mechanisms (documented with comments)
- Workarounds and temporary solutions
- Magic numbers explained (e.g., `staleTime: 1000 * 60 * 5 // 5 minutes`)

**TSDoc/JSDoc:**
- Not consistently used
- Type definitions serve as documentation in many cases

**Example with comments:**
```typescript
// 5 minutes
staleTime: 1000 * 60 * 5,

// Check active session
supabase.auth.getSession().then(({ data: { session } }) => { ... });

// Listen for auth changes
const { data: { subscription } } = supabase.auth.onAuthStateChange(...);
```

## Function Design

**Size:** No strict rules, functions can be long in server route handlers

**Parameters:**
- Explicit typing required for function parameters
- Zod schemas for API input validation

**Return Values:**
- Always typed explicitly
- Use Promise<T> for async functions

## Module Design

**Exports:**
- Named exports preferred for utilities and hooks
- Default exports for React components
- Re-export patterns in `client/src/components/pricing/index.ts`

**Barrel Files:**
- Used in `client/src/components/ui/` for UI components
- Used in `client/src/components/pricing/` for pricing components

**Example (from `client/src/components/pricing/index.ts`):**
```typescript
export * from "./OptionsSelector";
export * from "./FrequencySelector";
// etc.
```

## React Patterns

**Component Structure:**
- Props destructured in function signature
- Context usage with custom hooks
- Data fetching via TanStack React Query

**State Management:**
- React Query for server state
- React Context for client state (AuthContext, CartContext, ThemeContext, CompanySettingsContext)
- Local useState for component-specific state

**UI Components:**
- Radix UI primitives for complex components
- Tailwind CSS for styling
- shadcn/ui-like component patterns (from UI library)

---

*Convention analysis: 2026-04-04*