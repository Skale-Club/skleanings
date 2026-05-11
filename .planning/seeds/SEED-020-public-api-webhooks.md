---
id: SEED-020
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: Cut — wait until the first tenant requests a specific integration
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when a tenant needs to connect the system to an external tool other than GHL/Stripe
scope: Large
---

# SEED-020: Public API + webhooks for third-party integrations

## Why This Matters

Today the system has hardcoded integrations (GHL, Stripe, Google Calendar, Twilio, Telegram). Each new tenant that uses Salesforce, HubSpot, Zapier, or Make.com would need a custom integration. A public API with API key authentication + a webhook system would allow tenants (and integrators) to connect the system to any external tool with no additional code.

**Why:** Most cleaning companies already use some CRM or automation tool. Without a public API, the system is an island — every new integration requires development. With API + webhooks, the tenant integrates on their own.

## When to Surface

**Trigger:** when the first tenant requests integration with a tool that isn't GHL, or when reaching 5+ tenants (because statistically one of them will ask for HubSpot or Zapier).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Platform / ecosystem milestone
- When having 5+ tenants with different integration needs
- Enterprise white-label milestone

## Scope Estimate

**Large** — A milestone. Components: (1) API keys per tenant (`apiKeys` table with hash, permissions, rate limits); (2) documented public endpoints (`GET /v1/bookings`, `GET /v1/services`, `POST /v1/bookings`); (3) webhook system (`webhookEndpoints` table, events: `booking.created`, `booking.confirmed`, `booking.cancelled`); (4) webhooks panel in admin (register URL, see delivery logs, replay); (5) public API documentation (Swagger/Redoc).

## Breadcrumbs

- `server/routes.ts` — existing endpoints that would be exposed in the public API (adapted with API key auth)
- `shared/schema.ts` — new tables: `apiKeys`, `webhookEndpoints`, `webhookDeliveries`
- `server/middleware/auth.ts` — new auth strategy: Bearer API key in addition to session cookie
- Existing retry pattern: `server/integrations/ghl.ts` — reusable retry logic for webhook delivery
- Docs tools: `@scalar/express-api-reference` or Swagger UI (zero overhead, integrates with Express)

## Notes

Webhooks are harder than they seem — they need: guaranteed delivery (retry with backoff), idempotency keys, HMAC signature for authenticity verification, queryable delivery logs in admin. Start with synchronous webhooks (fire-and-forget) and evolve to an async queue if reliability becomes critical.
