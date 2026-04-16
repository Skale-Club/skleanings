import { Users, Award, Heart, Star } from "lucide-react";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import type { HomepageContent } from "@shared/schema";

const ICONS = [Users, Award, Heart, Star];

export default function Team() {
  const { settings } = useCompanySettings();
  const hc = settings?.homepageContent as HomepageContent | undefined;
  const team = { ...DEFAULT_HOMEPAGE_CONTENT.teamSection, ...(hc?.teamSection || {}) };
  const features: { title: string; desc: string }[] = team.features ?? DEFAULT_HOMEPAGE_CONTENT.teamSection!.features!;
  const stats: { value: string; label: string }[] = team.stats ?? DEFAULT_HOMEPAGE_CONTENT.teamSection!.stats!;

  return (
    <div className="pt-24 pb-20">
      <section className="container-custom mx-auto mb-20">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{team.heading}</h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8">{team.intro}</p>
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

      <section className="bg-slate-900 text-white py-20">
        <div className="container-custom mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">{team.whyChooseTitle}</h2>
          <p className="text-lg text-slate-300 mb-8 leading-relaxed">{team.whyChooseText}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {stats.map((s, i) => (
              <div key={i} className="p-6">
                <div className="text-4xl font-bold text-yellow-400 mb-2">{s.value}</div>
                <div className="text-slate-300">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
