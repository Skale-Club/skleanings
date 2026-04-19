import type { ComponentType } from "react";

interface Feature {
  title: string;
  desc: string;
}

interface FeaturesGridProps {
  features: Feature[];
  icons: ComponentType<{ className?: string }>[];
}

export function FeaturesGrid({ features, icons }: FeaturesGridProps) {
  if (!features.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
      {features.map((item, i) => {
        const Icon = icons[i % icons.length];
        return (
          <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
            {Icon && <Icon className="w-10 h-10 text-primary mb-4" />}
            <h3 className="text-xl font-bold mb-2">{item.title}</h3>
            <p className="text-slate-600">{item.desc}</p>
          </div>
        );
      })}
    </div>
  );
}
