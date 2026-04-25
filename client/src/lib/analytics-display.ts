/**
 * analytics-display.ts
 * Display name utilities for the marketing dashboard.
 * Maps raw traffic_source labels and utm_source values to business-friendly names.
 * Used by MarketingSourcesTab, MarketingCampaignsTab, MarketingOverviewTab.
 */

// Traffic source channel labels (from traffic-classifier.ts output stored in last_traffic_source):
export const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  organic_search: 'Organic Search',
  social:         'Social',
  paid:           'Paid Search',
  referral:       'Referral',
  direct:         'Direct',
  email:          'Email',
  unknown:        'Unknown',
};

// UTM source overrides (raw utm_source values → display labels):
export const UTM_SOURCE_LABELS: Record<string, string> = {
  google:    'Google Ads',
  facebook:  'Facebook',
  instagram: 'Instagram',
  youtube:   'YouTube',
  tiktok:    'TikTok',
  linkedin:  'LinkedIn',
};

/**
 * Maps a traffic_source (classified channel label) to a business-friendly display name.
 * Falls back to the raw value if not in the map. Returns 'Unknown' for null/empty.
 */
export function getSourceDisplayName(trafficSource: string | null | undefined): string {
  if (!trafficSource) return 'Unknown';
  return TRAFFIC_SOURCE_LABELS[trafficSource] ?? trafficSource;
}

/**
 * Conversion rate formatter. Returns '—' when visitors is 0 (prevents NaN/Infinity).
 * Formula: (bookings / visitors * 100).toFixed(1) + '%'
 */
export function formatConversionRate(bookings: number, visitors: number): string {
  if (visitors === 0) return '—';
  return (bookings / visitors * 100).toFixed(1) + '%';
}

/**
 * Revenue formatter. Always shows "$0.00" not blank when value is zero or null.
 */
export function formatRevenue(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return `$${(isNaN(num) ? 0 : num).toFixed(2)}`;
}
