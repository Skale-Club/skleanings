---
id: SEED-008
status: cancelled
cancelled_on: 2026-05-10
cancellation_reason: console.log works; revisit when a serious prod bug appears
planted: 2026-05-10
planted_during: v1.0 / Phase 15 (schema-foundation-detokenization)
trigger_when: when the first serious production bug is hard to diagnose via logs, or when scaling to multiple tenants
scope: Medium
---

# SEED-008: Structured logging and observability (replace console.log)

## Why This Matters

The entire system uses `console.log` and `console.error` with no structure, no request context, no correlation IDs. When a booking fails silently (GHL sync timeout, malformed Stripe webhook, attribution miss), the only signal is a line of text in the log with no context of which booking, which tenant, which user.

In a white-label system with multiple tenants, this becomes critical — there's no way to filter logs by company, by booking ID, or by user session.

**Why:** Production bugs involving timing (time slot lock race conditions, GHL retry) are impossible to diagnose without structured timestamps and correlation IDs. console.log has no fields, no consistent levels, no filters.

## When to Surface

**Trigger:** when adding the second tenant in white-label, or when a production bug takes >2h to diagnose, or when starting a scalability milestone.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Multi-tenancy milestone (second tenant active)
- Scalability / ops milestone
- Post-launch when debugging becomes critical

## Scope Estimate

**Medium** — One phase. Library choice (pino — zero deps, JSON structured, very fast), instrumentation of critical points (booking creation, GHL sync, Stripe webhook, availability check), correlation ID middleware.

## Breadcrumbs

- `server/index.ts` — middleware setup, where global logger would be initialized
- `server/routes.ts` — multiple `console.log`/`console.error` without context
- `server/integrations/ghl.ts` — retry logic with `console.error` on failures
- Recommended library: `pino` (native Node.js, JSON output, zero overhead in production)

## Notes

Pino + `pino-pretty` for development (readable) + plain JSON in production (ingestible by any aggregator: Datadog, Better Stack, Axiom). Correlation ID generated from booking ID when available, auth session ID when not. Don't use OpenTelemetry to start — unnecessary overhead for current volume.
