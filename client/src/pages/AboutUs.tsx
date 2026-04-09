import { Building2, CheckCircle, Users, Award } from "lucide-react";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import type { HomepageContent } from "@shared/schema";

const ICONS = [Building2, CheckCircle, Users, Award];

export default function AboutUs() {
  const { settings } = useCompanySettings();
  const hc = settings?.homepageContent as HomepageContent | undefined;
  const about = { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(hc?.aboutSection || {}) };
  const features: { title: string; desc: string }[] = about.features ?? DEFAULT_HOMEPAGE_CONTENT.aboutSection!.features!;

  return (
    <div className="pt-24 pb-0">
      <section className="container-custom mx-auto mb-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{about.heading}</h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8">{about.intro}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          {features.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <Icon className="w-10 h-10 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </div>
            );
          })}
        </div>
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
