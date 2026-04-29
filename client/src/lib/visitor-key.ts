import type { CompanySettings } from "@shared/schema";

/**
 * Derive a tenant-stable slug from CompanySettings for localStorage key namespacing.
 * Phase 15 contract — companySettings has NO `slug` column (verified). We derive from companyName.
 * If companyName is empty, fall back to a deterministic `tenant-${id}` form so the key is always tenant-specific.
 */
export function deriveCompanySlug(settings: CompanySettings | null): string {
  if (!settings) return '';
  const name = (settings.companyName ?? '').trim();
  if (name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  return `tenant-${settings.id}`;
}

/**
 * Build the localStorage visitor key from a slug. Replaces the legacy hardcoded tenant key.
 * Empty slug fallback: `visitor_visitor_id` — keeps the key well-formed even before settings load.
 */
export function getVisitorIdKey(slug: string): string {
  return `${slug || 'visitor'}_visitor_id`;
}
