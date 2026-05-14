# Requirements — v14.0 Billing Hardening

**Milestone:** v14.0 Billing Hardening
**Goal:** The billing lifecycle is fully automated — tenants receive email warnings before their trial ends and when their subscription lapses, can view invoice history, and the signup endpoint is protected against abuse.
**Status:** Active

---

## Milestone Requirements

### Billing Email Notifications (Phase 53)

- [x] **BH-01**: When the Stripe webhook delivers a `customer.subscription.trial_will_end` event, send a Resend email to the tenant admin warning that their trial ends in 3 days and prompting them to add a payment method — email includes the Stripe Billing Portal URL
- [x] **BH-02**: When the Stripe webhook delivers a `customer.subscription.updated` event and the new status is `past_due`, send a Resend email to the tenant admin notifying them their payment failed and their service will be suspended — email includes the Stripe Billing Portal URL
- [x] **BH-03**: Both billing emails use the existing `sendResendEmail()` module and follow the established branded HTML template pattern (brand colors, company name from companySettings, Resend FROM address from emailSettings)

### Signup Rate Limiting (Phase 53)

- [ ] **BH-04**: `POST /api/auth/signup` is protected by `express-rate-limit` — max 5 requests per IP per hour; exceeding the limit returns 429 with a `Retry-After` header and JSON body `{ message: 'Too many signup attempts. Try again later.' }`

### Invoice History UI (Phase 54)

- [ ] **BH-05**: `/admin/billing` shows an "Invoice History" section listing the last 10 invoices fetched from `stripe.invoices.list({ customer: stripeCustomerId, limit: 10 })` — each row shows date, amount, status (paid/open/void), and a "Download" link to the Stripe-hosted invoice PDF
- [ ] **BH-06**: The invoice list is fetched server-side via `GET /api/billing/invoices` (guarded by `requireAdmin`) and returns an array of `{ id, date, amount, currency, status, invoiceUrl }` objects — the frontend renders it with React Query

---

## Future Requirements

- Dunning sequence (email on day 1, day 3, day 7 of past_due)
- Automatic tenant suspension after 7 days past_due (beyond the existing 3-day grace)
- Invoice PDF download via server-side proxy (avoid exposing Stripe URLs)
- Custom trial length per tenant (super-admin configurable)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-plan billing | v15.0 after billing basics validated |
| Automated suspension after 7 days | Complexity — manual super-admin action sufficient for MVP |
| Dunning sequence (multiple emails) | Single notification sufficient for MVP |
| Custom trial length | Super-admin can manually extend via Stripe dashboard |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BH-01 | Phase 53 | Complete |
| BH-02 | Phase 53 | Complete |
| BH-03 | Phase 53 | Complete |
| BH-04 | Phase 53 | Pending |
| BH-05 | Phase 54 | Pending |
| BH-06 | Phase 54 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14*
