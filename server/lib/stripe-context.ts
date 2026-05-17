import Stripe from "stripe";
import type { IStorage } from "../storage";

/**
 * Phase 65 — Connect-aware Stripe context resolver.
 *
 * The customer-payment checkout endpoint and the webhook handler both
 * need to decide: do we use this tenant's Connect account (platform key
 * + Stripe-Account header) or fall back to the legacy per-tenant API
 * key from integrationSettings.stripe.apiKey?
 *
 * Discriminated union so callers can handle the connect-incomplete
 * state (Connect row exists but chargesEnabled=false) with a clear
 * 402 message (PF-03) WITHOUT ever constructing a Stripe client.
 */

export interface StripeContext {
  stripe: Stripe;
  /** When defined, pass to Stripe SDK as { stripeAccount } request option. */
  stripeAccount?: string;
  useConnect: boolean;
  /** Whole-number percent (e.g. 5 means 5%). 0 for legacy path. */
  applicationFeePercent: number;
}

export type StripeContextResult =
  | { kind: "connect"; ctx: StripeContext }
  | { kind: "legacy"; ctx: StripeContext }
  | { kind: "connect-incomplete" }   // tenant_stripe_accounts row exists but chargesEnabled=false
  | { kind: "none" };                // no Stripe configured at all

const STRIPE_API_VERSION = "2026-03-25.dahlia" as const;

export async function getStripeContextForTenant(
  tenantId: number,
  storage: IStorage,
): Promise<StripeContextResult> {
  // 1. Connect path — takes precedence over legacy when present.
  const connectRow = await storage.getTenantStripeAccount(tenantId);
  if (connectRow) {
    if (!connectRow.chargesEnabled) {
      return { kind: "connect-incomplete" };
    }
    const platformKey = process.env.STRIPE_SECRET_KEY;
    if (!platformKey) {
      // Misconfiguration — platform key absent but Connect row exists.
      // Treat as none so caller surfaces 501/402 (rather than crashing on new Stripe()).
      return { kind: "none" };
    }
    const percent = parseInt(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "5", 10);
    return {
      kind: "connect",
      ctx: {
        stripe: new Stripe(platformKey, { apiVersion: STRIPE_API_VERSION }),
        stripeAccount: connectRow.stripeAccountId,
        useConnect: true,
        applicationFeePercent: Number.isFinite(percent) && percent >= 0 ? percent : 5,
      },
    };
  }

  // 2. Legacy fallback — per-tenant API key in integrationSettings.stripe (PF-04 backward compat).
  const legacyCreds = await storage.getIntegrationSettings("stripe");
  if (legacyCreds?.apiKey && legacyCreds?.isEnabled) {
    return {
      kind: "legacy",
      ctx: {
        stripe: new Stripe(legacyCreds.apiKey, { apiVersion: STRIPE_API_VERSION }),
        useConnect: false,
        applicationFeePercent: 0,
      },
    };
  }

  // 3. No Stripe configured.
  return { kind: "none" };
}

/**
 * PF-02 — application_fee_amount math. Integer cents, floor, minimum 1 cent.
 * Stripe rejects application_fee_amount = 0 on Connect charges.
 */
export function calculateApplicationFee(totalCents: number, percent: number): number {
  if (percent <= 0) return 0;
  const fee = Math.floor((totalCents * percent) / 100);
  return Math.max(1, fee);
}
