# Chat Refactor Plan

This plan compares the current `skleanings` chat stack to the Vercel AI Chatbot template and turns that comparison into a concrete migration path.

The goal is not to rewrite this project around Next.js. The goal is to keep the booking and intake behavior that already works, while borrowing the architectural patterns that make the Vercel example easier to maintain.

## Goals

- Shrink the chat control surface by breaking up the current monolith.
- Preserve booking safety guarantees:
  - explicit confirmation before booking creation
  - server-side validation of required fields
  - server-side slot locking and conflict checks
  - recovery when the model fabricates a confirmation
- Make tools type-safe and independently testable.
- Move provider-specific logic out of the main request handler.
- Create a path to streamed responses and better frontend state handling without forcing a full UI rewrite.

## Non-Goals

- Do not migrate the app to Next.js.
- Do not replace the booking domain model with generic AI SDK abstractions.
- Do not remove existing time-slot lock, GHL sync, or intake enforcement safeguards during refactor.

## Current Problems

The current chat system works, but the orchestration is too concentrated:

- `server/routes/chat/message-handler.ts`
  - request validation
  - rate limiting
  - provider selection
  - prompt assembly
  - memory loading and updating
  - auto-add and auto-booking logic
  - tool execution loop
  - fallback response repair
  - persistence
- `server/routes/chat/tools.ts`
  - tool schema definitions
  - tool descriptions
  - cache
  - matching logic
  - all tool handlers
  - booking creation logic

This increases the cost of every booking-related change and makes regression risk hard to isolate.

## What To Borrow From Vercel

Borrow these patterns:

- Thin route layer that validates input and delegates orchestration.
- Dedicated provider abstraction for model selection and capability flags.
- Tool definitions as small modules with explicit input schemas.
- Structured error model with stable codes and HTTP mapping.
- Dedicated DB/query layer for chat persistence.
- Frontend transport/state abstraction instead of large component-local state.

Do not borrow these as-is:

- Next.js route conventions
- `server-only`
- App Router specifics
- Vercel-only resumable stream plumbing

## Target Architecture

Target server layout:

```text
server/routes/chat/
  index.ts
  route-message.ts
  route-config.ts
  constants.ts
  errors.ts
  providers.ts
  prompts.ts
  rate-limit.ts
  conversation-service.ts
  memory-service.ts
  booking-orchestrator.ts
  tool-runner.ts
  response-service.ts
  tools/
    registry.ts
    schemas.ts
    list-services.ts
    get-service-details.ts
    add-service.ts
    update-contact.ts
    update-memory.ts
    suggest-booking-dates.ts
    create-booking.ts
    view-cart.ts
    search-faqs.ts
    get-business-policies.ts
    shared.ts
    cache.ts
```

Target frontend layout:

```text
client/src/components/chat/
  ChatWidget.tsx
  useBookingChat.ts
  chat-types.ts
  chat-storage.ts
  chat-transport.ts
  chat-history.ts
```

## Proposed Module Boundaries

### `route-message.ts`

Owns:

- request schema validation
- HTTP status mapping
- calling the chat orchestrator

Does not own:

- prompt assembly
- direct provider branching
- tool execution details

### `providers.ts`

Owns:

- active provider selection
- API key resolution
- model resolution
- capability flags
  - supports parallel tool calls
  - supports streaming
  - supports reasoning or fallback behavior

### `prompts.ts`

Owns:

- prompt template loading
- dynamic variable interpolation
- intake enforcement text
- business info system blocks
- memory context formatting

### `conversation-service.ts`

Owns:

- create/load/update conversation
- add public and internal messages
- emit conversation events
- load paginated history

### `memory-service.ts`

Owns:

- reading normalized memory state
- extracting collected data and cart
- saving partial updates
- suggested slot context persistence
- deriving next intake objective

### `tool-runner.ts`

Owns:

- tool dispatch
- tool argument parsing
- tool call/result logging
- wrapping tool errors into `ChatError`
- AI SDK tool registration later

### `booking-orchestrator.ts`

Owns:

- auto-add safety net
- explicit confirmation gate
- auto-book attempt helper
- fabricated-confirmation safety net
- booking result normalization

This is where the domain complexity should live after extraction.

### `response-service.ts`

Owns:

- second-pass response generation
- post-tool response repair
- ensuring availability suggestions are surfaced
- ensuring next intake question is appended when required

## Migration Strategy

Refactor in phases. Do not attempt a full rewrite in one branch.

### Phase 0: Safety Harness

Before moving logic:

- Add focused tests around:
  - add service
  - update contact
  - suggest booking dates
  - create booking
  - auto-book confirmation gate
  - slot lock failure path
  - fabricated booking confirmation recovery
- Add fixtures for representative memory states.
- Add a small chat error model.

Deliverables:

- `server/routes/chat/errors.ts`
- initial tests for critical flows

Acceptance criteria:

- Existing booking behavior remains stable under test.

### Phase 1: Extract Tool Runtime

Use the existing `tools/registry.ts` and `tools/schemas.ts` as the foundation.

Tasks:

- Move each tool handler out of `tools.ts` into its own file.
- Keep `tools.ts` as a compatibility wrapper temporarily.
- Route all tool execution through `tools/registry.ts`.
- Move cache helpers into `tools/cache.ts`.
- Move shared helper logic into `tools/shared.ts`.

Files to create or complete:

- `server/routes/chat/tools/list-services.ts`
- `server/routes/chat/tools/get-service-details.ts`
- `server/routes/chat/tools/add-service.ts`
- `server/routes/chat/tools/update-contact.ts`
- `server/routes/chat/tools/update-memory.ts`
- `server/routes/chat/tools/suggest-booking-dates.ts`
- `server/routes/chat/tools/create-booking.ts`
- `server/routes/chat/tools/search-faqs.ts`
- `server/routes/chat/tools/get-business-policies.ts`

Files to shrink:

- `server/routes/chat/tools.ts`

Acceptance criteria:

- `message-handler.ts` no longer contains tool-specific logic beyond invoking the runner.
- Tool input validation is centralized in Zod schemas.

### Phase 2: Extract Orchestration Services

Tasks:

- Move provider selection out of `message-handler.ts` into `providers.ts`.
- Move prompt assembly into `prompts.ts`.
- Move conversation and message persistence into `conversation-service.ts`.
- Move memory handling and next-objective logic into `memory-service.ts`.
- Move auto-booking and safety nets into `booking-orchestrator.ts`.
- Move response repair logic into `response-service.ts`.

Files to create:

- `server/routes/chat/providers.ts`
- `server/routes/chat/prompts.ts`
- `server/routes/chat/conversation-service.ts`
- `server/routes/chat/memory-service.ts`
- `server/routes/chat/booking-orchestrator.ts`
- `server/routes/chat/response-service.ts`
- `server/routes/chat/tool-runner.ts`

Files to shrink:

- `server/routes/chat/message-handler.ts`

Acceptance criteria:

- `message-handler.ts` becomes request orchestration only.
- booking logic becomes readable without scrolling through provider and prompt code.

### Phase 3: Introduce Structured Errors

Tasks:

- Define stable error codes:
  - `bad_request:chat`
  - `rate_limit:chat`
  - `provider:chat`
  - `booking:slot_locked`
  - `booking:slot_unavailable`
  - `booking:missing_fields`
  - `integration:ghl`
  - `database:chat`
- Update route and tool runner to throw typed errors instead of returning mixed string payloads.
- Keep user-facing messages localized at the edge.

Acceptance criteria:

- Route-level responses are predictable.
- Logs can be filtered by stable error code.

### Phase 4: AI SDK Server Migration

This is the first major behavior shift. Do it after the modular split.

Tasks:

- Introduce a provider adapter that can return an AI SDK model handle.
- Replace manual provider branching and raw `chat.completions.create` calls with `streamText` or `generateText`.
- Register chat tools through AI SDK `tool()` wrappers backed by the existing handlers.
- Preserve server-side booking guardrails:
  - confirmation gate before `create_booking`
  - time-slot locking
  - conflict checks
  - fabricated-confirmation recovery

Important constraint:

- Do not let SDK tool approval replace server-side booking confirmation logic. The SDK can support approval UX later, but booking safety must remain enforced in domain code.

Acceptance criteria:

- Message route no longer manually constructs second-pass tool messages.
- Provider-specific request options are isolated in `providers.ts`.

### Phase 5: Frontend State Extraction

Tasks:

- Extract widget state and transport logic from `ChatWidget.tsx` into `useBookingChat.ts`.
- Move persistence helpers into `chat-storage.ts`.
- Move API transport and retry rules into `chat-transport.ts`.
- Move history fetch/pagination into `chat-history.ts`.

Keep in `ChatWidget.tsx`:

- layout
- launcher behavior
- welcome bubble behavior
- rendering
- analytics triggers

Move out:

- message send lifecycle
- retry and error mapping
- storage recovery
- history pagination mechanics

Acceptance criteria:

- `ChatWidget.tsx` becomes primarily UI composition.
- Chat transport can later switch from request/response to streaming with limited UI churn.

### Phase 6: Streaming and Approval UX

Only start this after Phase 4 and Phase 5 are stable.

Tasks:

- Add streamed assistant output for the public widget.
- Evaluate whether booking summary confirmation should use:
  - plain text confirmation
  - explicit confirm button
  - AI SDK approval parts
- Add resumable streams only if user experience clearly benefits from it.

Recommendation:

- For `skleanings`, explicit booking summary UI is higher value than resumable streams.

## Exact File Priorities

Start here:

1. `server/routes/chat/tools.ts`
2. `server/routes/chat/message-handler.ts`
3. `client/src/components/chat/ChatWidget.tsx`

Do not start with:

- admin chat dashboard files
- generic styling changes
- framework migration

## Recommended First PR Sequence

### PR 1: Error Model + Tool Extraction Scaffold

- add `server/routes/chat/errors.ts`
- finish tool registry usage
- move one or two low-risk tools first:
  - `list_services`
  - `search_faqs`

### PR 2: Booking Tool Extraction

- move:
  - `add_service`
  - `update_contact`
  - `suggest_booking_dates`
  - `create_booking`
- add tests for lock and availability failure paths

### PR 3: Message Handler Decomposition

- add:
  - `providers.ts`
  - `prompts.ts`
  - `booking-orchestrator.ts`
  - `response-service.ts`
- reduce `message-handler.ts` to orchestration

### PR 4: Frontend Hook Extraction

- add `useBookingChat.ts`
- move transport/retry/history logic out of `ChatWidget.tsx`

### PR 5: AI SDK Server Adoption

- replace raw provider request construction
- keep the new internal module boundaries

## Risks and Controls

### Risk: Prompt and server logic drift

Current risk:

- the prompt tells the model what should happen
- the server silently repairs or blocks invalid behavior later

Control:

- keep business rules server-authoritative
- move repair logic into named modules
- document every enforced rule in both prompt docs and code comments only where needed

### Risk: Booking regressions during AI SDK migration

Control:

- migrate after extraction, not before
- preserve current tool handler contracts
- verify create-booking edge cases with tests before changing runtime

### Risk: Partial refactor leaves two tool systems

Control:

- make `tools/registry.ts` the single runtime entrypoint early
- keep `tools.ts` as a wrapper only until all handlers are migrated

### Risk: Streaming increases frontend complexity

Control:

- extract `useBookingChat` first
- do not combine streaming migration with widget redesign

## Success Metrics

The refactor is successful when:

- `server/routes/chat/message-handler.ts` is less than 20 KB and mostly orchestration.
- `server/routes/chat/tools.ts` is reduced to compatibility exports or removed.
- each tool lives in its own module with a schema and handler.
- booking failure paths are covered by tests.
- the widget can change transport strategy without another giant component rewrite.

## Immediate Recommendation

Start with Phase 1 and Phase 3 together:

- finish the tool registry migration
- add typed chat errors

That gives the fastest improvement in maintainability without risking the booking flow.
