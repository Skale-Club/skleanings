# Requirements — v13.0 Self-Serve Signup

**Milestone:** v13.0 Self-Serve Signup
**Goal:** Any business can sign up independently via a public page — no super-admin action required to onboard a new tenant, with a 14-day free trial auto-started on signup.
**Status:** Active

---

## Milestone Requirements

### Public Signup Flow (Phase 51)

- [ ] **SS-01**: A business owner visits `/signup` and submits company name, subdomain slug, email, and password — the system atomically creates: tenant, domain (slug.xkedule.com), admin user, company settings, Stripe customer, and a 14-day trial subscription in a single `db.transaction`
- [ ] **SS-02**: The signup endpoint validates subdomain slug uniqueness — if the slug is already taken, the response returns a 409 with a field-level error message ("Subdomain already taken")
- [ ] **SS-03**: After successful signup, the API returns the tenant subdomain — the frontend redirects the browser to `https://[slug].xkedule.com/admin`
- [ ] **SS-04**: The `/signup` page is publicly accessible (no auth required) and redirects already-authenticated admins to `/admin`

### Trial Subscription Lifecycle (Phase 51)

- [ ] **SS-05**: A Stripe trial subscription (`trial_period_days: 14`) is created automatically during signup — `tenant_subscriptions` row has `status: 'trialing'` and `currentPeriodEnd` set to trial end date
- [ ] **SS-06**: Stripe webhook handler processes `customer.subscription.trial_will_end` and `customer.subscription.updated` events — updates `tenant_subscriptions.status` from `trialing` → `active` or `past_due` depending on whether a payment method was added

### Trial Status UI (Phase 52)

- [ ] **SS-07**: `/admin/billing` shows a "Trial" badge and a "X days remaining" countdown when `status = 'trialing'` — the countdown is derived from `currentPeriodEnd`
- [ ] **SS-08**: `/admin/billing` shows an "Add Payment Method" CTA button when status is `trialing` or `past_due` — clicking opens the Stripe Billing Portal (same `POST /api/billing/portal` endpoint already exists)

### Signup Page UI (Phase 52)

- [ ] **SS-09**: The `/signup` page renders a clean public form with fields: Company Name, Subdomain (with live `.xkedule.com` suffix preview), Email, Password, Confirm Password — all using existing shadcn/ui Input components and brand styling
- [ ] **SS-10**: On submit, the form shows inline validation errors (required fields, password mismatch, subdomain format) before hitting the API — on API error (409 slug conflict), the subdomain field shows the error message inline without full page reload

---

## Future Requirements

- Email verification for new signups (magic link or 6-digit code)
- Multiple pricing plans (basic/pro/enterprise) selectable at signup
- Trial extension by super-admin
- Dunning emails via Resend when subscription is past_due
- Invoice history in /admin/billing
- Custom domain support at signup (bring your own domain)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Email verification | Adds friction to MVP signup; can add in v14.0 |
| Multi-plan selection | Single plan sufficient for MVP; pricing page is a separate concern |
| Dunning emails | Not blocking for trial flow; v14.0 billing hardening |
| Hetzner live deployment | Requires VM provisioning — separate ops milestone |
| Custom domain at signup | Slug subdomains sufficient for onboarding; custom domains later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SS-01 | Phase 51 | Pending |
| SS-02 | Phase 51 | Pending |
| SS-03 | Phase 51 | Pending |
| SS-04 | Phase 51 | Pending |
| SS-05 | Phase 51 | Pending |
| SS-06 | Phase 51 | Pending |
| SS-07 | Phase 52 | Pending |
| SS-08 | Phase 52 | Pending |
| SS-09 | Phase 52 | Pending |
| SS-10 | Phase 52 | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14*
