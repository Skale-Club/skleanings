import { useEffect } from "react";
import { useLocation } from "wouter";
import { useCategories, useServices } from "@/hooks/use-booking";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import { CartSummary } from "@/components/CartSummary";
import { AreasServedMap } from "@/components/AreasServedMap";
import {
  HeroSection,
  TrustBadgesSection,
  CategoriesSection,
  ReviewsSection,
  BlogSection,
} from "@/components/home";

export default function Home() {
  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const { data: services, isLoading: isServicesLoading } = useServices();
  const [, setLocation] = useLocation();
  const { settings: companySettings } = useCompanySettings();

  const isLoading = isCategoriesLoading || isServicesLoading;

  const homepageContent = {
    ...DEFAULT_HOMEPAGE_CONTENT,
    ...(companySettings?.homepageContent || {}),
    trustBadges:
      Array.isArray(companySettings?.homepageContent?.trustBadges) &&
      companySettings.homepageContent.trustBadges.length > 0
        ? companySettings.homepageContent.trustBadges
        : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
    categoriesSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
      ...(companySettings?.homepageContent?.categoriesSection || {}),
    },
    reviewsSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
      ...(companySettings?.homepageContent?.reviewsSection || {}),
    },
    blogSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
      ...(companySettings?.homepageContent?.blogSection || {}),
    },
    areasServedSection: {
      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
      ...(companySettings?.homepageContent?.areasServedSection || {}),
    },
  };

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, []);

  return (
    <div className="pb-0">
      <HeroSection
        heroTitle={companySettings?.heroTitle ?? undefined}
        heroSubtitle={companySettings?.heroSubtitle ?? undefined}
        ctaText={companySettings?.ctaText ?? undefined}
        heroImageUrl={companySettings?.heroImageUrl ?? undefined}
        heroBadgeImageUrl={homepageContent.heroBadgeImageUrl}
        heroBadgeAlt={homepageContent.heroBadgeAlt}
        companyPhone={companySettings?.companyPhone ?? undefined}
      />
      <TrustBadgesSection badges={homepageContent.trustBadges ?? []} />
      <CategoriesSection
        categories={categories}
        services={services}
        isLoading={isLoading}
        content={homepageContent.categoriesSection}
        onCategoryClick={(id) => setLocation(`/services?category=${id}&scroll=true`)}
      />
      <ReviewsSection content={homepageContent.reviewsSection} />
      <BlogSection content={homepageContent.blogSection} />
      <section id="areas-served" className="bg-white py-20">
        <AreasServedMap
          mapEmbedUrl={companySettings?.mapEmbedUrl}
          content={homepageContent.areasServedSection}
        />
      </section>
      <CartSummary />
    </div>
  );
}
