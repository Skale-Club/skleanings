import { Link } from "wouter";
import { Phone } from "lucide-react";
import { trackCTAClick, trackCallClick } from "@/lib/analytics";

interface HeroSectionProps {
  heroTitle?: string;
  heroSubtitle?: string;
  ctaText?: string;
  heroImageUrl?: string;
  heroBadgeImageUrl?: string;
  heroBadgeAlt?: string;
  companyPhone?: string;
}

export function HeroSection({
  heroTitle,
  heroSubtitle,
  ctaText,
  heroImageUrl,
  heroBadgeImageUrl,
  heroBadgeAlt,
  companyPhone = '',
}: HeroSectionProps) {
  const telPhone = companyPhone.replace(/\D/g, '');

  return (
    <section className="relative flex items-center lg:items-center pt-6 lg:pt-4 pb-0 overflow-hidden bg-primary min-h-[65vh] sm:min-h-[50vh] lg:min-h-[500px] xl:min-h-[550px]">
      <div className="container-custom mx-auto relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-8 items-center lg:items-center lg:-translate-y-5">
          <div className="text-white pt-4 pb-2 lg:pt-12 lg:pb-12 relative z-20">
            {heroBadgeImageUrl && (
              <div className="mb-3 lg:mb-6">
                <img
                  src={heroBadgeImageUrl}
                  alt={heroBadgeAlt || 'Trusted Experts'}
                  className="h-5 sm:h-6 w-auto object-contain"
                />
              </div>
            )}
            {heroTitle && (
              <h1 className="text-[11vw] sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-bold mb-3 lg:mb-6 font-display leading-[1.05] sm:leading-[1.1]">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                  {heroTitle}
                </span>
              </h1>
            )}
            {heroSubtitle && (
              <p className="text-base sm:text-xl text-blue-50/80 mb-4 lg:mb-8 leading-relaxed max-w-xl">
                {heroSubtitle}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 flex-wrap">
              {ctaText && (
                <Link href="/services" className="w-full sm:w-auto shrink-0">
                  <button
                    className="w-full px-6 sm:px-8 py-3 sm:py-4 bg-secondary hover:bg-secondary/90 hover:scale-105 text-secondary-foreground font-bold rounded-full transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
                    onClick={() => trackCTAClick('hero', ctaText)}
                    data-testid="button-hero-cta"
                  >
                    {ctaText}
                  </button>
                </Link>
              )}
              {companyPhone && (
                <a
                  href={`tel:${telPhone}`}
                  className="w-full sm:w-auto shrink-0 px-6 sm:px-8 py-3 sm:py-4 bg-transparent text-white font-bold rounded-full border border-white/30 hover:bg-white/10 hover:scale-105 transition-all flex items-center justify-center gap-2 text-base sm:text-lg whitespace-nowrap"
                  onClick={() => trackCallClick('hero', companyPhone)}
                  data-testid="button-hero-phone"
                >
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                  {companyPhone}
                </a>
              )}
            </div>
          </div>
          <div className="relative flex h-full items-end lg:items-center justify-center lg:justify-end self-end lg:self-center w-full lg:min-h-[400px] z-10 lg:ml-[calc(-5%-32px)] -mt-2 sm:mt-0">
            {heroImageUrl && (
              <img
                src={heroImageUrl}
                alt="Cleaning Professionals"
                className="w-[100vw] sm:w-[105%] lg:w-[100%] max-w-[400px] sm:max-w-[360px] md:max-w-[420px] lg:max-w-[490px] xl:max-w-[560px] object-contain drop-shadow-2xl translate-y-[2%] sm:translate-y-[5%] lg:translate-y-0 scale-100 sm:scale-102 lg:scale-100 origin-bottom"
              />
            )}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-primary">
        <div className="absolute inset-0 opacity-60" style={{
          background: `
            radial-gradient(circle at 20% 30%, #4facfe 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, #a8d8ff 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, hsl(var(--primary)) 0%, transparent 50%),
            linear-gradient(135deg, hsl(var(--primary)) 0%, #74abe2 100%)
          `
        }}></div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/20 to-transparent"></div>
      </div>
    </section>
  );
}
