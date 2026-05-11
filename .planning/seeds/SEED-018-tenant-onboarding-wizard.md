---
id: SEED-018
status: dormant
planted: 2026-05-10
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
trigger_when: when launching self-serve sale of the product (no manual onboarding)
scope: Large
---

# SEED-018: Self-serve onboarding wizard for new tenants

## Why This Matters

Today onboarding a new tenant is completely manual: configure database, deploy, set environment variables, populate companySettings in the database. To scale, a new client must be able to sign up, configure the basics, and have the system working without technical intervention.

The `skaleclub-websites` already has a 7-step resumable wizard in production. Pattern to replicate:
- Step 1: Basic info (name, email, phone, address, business type)
- Step 2: Brand colors (primary, secondary, accent)
- Step 3: Company info (logo, about image, hours)
- Step 4: Services (add categories/services from template or scratch)
- Step 5: Legal (privacy policy, terms of service)
- Step 6: Domain (staging URL or custom domain)
- Step 7: Review & complete

`tenants.wizardStep` tracks current progress (1-7) — user can leave and resume from where they left off.

**Why:** The cost of manual onboarding is the main bottleneck to scaling the product. With self-serve, a new client can be operational in 15 minutes.

## When to Surface

**Trigger:** when starting an active acquisition campaign for new tenants, or when having SEED-013 (multi-tenant) and SEED-014 (billing) implemented — the wizard is the UX layer on top of the infra.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Growth / acquisition milestone
- Post-SEED-013 + SEED-014 (infra and billing ready)
- Complete product milestone (sales-ready)

## Scope Estimate

**Large** — A milestone. Copy the skaleclub-websites wizard pattern (7 steps), adapted for scheduling/booking domain (Xkedule is a scheduling product, not a CMS):

- Wizard for booking-focused setup: service catalog import or scratch, staff initial setup, availability config, Google Calendar OAuth optional, GoHighLevel connection optional
- Billing step (Stripe checkout for subscription via SEED-014)
- Domain step (staging URL first, custom domain optional later — SEED-016)

## Breadcrumbs

- Reference: `skaleclub-websites` 7-step wizard implementation
- `client/src/pages/ClientLogin.tsx` — existing auth pattern — wizard is a new public route
- `server/routes/auth.ts` — existing signup — needs a tenant-create endpoint
- `shared/schema.ts` — companySettings — wizard populates this table
- `client/src/components/admin/CompanySettingsSection.tsx` — existing fields reused in wizard
- UX reference: Cal.com onboarding, Calendly setup flow

## Notes

The wizard must be stateless between steps (data saved to DB at each step, not just at the end) — if user closes at step 3, resumes from there. Offer "import service template" for cleaning companies — pre-configured categories and services to speed up setup.

For Xkedule, the wizard should include a "vertical template" selection at step 1 — cleaning company, salon, mechanic, consultant — each loads different service catalog templates and intake forms (SEED-027).
