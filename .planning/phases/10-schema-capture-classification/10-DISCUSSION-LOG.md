# Phase 10: Schema, Capture & Classification — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 10-schema-capture-classification
**Areas discussed:** Session longevity, Last-touch update rule, Dev environment (all auto-recommended)

---

## Session Longevity

| Option | Description | Selected |
|--------|-------------|----------|
| No server-side expiration | localStorage UUID persists until user clears browser data. Simplest; no TTL complexity. | ✓ |
| 2-year inactivity reset | Matches GA4 convention. Requires server-side age check on every session upsert. | |
| 6-month reset | Shorter attribution window, resets returning customers more aggressively. | |

**User's choice:** Recommended default — no server-side expiration.
**Notes:** Auto-selected. Rationale: local cleaning business has multi-month booking cycles; expiration would incorrectly re-attribute returning customers.

---

## Last-Touch Update Rule

| Option | Description | Selected |
|--------|-------------|----------|
| UTMs OR identifiable referrer | Only updates when a meaningful source is detected. Direct returns leave last-touch intact. | ✓ |
| UTMs only | Most conservative — only paid/tagged traffic updates last-touch. Misses organic re-engagement. | |
| Any page load | Most permissive — direct returns overwrite last-touch with "Direct". Dilutes paid attribution. | |

**User's choice:** Recommended default — UTMs OR identifiable referrer only.
**Notes:** Auto-selected. Rationale: prevents a customer bookmarking the site after clicking a Google Ad from diluting the paid attribution on a direct return visit.

---

## Dev Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Skip in DEV | Match existing analytics.ts pattern — `if (import.meta.env.DEV) return`. Clean dev DB. | ✓ |
| Capture in DEV | Useful for testing full attribution pipeline without deploying. Adds dev data to reports. | |
| Capture with test flag | Mark dev sessions with `is_test = true`. More complex schema, rarely needed. | |

**User's choice:** Recommended default — skip in DEV.
**Notes:** Auto-selected. Rationale: matches established analytics.ts convention; prevents false data in reports.

---

## Claude's Discretion

- Traffic classifier domain coverage: start with most common sources (Google/Bing/Yahoo/DuckDuckGo organic; Facebook/Instagram/YouTube/TikTok/LinkedIn/Twitter-X/Pinterest social). Expandable without schema changes.
- Rate limiting: adapt existing `server/lib/rate-limit.ts` at 60 req/IP/min for analytics endpoint.
- Session endpoint response: `{ sessionId: string, isNew: boolean }`.

## Deferred Ideas

None.
