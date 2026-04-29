import type { CompanySettings } from "@shared/schema";
import { buildLocalBusinessSchema } from "@shared/seo";
import { storage } from "../storage";
import { getFallbackCompanySettings } from "./public-data-fallback";

// ---------- escape helpers ----------

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeAttr(value: string): string {
  if (!value) return "";
  return value.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// JSON-LD lives inside <script>, not an attribute. Only </script and U+2028/U+2029 matter.
// The two unicode regexes below use String.fromCharCode to avoid embedding literal
// U+2028/U+2029 line-separator code points in the source file — they match the actual code points at runtime.
export function escapeJsonLd(value: string): string {
  return value
    .replace(/<\/script/gi, "<\\/script")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

// ---------- canonical URL ----------

export interface InjectorReq {
  protocol: string;
  host: string;
  originalUrl: string;
}

export function buildCanonicalUrl(
  settings: CompanySettings | null,
  req: InjectorReq,
): string {
  if (settings?.seoCanonicalUrl) {
    return settings.seoCanonicalUrl.replace(/\/$/, "") || settings.seoCanonicalUrl;
  }
  const host = req.host || "localhost:5000";
  const path = req.originalUrl || "/";
  const trimmed = `${req.protocol}://${host}${path}`.replace(/\/$/, "");
  return trimmed || `${req.protocol}://${host}/`;
}

// ---------- the injector (pure) ----------

const INDUSTRY_FALLBACK = "Cleaning Services";

export function injectSeoMeta(
  html: string,
  settings: CompanySettings | null,
  req: InjectorReq,
): string {
  const canonicalUrl = buildCanonicalUrl(settings, req);
  const industry = settings?.industry || INDUSTRY_FALLBACK;
  const companyName = settings?.companyName || industry;
  const title =
    settings?.seoTitle || `${companyName} | ${industry}`;
  const description =
    settings?.seoDescription ||
    `Professional ${industry.toLowerCase()} for your home or business.`;

  // ogImage absolute-URL handling (Pitfall 3): compute ONCE, pass to BOTH og:image block AND schema base.
  const ogImageAbsolute = settings?.ogImage
    ? (settings.ogImage.startsWith("http")
        ? settings.ogImage
        : `${req.protocol}://${req.host || "localhost"}${settings.ogImage}`)
    : "";

  // For schema, build a synthetic settings-with-absolute-image (do NOT mutate the input).
  const settingsForSchema: CompanySettings | null = settings
    ? { ...settings, ogImage: ogImageAbsolute || settings.ogImage }
    : null;
  const schema = buildLocalBusinessSchema(settingsForSchema, canonicalUrl);
  const jsonLd = JSON.stringify(schema);

  // ---------- D-07: conditional emit of og:image / twitter:image clusters ----------
  // If ogImage is empty, the entire <meta property="og:image"> + <meta property="og:image:alt">
  // cluster is OMITTED (token expands to empty string). Same for the twitter:image cluster.
  // RESEARCH.md Open Question 1's token-emit-or-omit proposal closes the D-07 gap.
  const ogImageAlt = `${companyName} logo`;
  const ogImageBlock = ogImageAbsolute
    ? `<meta property="og:image" content="${escapeAttr(ogImageAbsolute)}" />\n    <meta property="og:image:alt" content="${escapeAttr(ogImageAlt)}" />`
    : "";
  const twitterImageBlock = ogImageAbsolute
    ? `<meta name="twitter:image" content="${escapeAttr(ogImageAbsolute)}" />\n    <meta name="twitter:image:alt" content="${escapeAttr(ogImageAlt)}" />`
    : "";

  const tokens: Record<string, string> = {
    "{{SEO_TITLE}}":            escapeAttr(title),
    "{{SEO_DESCRIPTION}}":      escapeAttr(description),
    "{{CANONICAL_URL}}":        escapeAttr(canonicalUrl),
    "{{OG_IMAGE_BLOCK}}":       ogImageBlock,       // raw HTML (or "") — NOT attribute-escaped; built from already-escaped pieces
    "{{TWITTER_IMAGE_BLOCK}}":  twitterImageBlock,  // raw HTML (or "")
    "{{OG_TYPE}}":              escapeAttr(settings?.ogType || "website"),
    "{{OG_SITE_NAME}}":         escapeAttr(settings?.ogSiteName || companyName),
    "{{OG_LOCALE}}":            escapeAttr("en_US"),
    "{{TWITTER_CARD}}":         escapeAttr(settings?.twitterCard || "summary_large_image"),
    "{{TWITTER_SITE}}":         escapeAttr(settings?.twitterSite || ""),
    "{{TWITTER_CREATOR}}":      escapeAttr(settings?.twitterCreator || ""),
    "{{ROBOTS}}":               escapeAttr(settings?.seoRobotsTag || "index, follow"),
    // {{COMPANY_NAME_ALT}}: reserved for Phase 17 favicon alt-text — no emit site in client/index.html yet.
    "{{COMPANY_NAME_ALT}}":     escapeAttr(companyName),
    "{{JSON_LD}}":              escapeJsonLd(jsonLd),
  };

  let out = html;
  for (const [k, v] of Object.entries(tokens)) {
    // Use a replacer function so that $ in JSON-LD values (e.g. "$$$" priceRange) are never
    // interpreted as replacement-pattern specials ($$, $&, $`, $'). This is the correct form
    // for replacing tokens whose values may contain arbitrary user/admin content.
    out = out.replaceAll(k, () => v);
  }
  return out;
}

// ---------- TTL cache wrapper ----------

const TTL_MS = 45_000; // 45s, middle of D-03's 30-60s range
let cached: { data: CompanySettings | null; expiresAt: number } | null = null;

export function invalidateSeoCache(): void {
  cached = null;
}

export async function getCachedSettings(): Promise<CompanySettings | null> {
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  let data: CompanySettings | null = null;
  try {
    if (process.env.VERCEL) {
      data = await getFallbackCompanySettings();
    } else {
      data = await storage.getCompanySettings();
    }
  } catch (err) {
    console.error("[seo-injector] settings fetch failed; using null", err);
    data = null;
  }
  cached = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}
