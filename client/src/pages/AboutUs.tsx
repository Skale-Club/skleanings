import { Building2, CheckCircle, Users, Award } from "lucide-react";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import type { HomepageContent } from "@shared/schema";
import { PageHero, FeaturesGrid } from "@/components/shared";

const ICONS = [Building2, CheckCircle, Users, Award];

export default function AboutUs() {
  const { settings } = useCompanySettings();
  const hc = settings?.homepageContent as HomepageContent | undefined;
  const about = { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(hc?.aboutSection || {}) };
  const features = about.features ?? DEFAULT_HOMEPAGE_CONTENT.aboutSection!.features!;

  return (
    <div className="pt-24 pb-0">
      <section className="container-custom mx-auto mb-20">
        <PageHero heading={about.heading} intro={about.intro} />
        <FeaturesGrid features={features} icons={ICONS} />
      </section>

      <section className="bg-slate-950 text-white py-20">
        <div className="container-custom mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">{about.missionTitle}</h2>
            <p className="text-lg text-white mb-8 leading-relaxed">{about.missionText}</p>
          </div>
          <div className="rounded-3xl overflow-hidden aspect-video bg-slate-800 flex items-center justify-center">
            <Building2 className="w-20 h-20 text-slate-700" />
          </div>
        </div>
      </section>
    </div>
  );
}
