import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import type { HomepageContent } from "@shared/schema";

interface ReviewsSectionProps {
  content?: HomepageContent['reviewsSection'];
}

export function ReviewsSection({ content }: ReviewsSectionProps) {
  const sectionContent = {
    ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
    ...(content || {}),
  };

  return (
    <section className="pt-20 pb-0 bg-white overflow-hidden mb-0">
      <div className="w-full">
        <div className="container-custom mx-auto mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            {sectionContent.title}
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            {sectionContent.subtitle}
          </p>
        </div>
        <div className="w-full px-0">
          <div className="pb-8 md:pb-0 bg-white">
            <iframe
              className="lc_reviews_widget"
              src={sectionContent.embedUrl}
              frameBorder="0"
              scrolling="no"
              style={{ minWidth: '100%', width: '100%', height: '520px', border: 'none', display: 'block' }}
              onLoad={() => {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = 'https://reputationhub.site/reputation/assets/review-widget.js';
                document.body.appendChild(script);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
