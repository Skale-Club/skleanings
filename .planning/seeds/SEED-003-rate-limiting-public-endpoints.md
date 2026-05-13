---
id: SEED-003
status: shipped
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: before any paid marketing campaign, or when the domain goes public/indexed
scope: Small
---

# SEED-003: Rate limiting on public analytics and chat endpoints

## Why This Matters

The endpoints `POST /api/analytics/session` and `POST /api/analytics/events` are completely public and have no abuse protection. A bot can create thousands of `visitorSessions` per minute, inflating the marketing dashboard with fake data and potentially exhausting PostgreSQL connections. The chat (`POST /api/chat/message`) is also public and can be abused to drain OpenAI/Gemini quotas.

**Why:** STATE.md has recorded this as a blocker since Phase 10: "Rate limiting strategy for POST /api/analytics/session (public endpoint) — not yet designed". It was never resolved.

## When to Surface

**Trigger:** before running any paid traffic campaign (Google Ads, Meta Ads), before adding the domain to a public directory, or when organic traffic starts growing.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Performance/scalability milestone
- Pre-launch milestone for a marketing campaign
- Hardening / security milestone

## Scope Estimate

**Small** — A few hours. Express-rate-limit with in-process memory to start (no Redis). Conservative limits: 10 req/min per IP for analytics/session, 20 req/min per IP for chat/message.

## Breadcrumbs

- `server/routes.ts` — public endpoints: `POST /api/analytics/session`, `POST /api/analytics/events`, `POST /api/chat/message`
- `server/index.ts` — middleware setup, where the rate limiter would be applied
- Suggested package: `express-rate-limit` (no extra dependency to start)

## Notes

For a second stage, use Redis as the rate limiter backing store (`rate-limit-redis`) to survive process restarts. For chat, also consider rate limiting by conversationId beyond IP — bots can rotate IPs but reuse conversation IDs.
