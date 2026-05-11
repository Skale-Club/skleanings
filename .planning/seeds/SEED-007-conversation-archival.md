---
id: SEED-007
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Only a problem with real volume (12+ months)
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: when chat accumulates >6 months of conversations, or when admin queries become slow
scope: Small
---

# SEED-007: Chat conversation archival and pagination

## Why This Matters

The `conversations` and `conversationMessages` tables grow indefinitely with no archival or cleanup policy. The conversation memory (`conversations.memory` JSONB) also grows unbounded for long conversations. After 6-12 months in production with active chat, the messages table will have tens of thousands of records that impact admin queries.

**Why:** The admin dashboard lists all conversations at once (no backend pagination in some queries). As volume grows, chat dashboard load time will progressively increase.

## When to Surface

**Trigger:** when the admin starts complaining about chat dashboard slowness, when the `conversationMessages` table exceeds 50k records, or when starting a performance milestone.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Performance / scalability milestone
- Ops / data maintenance milestone
- 6+ months after chat is in production use

## Scope Estimate

**Small** — A few hours. Add: (1) backend pagination on `GET /api/conversations`, (2) `archivedAt` column on `conversations`, (3) monthly cron job that archives closed conversations >90 days old, (4) truncate `memory` JSONB to last N turns.

## Breadcrumbs

- `shared/schema.ts` — `conversations`, `conversationMessages` tables (no `archivedAt`)
- `server/storage.ts` — `getConversations()` — verify if it has LIMIT
- `server/routes.ts` — `GET /api/conversations` — verify pagination
- `client/src/components/admin/` — chat section that lists conversations

## Notes

Archival ≠ deletion. Archived conversations must be queryable by ID but excluded from default listings. The `memory` JSONB cleanup must keep only the last 10 messages to limit tokens used in chat context re-hydration.
