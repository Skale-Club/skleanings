---
id: SEED-014
status: shipped
planted: 2026-05-10
last_revised: 2026-05-14
planted_during: v3.0 / Phase 20 (calendar-timeline-structure-audit)
shipped_in: v12.0 SaaS Billing (Phases 48–50) + v14.0 Billing Hardening (Phases 53–54)
shipped_at: 2026-05-14
trigger_when: when launching the Xkedule SaaS model with multiple paying tenants
scope: Large
---

# SEED-014: Xkedule → Tenant billing (plans configurable in super-admin)

## Why This Matters

Xkedule must charge its tenants (the businesses using the platform) a monthly subscription. This is separate from tenant→customer billing (SEED-032) — here it's Xkedule collecting from each client company.

**Fundamental principle:** Plans cannot be hardcoded. Everything (plan name, price, included features, limits) must be CRUD'able in the super-admin. When Xkedule decides to launch a "Pro Plus" plan tomorrow, it's a UI operation in super-admin — not a deploy.

**Why:** Hardcoded plans freeze the product. Every price change, new tier, or feature adjustment per plan becomes a deploy. With plans as data in the database, the product/sales team adjusts without depending on engineering.

## When to Surface

**Trigger:** when signing the second paying tenant, or when defining plan tiers, or together with SEED-013 (multi-tenancy) — billing is part of the same SaaS milestone.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:
- Xkedule SaaS / monetization milestone
- Together with SEED-013 (multi-tenant) and SEED-015 (super-admin)
- Together with SEED-017 (feature flags) — plans + features are CRUD'd together

## Scope Estimate

**Large** — A complete phase. Components:

1. **Schema:**
   - `plans` (id, slug, name, description, monthlyPrice, yearlyPrice, stripeProductId, stripePriceIdMonthly, stripePriceIdYearly, isPublic, isActive, order) — CRUD in super-admin
   - `planFeatures` (planId, featureKey, enabled, limit) — which features each plan unlocks + limits (see SEED-017)
   - `tenantSubscriptions` (tenantId, planId, stripeCustomerId, stripeSubscriptionId, status, currentPeriodEnd, trialEndsAt, cancelAtPeriodEnd)

2. **Backend:**
   - Webhook handler for Stripe events (`invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`)
   - `requireActiveSubscription` middleware that blocks access if subscription is cancelled/past_due
   - Service that syncs plan creation in DB → Product+Price creation in Stripe via API

3. **Super-admin UI:**
   - Plan CRUD (name, price, features, limits)
   - Active/cancelled/in-trial subscriptions list
   - Force cancellation, apply credit, change a tenant's plan

4. **Tenant admin:**
   - "Billing & Plan" page — see current plan, upgrade/downgrade, see invoices, update payment method
   - "Trial expires in N days" / "Payment failed — update your card" banner

## Breadcrumbs

- `server/routes/payments.ts` — existing Stripe checkout pattern — extensible to subscriptions
- `shared/schema.ts` — new `plans`, `planFeatures`, `tenantSubscriptions` tables — ALL without `tenantId` (they're Xkedule global), except `tenantSubscriptions` which has `tenantId`
- Stripe SDK: `stripe.products.create`, `stripe.prices.create`, `stripe.subscriptions.create`, `stripe.checkout.sessions.create(mode: 'subscription')`
- Critical events: `customer.subscription.updated`, `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.trial_will_end`
- Stripe account used: **Xkedule account** (not the tenant's) — completely separate from SEED-032 (tenants' Stripe Connect)

## Notes

**Free trial** of 14 days is configurable per plan (`trialDays` in `plans`). Can be zero (no trial) or customized per plan.

**Stripe sync:** When creating/editing a plan in super-admin, sync with Stripe Products & Prices via API. If price changes, DO NOT update the existing Price (Stripe doesn't allow it) — create a new Price and mark the old as inactive, keeping existing tenants on the old price (grandfathering).

**Delinquency:** After 3 payment failures, mark subscription as `past_due`, then `unpaid`. Apply configurable policy: block full access, read-only mode, or just warning banner.

**Anti-pattern to avoid:** Hardcoded `const PLANS = { basic: {...}, pro: {...} }` in code. Everything via database + super-admin UI.
