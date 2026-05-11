---
id: SEED-019
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when the first tenant complains that booking confirmation emails don't have their brand identity
scope: Medium
---

# SEED-019: Branded email templates per tenant (booking confirmation, reminder, cancellation)

## Why This Matters

Today the system sends booking confirmations via SMS (Twilio) but does NOT have a branded email template system. There is no transactional email implementation — customers do not receive booking confirmation emails. For a white-label product, the "Your cleaning is confirmed!" email needs to come from `no-reply@cleanco.com` with the tenant's logo and colors.

**Why:** Transactional branded email is the most frequent touchpoint with the end customer — it's where white-label shows up or disappears. Today no email is sent at all, which is unacceptable for a production booking platform.

## When to Surface

**Trigger:** when the first tenant requires branded emails, or when implementing transactional email (which still doesn't exist — only SMS via Twilio).

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Notifications / customer communication milestone
- Advanced white-label milestone
- When implementing transactional email for the first time

## Scope Estimate

**Medium** — One phase. Components: (1) provider choice (Resend, Postmark, or SendGrid — Resend recommended for DX); (2) React Email templates for confirmation, 24h-prior reminder, cancellation, reschedule; (3) admin UI to configure from address and customize messages; (4) delivery webhook to `notificationLogs`.

## Breadcrumbs

- `shared/schema.ts` — `notificationLogs` table already exists (SMS/Telegram) — email would be a new `channel`
- `server/services/notifications.ts` — existing notification service — email would be added here
- `shared/schema.ts` — `companySettings.companyEmail`, `logoMain`, `companyName` — used in templates
- Recommended library: `resend` + `@react-email/components` (React Email for type-safe templates)
- New table: `emailSettings` (similar to `twilioSettings`) with API key, from address, enabled

## Notes

React Email allows writing templates in JSX with shadcn/ui-style components — highly consistent with the current stack. The from address requires a verified domain in the provider — the tenant must add DNS records. Document the verification process in the onboarding wizard (SEED-018).

For Xkedule multi-tenant: each tenant connects their own email-sending domain via Resend or similar. Xkedule provides a fallback `no-reply@xkedule.com` for tenants who haven't set up their own domain yet (with banner "Configure your own sending domain for full white-label").
