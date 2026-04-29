import type { CompanySettings } from "./schema";

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base;
  const result: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (isPlainObject(v) && isPlainObject(result[k])) {
      result[k] = deepMerge(result[k] as Record<string, unknown>, v);
    } else {
      // scalar / array / null in override REPLACES base (admin opt-in)
      result[k] = v;
    }
  }
  return result as T;
}

export function buildLocalBusinessSchema(
  settings: CompanySettings | null,
  canonicalUrl: string,
): Record<string, unknown> {
  const fallbackName =
    settings?.companyName || settings?.ogSiteName || settings?.industry || "Local Business";
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: fallbackName,
    description: settings?.seoDescription || "",
    "@id": canonicalUrl,
    url: canonicalUrl,
  };
  if (settings?.companyPhone)   base.telephone = settings.companyPhone;
  if (settings?.companyEmail)   base.email     = settings.companyEmail;
  if (settings?.companyAddress) base.address   = { "@type": "PostalAddress", streetAddress: settings.companyAddress };
  if (settings?.ogImage)        base.image     = settings.ogImage;
  return deepMerge(base, settings?.schemaLocalBusiness);
}
