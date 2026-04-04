# Testing Patterns

**Analysis Date:** 2026-04-04

## Test Framework

**Status:** No automated test runner configured

The codebase does not have any automated testing framework (Jest, Vitest, Playwright, Cypress, etc.) installed. Per AGENTS.md: "No automated test runner is configured currently."

**TypeScript Checking:**
```bash
npm run check    # Runs tsc (TypeScript compiler)
```

This command performs type checking only - it does not run tests.

## Test File Organization

**Location:** Not applicable - no test files exist

**Pattern:** None - tests are not part of the current workflow

**Note:** The `tsconfig.json` explicitly excludes `**/*.test.ts` from compilation:
```json
"exclude": ["node_modules", "build", "dist", "**/*.test.ts"]
```

This suggests some consideration for test files, but no tests have been created.

## Test Structure

**Not applicable** - No test files in the codebase

## Mocking

**Not applicable** - No test framework configured

## Fixtures and Factories

**Not applicable** - No test framework configured

## Coverage

**Requirements:** None enforced

No code coverage tool is configured or run.

## Test Types

**Unit Tests:** None

**Integration Tests:** None

**E2E Tests:** None

## Manual Testing Approach

Despite the lack of automated tests, the codebase demonstrates testing awareness through:

### data-testid Attributes

The codebase extensively uses `data-testid` attributes for UI elements, enabling reliable selectors for manual testing or future automation.

**Examples from `client/src/pages/Home.tsx`:**
```tsx
<h2 data-testid="text-blog-section-title">...</h2>
<Link data-testid="link-view-all-blog">...</Link>
<Link data-testid={`link-blog-card-${post.id}`}>...</Link>
<button data-testid="button-hero-cta">...</button>
```

**Examples from `client/src/components/admin/StaffSection.tsx`:**
```tsx
<div data-testid={`staff-item-${member.id}`}>
<Switch data-testid={`switch-staff-active-${member.id}`}>
<Button data-testid="button-add-staff">
<Input data-testid="input-staff-first-name">
```

**Total usage:** 241 `data-testid` attributes found across the codebase

### Pattern for data-testid

- Element type prefix: `button-*`, `input-*`, `text-*`, `img-*`, `link-*`, `select-*`, `switch-*`, `row-*`, `badge-*`, `nav-*`
- Dynamic IDs: `${elementType}-${entityType}-${id}` (e.g., `button-blog-edit-5`)
- Consistent naming following functional hierarchy

## Common Patterns (for future test implementation)

### React Query Data Fetching

From `client/src/hooks/use-auth.ts`:
```typescript
const { data: user, isLoading } = useQuery<User | null>({
  queryKey: ["/api/auth/user"],
  queryFn: fetchUser,
  retry: false,
  staleTime: 1000 * 60 * 5, // 5 minutes
});
```

Testing approach: Mock the fetch function or use MSW (Mock Service Worker) to intercept HTTP requests.

### Server Route Testing

From `server/routes/auth.ts`: Express route handlers with Zod validation

Testing approach: Supertest or similar for HTTP integration testing

### Zod Schema Validation

From `shared/routes.ts`:
```typescript
export const insertBookingSchema = insertBookingSchemaBase.refine(
  (data) => (data.cartItems && data.cartItems.length > 0) || (data.serviceIds && data.serviceIds.length > 0),
  { message: "Select at least one service" }
);
```

Testing approach: Unit tests for schema validation directly

## Recommended Testing Setup

Based on the codebase patterns, if automated testing were to be added:

1. **Unit Tests:** Vitest or Jest
   - TypeScript support
   - Compatible with existing codebase

2. **Component Testing:** React Testing Library
   - Works with existing data-testid patterns
   - Encourages accessibility-first testing

3. **E2E Tests:** Playwright (if needed)
   - Can use existing data-testid selectors
   - Good for critical user flows

4. **Key flows to test:**
   - Booking flow (selection → cart → confirmation)
   - Admin CRUD operations
   - Authentication
   - Availability checking

---

*Testing analysis: 2026-04-04*