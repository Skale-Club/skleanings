/**
 * Server-authoritative traffic classification (CAPTURE-04).
 *
 * Inputs are assumed already lowercased and trimmed (the server-side
 * normalize() in upsertVisitorSession is the safety net; the client also
 * normalizes per D-04). Empty strings are treated as null by the caller.
 *
 * Priority order (highest first):
 *   1. utm_medium === 'email' / 'e-mail'              → email
 *   2. utm_medium ∈ paid set                          → paid
 *   3. utm_source matches a known search engine       → organic_search
 *   4. utm_source matches a known social network      → social
 *   5. utm_source present but unknown                 → referral
 *   6. (no UTMs) referrer is a known search engine    → organic_search
 *   7. (no UTMs) referrer is a known social network   → social
 *   8. (no UTMs) referrer present, external           → referral
 *   9. (no UTMs) no referrer                          → direct
 *  10. fallback                                       → unknown
 */

export type TrafficSource =
  | "organic_search"
  | "social"
  | "paid"
  | "email"
  | "referral"
  | "direct"
  | "unknown";

// Substrings that identify a search-engine hostname or utm_source token.
// Substring match handles google.com, www.google.com, google.co.uk, etc.
const SEARCH_ENGINES = [
  "google", "bing", "yahoo", "duckduckgo", "baidu", "yandex", "ecosia",
];

// Substrings that identify a social-network hostname or utm_source token.
const SOCIAL_NETWORKS = [
  "facebook", "instagram", "youtube", "tiktok", "linkedin",
  "twitter", "x.com", "pinterest", "reddit", "snapchat",
];

// utm_medium values that signal a paid placement (CPC, paid social, display, etc.)
const PAID_MEDIUMS = new Set([
  "cpc", "ppc", "paid", "paidsearch", "paid_search",
  "display", "paid_social", "paidsocial", "social_paid",
]);

function hostnameMatches(referrer: string, patterns: string[]): boolean {
  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    return patterns.some((p) => hostname === p || hostname.endsWith(`.${p}`) || hostname.includes(p));
  } catch {
    return false;
  }
}

function tokenMatches(value: string, patterns: string[]): boolean {
  return patterns.some((p) => value.includes(p));
}

/**
 * Classify a visit into a TrafficSource label.
 * All inputs must be lowercased + trimmed (or null) per D-04.
 */
export function classifyTraffic(
  utmSource: string | null,
  utmMedium: string | null,
  referrer: string | null,
): TrafficSource {
  // 1. UTM medium overrides (highest priority — CAPTURE-04 explicit examples)
  if (utmMedium) {
    if (utmMedium === "email" || utmMedium === "e-mail") return "email";
    if (PAID_MEDIUMS.has(utmMedium)) return "paid";
  }

  // 2. UTM source classification
  if (utmSource) {
    if (tokenMatches(utmSource, SEARCH_ENGINES)) return "organic_search";
    if (tokenMatches(utmSource, SOCIAL_NETWORKS)) return "social";
    // Has UTM source but unrecognized → treat as referral
    return "referral";
  }

  // 3. No UTMs — fall back to referrer
  if (!referrer) return "direct";
  if (hostnameMatches(referrer, SEARCH_ENGINES)) return "organic_search";
  if (hostnameMatches(referrer, SOCIAL_NETWORKS)) return "social";

  // 4. External referrer that isn't a known search/social domain
  return "referral";
}
