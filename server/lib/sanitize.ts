import type { HomepageContent } from "@shared/schema";

export function sanitizeHomepageContent(raw: unknown): HomepageContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const content = raw as Record<string, unknown>;

  const sanitizeObject = (value: unknown): Record<string, unknown> | undefined => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return undefined;
  };

  return {
    heroBadgeImageUrl: typeof content.heroBadgeImageUrl === "string" ? content.heroBadgeImageUrl : undefined,
    heroBadgeAlt: typeof content.heroBadgeAlt === "string" ? content.heroBadgeAlt : undefined,
    trustBadges: Array.isArray(content.trustBadges) ? content.trustBadges : [],
    categoriesSection: sanitizeObject(content.categoriesSection) as HomepageContent["categoriesSection"],
    reviewsSection: sanitizeObject(content.reviewsSection) as HomepageContent["reviewsSection"],
    blogSection: sanitizeObject(content.blogSection) as HomepageContent["blogSection"],
    areasServedSection: sanitizeObject(content.areasServedSection) as HomepageContent["areasServedSection"],
  };
}
