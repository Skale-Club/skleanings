---
phase: 65-connect-aware-checkout-webhook-routing
verified: 2026-05-14T00:00:00Z
status: human_needed
score: 18/18 must-haves verified (6/6 requirements satisfied; 2 items need runtime validation)
human_verification:
  - test: "Apply migration to live database and verify columns exist"
    expected: "supabase db push (or equivalent) succeeds; bookings.platform_fee_amount + bookings.tenant_net_amount exist as nullable INTEGER"
    why_human: "Migration file exists on disk but STATE.md flags `supabase db push` as a deferred human action — cannot be programmatically verified without DB credentials"
  - test: "End-to-end Connect checkout + webhook with real Stripe test mode"
    expected: "Tenant with chargesEnabled=true Connect row → checkout session created with stripeAccount header + application_fee_amount; checkout.session.completed webhook arrives, signature verifies via STRIPE_WEBHOOK_SECRET_CONNECT, bookings row gets platformFeeAmount + tenantNetAmount populated"
    why_human: "Requires running server, Stripe test mode account, Connect onboarded test tenant, and configured Connect-level webhook endpoint in Stripe Dashboard — pure runtime/external-service verification"
---

# Phase 65: Connect-Aware Checkout & Webhook Routing Verification Report

**Phase Goal:** Route customer booking payments through tenant Connect accounts with platform fee; legacy flow preserved; webhook routes Connect events and persists fee breakdown.

**Verified:** 2026-05-14
**Status:** human_needed (all automated checks pass; two items require runtime/DB verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | bookings table has platform_fee_amount and tenant_net_amount INTEGER columns (nullable) | ✓ VERIFIED | Migration file lines 7-9; `shared/schema.ts:402-403` |
| 2  | getStripeContextForTenant returns discriminated union describing Stripe routing | ✓ VERIFIED | `server/lib/stripe-context.ts:26-30, 34-77` |
| 3  | Connect tenant w/ chargesEnabled=true → kind='connect' with platform client + stripeAccount | ✓ VERIFIED | `stripe-context.ts:40-60` |
| 4  | Connect row + chargesEnabled=false → kind='connect-incomplete' (no Stripe client) | ✓ VERIFIED | `stripe-context.ts:41-43` |
| 5  | No Connect row + legacy creds → kind='legacy' with per-tenant Stripe client | ✓ VERIFIED | `stripe-context.ts:62-73` |
| 6  | Neither path available → kind='none' | ✓ VERIFIED | `stripe-context.ts:75-76` |
| 7  | calculateApplicationFee returns integer cents w/ floor, min 1 cent | ✓ VERIFIED | `stripe-context.ts:83-87` |
| 8  | .env.example documents STRIPE_PLATFORM_FEE_PERCENT + STRIPE_WEBHOOK_SECRET_CONNECT | ✓ VERIFIED | `.env.example:85-94` |
| 9  | POST /checkout calls getStripeContextForTenant(tenant.id, storage) | ✓ VERIFIED | `payments.ts:30` |
| 10 | kind='connect' → session created with platform client + { stripeAccount } request options | ✓ VERIFIED | `stripe.ts:122-124`; ctx passed through `payments.ts:131` |
| 11 | kind='connect' → session includes payment_intent_data.application_fee_amount from STRIPE_PLATFORM_FEE_PERCENT | ✓ VERIFIED | `stripe.ts:114-119`; `payments.ts:117-121, 132` |
| 12 | kind='connect-incomplete' → 402 with exact PF-03 message, no Stripe call | ✓ VERIFIED | `payments.ts:36-41` (exact verbatim string + en-arrow) |
| 13 | kind='legacy' → endpoint behaves as before (no fee, no stripeAccount header) | ✓ VERIFIED | `payments.ts:118-121` (fee=0 for legacy); `stripe.ts:115, 122-124` (skips when no stripeAccount) |
| 14 | kind='none' → 501 'Stripe not connected' (existing message preserved) | ✓ VERIFIED | `payments.ts:31-35` |
| 15 | Webhook: event.account set → signature verified via STRIPE_WEBHOOK_SECRET_CONNECT (two-pass) | ✓ VERIFIED | `stripe.ts:144-153` |
| 16 | Webhook: no event.account → legacy per-tenant secret (integrationSettings.stripe.calendarId) | ✓ VERIFIED | `stripe.ts:155-161` |
| 17 | Connect checkout.session.completed → retrieveCheckoutSessionForAccount + expand payment_intent | ✓ VERIFIED | `stripe.ts:170-182`; `payments.ts:186-196` |
| 18 | platformFeeAmount + tenantNetAmount persisted via setBookingPaymentBreakdown | ✓ VERIFIED | `storage.ts:218, 1068-1077`; `payments.ts:196` |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/migrations/20260524000000_phase65_booking_payment_breakdown.sql` | DDL adding platform_fee_amount + tenant_net_amount | ✓ VERIFIED | Both ADD COLUMN IF NOT EXISTS statements present; INTEGER type; nullable |
| `shared/schema.ts` | Drizzle columns for platformFeeAmount + tenantNetAmount | ✓ VERIFIED | Lines 402-403; camelCase TS / snake_case DB; correctly placed between stripePaymentStatus and contactId |
| `server/lib/stripe-context.ts` | getStripeContextForTenant + calculateApplicationFee + discriminated union | ✓ VERIFIED | 87 lines (min 60); exports `getStripeContextForTenant`, `calculateApplicationFee`, `StripeContextResult`, `StripeContext` |
| `.env.example` | Documents STRIPE_PLATFORM_FEE_PERCENT + STRIPE_WEBHOOK_SECRET_CONNECT | ✓ VERIFIED | Phase 65 section appended lines 85-94 |
| `server/lib/stripe.ts` | createCheckoutSession extended + verifyWebhookEvent dual-secret + retrieveCheckoutSessionForAccount | ✓ VERIFIED | All three updates present (lines 77-125, 135-162, 170-182); `import type { StripeContext }` at line 3 |
| `server/routes/payments.ts` | POST /checkout four-state switch + webhook dual-secret + Connect retrieve | ✓ VERIFIED | Imports lines 7-16; four-state switch lines 30-41; webhook Connect path lines 186-201 |
| `server/storage.ts` | setBookingPaymentBreakdown interface + impl | ✓ VERIFIED | IStorage line 218; DatabaseStorage lines 1068-1077; tenant-scoped WHERE clause |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `stripe-context.ts` | `storage.getTenantStripeAccount` | IStorage method call | ✓ WIRED | Line 39: `await storage.getTenantStripeAccount(tenantId)` |
| `stripe-context.ts` | `storage.getIntegrationSettings` | legacy fallback | ✓ WIRED | Line 63: `await storage.getIntegrationSettings("stripe")` |
| `shared/schema.ts` bookings | migration column names | matching snake_case + INTEGER | ✓ WIRED | `platform_fee_amount integer` + `tenant_net_amount integer` match both files |
| `POST /checkout` | `getStripeContextForTenant` | discriminated union switch | ✓ WIRED | Line 30 call; lines 31-43 cover all four kinds |
| `POST /checkout` connect branch | `stripe.checkout.sessions.create(..., { stripeAccount })` | Stripe-Account header | ✓ WIRED | Context passed at `payments.ts:131`; stripeAccount option used at `stripe.ts:123` |
| connect line items total | `calculateApplicationFee` | floor math on totalCents | ✓ WIRED | `payments.ts:117-120` |
| `POST /webhook` | `verifyWebhookEvent` | dual-secret path | ✓ WIRED | `payments.ts:157`; `stripe.ts:144-161` two-pass logic |
| `POST /webhook` Connect branch | `retrieveCheckoutSessionForAccount` | account-scoped retrieve + expand | ✓ WIRED | `payments.ts:188`; expand `payment_intent` at `stripe.ts:179` |
| `POST /webhook` | `storage.setBookingPaymentBreakdown` | persist fee + net | ✓ WIRED | `payments.ts:196` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| POST /checkout response | `session.url, booking.id` | Real Stripe API call via `createCheckoutSession`; booking from `storage.createBooking` | Yes (when Stripe configured) | ✓ FLOWING |
| POST /webhook fee breakdown | `platformFeeAmount, tenantNetAmount` | `paymentIntent.application_fee_amount` + `session.amount_total` from `retrieveCheckoutSessionForAccount` | Yes — live Stripe retrieve with expanded payment_intent | ✓ FLOWING |
| getStripeContextForTenant result | `result.kind, ctx` | Live DB lookups (`getTenantStripeAccount`, `getIntegrationSettings`) + env-derived percent | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript compiles cleanly with all Phase 65 code | `npm run check` | exit 0, no errors | ✓ PASS |
| stripe-context.ts exports all four declared symbols | grep exports | `getStripeContextForTenant`, `calculateApplicationFee`, `StripeContext`, `StripeContextResult` all present | ✓ PASS |
| PF-03 message is byte-exact (incl. U+2192 arrow) | `grep -c "Finish onboarding in Admin → Payments" server/routes/payments.ts` | 1 | ✓ PASS |
| Connect webhook path attempts STRIPE_WEBHOOK_SECRET_CONNECT before legacy | Read `stripe.ts:144-153` | Connect tried first, catches mismatch, falls through to legacy | ✓ PASS |
| application_fee_amount only attached when stripeAccount AND fee > 0 | Read `stripe.ts:115` | Guarded by `if (stripeAccount && params.applicationFeeAmount && params.applicationFeeAmount > 0)` | ✓ PASS |
| End-to-end Connect checkout via running server + Stripe test mode | Would require running Stripe API call | Not runnable in verification context | ? SKIP (routed to human verification) |
| Migration applied to live DB | `supabase db push` (deferred human action per STATE.md) | Not applied programmatically | ? SKIP (routed to human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PF-01 | 65-02 | Connect tenant routes checkout via platform key + Stripe-Account header | ✓ SATISFIED | `payments.ts:30-43` resolves context; `stripe.ts:122-124` passes `{ stripeAccount }` request option |
| PF-02 | 65-02 | application_fee_amount = floor(total * percent / 100), min 1 cent | ✓ SATISFIED | `stripe-context.ts:83-87` (math); `payments.ts:117-121` (call site); `stripe.ts:114-119` (attaches to payment_intent_data) |
| PF-03 | 65-02 | 402 with byte-exact "Stripe Connect onboarding incomplete. Finish onboarding in Admin → Payments." when chargesEnabled=false | ✓ SATISFIED | `payments.ts:36-41` — verbatim string including U+2192 arrow; no Stripe API call attempted before return |
| PF-04 | 65-01, 65-02 | Legacy per-tenant apiKey flow preserved when no Connect row | ✓ SATISFIED | `stripe-context.ts:62-73` legacy branch; `payments.ts:118-121` fee=0 for legacy; `stripe.ts:115, 122-124` skips fee + stripeAccount option when undefined |
| PF-05 | 65-01, 65-03 | bookings.platform_fee_amount + tenant_net_amount columns; populated on webhook | ✓ SATISFIED | Migration + Drizzle columns present; `payments.ts:186-201` persists from expanded session via `setBookingPaymentBreakdown` |
| PF-06 | 65-03 | Webhook verifies Connect events via STRIPE_WEBHOOK_SECRET_CONNECT; account-scoped retrieve | ✓ SATISFIED | `stripe.ts:144-161` two-pass dual-secret; `stripe.ts:170-182` + `payments.ts:188` Connect retrieve with expand |

No orphaned requirements detected — REQUIREMENTS.md maps PF-01..PF-06 to Phase 65, all six are claimed across the three plan frontmatter `requirements:` fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | No TODO/FIXME/placeholder/stub/hardcoded-empty patterns detected in any modified file |

### Human Verification Required

#### 1. Apply migration to live database

**Test:** Run `supabase db push` (or equivalent Supabase CLI command per MEMORY.md: always use Supabase CLI, never drizzle-kit push) to apply `supabase/migrations/20260524000000_phase65_booking_payment_breakdown.sql` to the live PostgreSQL database.
**Expected:** Migration succeeds; `\d bookings` (or equivalent) shows `platform_fee_amount` and `tenant_net_amount` as nullable INTEGER columns. Without this, `setBookingPaymentBreakdown` will fail at runtime with "column does not exist."
**Why human:** Migration file exists on disk but STATE.md flags `supabase db push` as a deferred human action — verifier cannot execute DB DDL.

#### 2. End-to-end Connect checkout + webhook flow

**Test:** With Stripe test mode + a tenant that has `tenant_stripe_accounts.chargesEnabled = true` + `STRIPE_PLATFORM_FEE_PERCENT=5` + `STRIPE_WEBHOOK_SECRET_CONNECT=<from Connect webhook>` configured:
1. POST a booking to `/api/payments/checkout` and confirm response contains a `sessionUrl` pointing to a Checkout session created on the connected account (Stripe Dashboard will show it under that connected account, not the platform account).
2. Complete the test payment; verify `application_fee_amount` is set on the resulting PaymentIntent (should equal floor(total_cents * 5 / 100), min 1).
3. Confirm `checkout.session.completed` webhook fires and is signed with the Connect secret; signature verification passes.
4. Confirm the bookings row gets `platform_fee_amount` and `tenant_net_amount` populated within seconds.
5. Repeat with a tenant that has no Connect row but legacy `integrationSettings.stripe.apiKey` — confirm the checkout session is created on the per-tenant account (no `application_fee_amount`), and `platform_fee_amount` + `tenant_net_amount` remain NULL after the webhook.
6. Repeat with a tenant whose Connect row has `chargesEnabled = false` — confirm POST /checkout returns 402 with the exact PF-03 message and no Stripe API call is made.

**Expected:** All three paths (connect-success, legacy, connect-incomplete) behave per requirements; fee breakdown persisted only for Connect-routed bookings.
**Why human:** Requires running server, Stripe test mode account, Connect onboarded test tenant, and Connect-level webhook endpoint configured in Stripe Dashboard → Connect → Webhooks — none of these can be exercised programmatically without external API calls + secrets.

### Gaps Summary

No code gaps detected. All 18 must-have truths verify, all artifacts pass Levels 1-4 (exist, substantive, wired, data flows), and all 9 key links wire through to real implementations. `npm run check` exits 0. PF-03 message is byte-exact including the U+2192 arrow. The two-pass webhook signature verification correctly tries `STRIPE_WEBHOOK_SECRET_CONNECT` first and falls back to the legacy per-tenant secret without ever parsing unverified payload. The Connect-aware webhook handler reads `event.account` post-verification (never trusts pre-verification bytes) and isolates fee-persistence errors so transient Stripe API failures cannot block conversion event recording or booking status updates.

The two outstanding items — applying the Supabase migration to live DB and running an end-to-end Stripe test-mode flow — are both deferred human actions explicitly documented in `65-01-SUMMARY.md` and `65-03-SUMMARY.md` under "User Setup Required." They are not code gaps; they are runtime/deployment activities that cannot be validated from within the verifier context.

### Commit Verification

All 13 phase commits exist in git history:
- 257336d feat(65-01): add booking payment breakdown migration
- 6011532 feat(65-01): add platformFeeAmount + tenantNetAmount to bookings schema
- e8be701 feat(65-01): add stripe-context helper with discriminated union
- 9978c18 docs(65-01): document Phase 65 Stripe Connect env vars
- c7a854a docs(65-01): complete Connect routing foundation plan
- df64513 feat(65-02): extend createCheckoutSession with optional Connect context
- 98ef546 feat(65-02): rewire POST /checkout to use Connect-aware Stripe context
- 1aff078 docs(65-02): complete Connect-aware checkout endpoint plan
- b573cd8 feat(65-03): add setBookingPaymentBreakdown to IStorage
- 381e832 feat(65-03): extend verifyWebhookEvent for dual-secret + add Connect retrieve helper
- 47df733 feat(65-03): make webhook handler Connect-aware with fee breakdown persistence
- a998fc9 docs(65-03): complete Connect-aware webhook plan
- 1fdba58 merge(65-03): webhook routing + fee breakdown

---

_Verified: 2026-05-14_
_Verifier: Claude (gsd-verifier)_
