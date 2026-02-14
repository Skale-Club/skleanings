# Chat Module Dependency Injection

## Overview

The chat module now supports **dependency injection** for storage, integrations (GHL, Twilio), and OpenAI client. This enables:

- **Multi-tenant isolation** - different tenants can use different databases/APIs
- **Testing** - mock dependencies without modifying production code
- **Flexibility** - swap implementations without changing tool code

## Architecture

### Dependencies File

`server/routes/chat/dependencies.ts` provides:

```typescript
import { chatDeps, setChatDependencies, resetChatDependencies } from './dependencies';

// Access dependencies
const services = await chatDeps.storage.getServices();
const contact = await chatDeps.ghl.getOrCreateGHLContact(...);

// Override for testing/multi-tenant
setChatDependencies({
  storage: mockStorage,
  ghl: mockGHL,
});

// Reset to defaults
resetChatDependencies();
```

### Default Dependencies

By default, `chatDeps` uses:
- `storage` - from `server/storage.ts` (IStorage interface)
- `ghl` - from `server/integrations/ghl.ts`
- `twilio` - from `server/integrations/twilio.ts`
- `getOpenAIClient` - from `server/lib/openai.ts`

## Migration Status

### ✅ Phase 1: Infrastructure Created

- [x] Created `dependencies.ts` with DI system
- [x] Added `chatDeps` convenience export
- [x] Imported in `tools.ts`

### 🔄 Phase 2: Gradual Migration (In Progress)

The existing code still uses direct imports (`storage`, `getGHLFreeSlots`, etc.). Migration to `chatDeps` should be done **gradually** and **on-demand**:

- **Legacy code**: Keep using direct imports (`storage.getServices()`)
- **New code**: Use `chatDeps.storage.getServices()`
- **Refactor when touched**: When editing a function, migrate it to use `chatDeps`

This approach avoids breaking changes while providing the infrastructure for future improvements.

## Usage Examples

### Testing with Mock Storage

```typescript
import { setChatDependencies, resetChatDependencies } from './dependencies';

describe('Chat Tools', () => {
  beforeEach(() => {
    // Set up mock storage
    const mockStorage = {
      getServices: async () => [{ id: 1, name: 'Test Service', price: '50.00' }],
      getConversation: async (id) => ({ id, status: 'open', memory: {} }),
      // ... other methods
    };

    setChatDependencies({ storage: mockStorage });
  });

  afterEach(() => {
    resetChatDependencies();
  });

  it('should list services', async () => {
    const result = await runChatTool('list_services', {});
    expect(result.services).toHaveLength(1);
  });
});
```

### Multi-Tenant Isolation

```typescript
import { setChatDependencies } from './routes/chat/dependencies';
import { createTenantStorage } from './multi-tenant/storage';

app.use(async (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];

  // Create tenant-specific storage instance
  const tenantStorage = await createTenantStorage(tenantId);

  // Override dependencies for this request
  setChatDependencies({ storage: tenantStorage });

  next();
});
```

### Custom GHL Integration

```typescript
import { setChatDependencies } from './routes/chat/dependencies';
import * as customGHL from './custom-ghl-integration';

// Use custom GHL integration for specific tenant
setChatDependencies({
  ghl: customGHL
});
```

## Migration Checklist

When refactoring a chat tool function:

- [ ] Replace `storage.method()` with `chatDeps.storage.method()`
- [ ] Replace `getGHLFreeSlots()` with `chatDeps.ghl.getGHLFreeSlots()`
- [ ] Replace `sendNewChatNotification()` with `chatDeps.twilio.sendNewChatNotification()`
- [ ] Replace `getOpenAIClient()` with `chatDeps.getOpenAIClient()`
- [ ] Add comment: `// ✅ DEPENDENCY INJECTION: Uses chatDeps`

## Benefits

### Before (Direct Imports)

```typescript
import { storage } from "../../storage";
import { getGHLFreeSlots } from "../../integrations/ghl";

async function myTool() {
  const services = await storage.getServices(); // Hard to test
  const slots = await getGHLFreeSlots(...); // Hard to mock
}
```

### After (Dependency Injection)

```typescript
import { chatDeps } from "./dependencies";

async function myTool() {
  const services = await chatDeps.storage.getServices(); // Easy to mock
  const slots = await chatDeps.ghl.getGHLFreeSlots(...); // Easy to test
}
```

## Future Improvements

1. **Middleware-based injection** - automatically set dependencies per request based on tenant
2. **Async configuration** - load tenant-specific configs from database
3. **Scoped dependencies** - different dependency instances per conversation
4. **Performance monitoring** - wrap dependencies with telemetry

## Compatibility

This system is **100% backward compatible**. Existing code continues to work unchanged. The DI system is opt-in for new features and gradual migration.
