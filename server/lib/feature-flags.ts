/**
 * Phase 59 — Plan Tier Feature Catalog (PT-03)
 *
 * Pure data + helpers. No DB, no env, no Express coupling.
 *
 * Numeric limits: -1 = unlimited (route-level enforcement deferred to v18.0;
 * for now Phase 60 renders -1 as "Unlimited" on /admin/billing).
 *
 * Adding a new feature: extend the FeatureLimits interface AND every tier's
 * entry in FEATURE_CATALOG. TypeScript will refuse to compile if a tier is
 * missing the new key.
 */

import type { PlanTier } from "./stripe-plans";

export interface FeatureLimits {
  /** Max staff members. -1 = unlimited. */
  maxStaff: number;
  /** Max bookings per calendar month. -1 = unlimited. */
  maxBookingsPerMonth: number;
  /** Custom company branding (logo, colors) on the customer booking flow. */
  customBranding: boolean;
  /** Priority support response SLA. */
  prioritySupport: boolean;
}

export type FeatureName = keyof FeatureLimits;

/**
 * Source of truth for plan tier capabilities. Order matters only for
 * developer readability — UI ordering is Phase 60's concern.
 */
export const FEATURE_CATALOG: Record<PlanTier, FeatureLimits> = {
  basic: {
    maxStaff: 3,
    maxBookingsPerMonth: 100,
    customBranding: false,
    prioritySupport: false,
  },
  pro: {
    maxStaff: 10,
    maxBookingsPerMonth: 1000,
    customBranding: true,
    prioritySupport: false,
  },
  enterprise: {
    maxStaff: -1,
    maxBookingsPerMonth: -1,
    customBranding: true,
    prioritySupport: true,
  },
};

/**
 * Get the value for a single feature on a given tier. The return type
 * matches the key — number for limits, boolean for flags — so callers
 * don't need to cast or narrow at the call site.
 *
 * @example
 *   const max = tenantHasFeature("pro", "maxStaff"); // number (10)
 *   const ok  = tenantHasFeature("pro", "customBranding"); // boolean (true)
 */
export function tenantHasFeature<K extends FeatureName>(
  tier: PlanTier,
  feature: K,
): FeatureLimits[K] {
  return FEATURE_CATALOG[tier][feature];
}

/**
 * Get the full feature object for a tier. Phase 60's GET /api/billing/status
 * uses this to ship the entire catalog block down to the admin UI.
 */
export function getFeatureCatalog(tier: PlanTier): FeatureLimits {
  return FEATURE_CATALOG[tier];
}
