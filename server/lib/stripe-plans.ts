/**
 * Phase 59 — Plan Tier helpers
 *
 * Single source of truth for the 3-tier Stripe Price ID mapping.
 * - Forward lookup: getPriceIdForTier(tier) → Stripe Price ID (or null if env var unset)
 * - Reverse lookup: getTierForPriceId(priceId) → PlanTier (or null if unrecognized)
 *
 * Env vars (.env / .env.example):
 *   STRIPE_SAAS_PRICE_ID_BASIC
 *   STRIPE_SAAS_PRICE_ID_PRO
 *   STRIPE_SAAS_PRICE_ID_ENTERPRISE
 *
 * The legacy STRIPE_SAAS_PRICE_ID from Phase 48 remains in the codebase
 * (used by the existing POST /tenants/:id/subscribe endpoint) — it is NOT
 * consumed by these helpers. Phase 59-03 may opt to also treat it as the
 * Basic fallback; do that there, not here.
 */

export type PlanTier = "basic" | "pro" | "enterprise";

export const PLAN_TIERS: readonly PlanTier[] = ["basic", "pro", "enterprise"] as const;

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && (PLAN_TIERS as readonly string[]).includes(value);
}

/**
 * Forward lookup: tier → configured Stripe Price ID.
 * Returns null if the env var is unset (callers should 500 in that case).
 */
export function getPriceIdForTier(tier: PlanTier): string | null {
  const map: Record<PlanTier, string | undefined> = {
    basic: process.env.STRIPE_SAAS_PRICE_ID_BASIC,
    pro: process.env.STRIPE_SAAS_PRICE_ID_PRO,
    enterprise: process.env.STRIPE_SAAS_PRICE_ID_ENTERPRISE,
  };
  return map[tier] ?? null;
}

/**
 * Reverse lookup: Stripe Price ID → tier. Used by the webhook to map
 * sub.items.data[0].price.id back to a planTier. Returns null when the
 * incoming priceId does not match any of the 3 configured env vars.
 */
export function getTierForPriceId(priceId: string): PlanTier | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_SAAS_PRICE_ID_BASIC) return "basic";
  if (priceId === process.env.STRIPE_SAAS_PRICE_ID_PRO) return "pro";
  if (priceId === process.env.STRIPE_SAAS_PRICE_ID_ENTERPRISE) return "enterprise";
  return null;
}
