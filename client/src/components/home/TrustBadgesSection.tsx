import { Star, Shield, Clock, Sparkles, Heart, BadgeCheck, ThumbsUp, Trophy } from "lucide-react";

const badgeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  shield: Shield,
  clock: Clock,
  sparkles: Sparkles,
  heart: Heart,
  badgeCheck: BadgeCheck,
  thumbsUp: ThumbsUp,
  trophy: Trophy,
};

interface TrustBadge {
  title: string;
  description: string;
  icon?: string;
}

interface TrustBadgesSectionProps {
  badges: TrustBadge[];
}

export function TrustBadgesSection({ badges }: TrustBadgesSectionProps) {
  if (!badges.length) return null;

  return (
    <section className="relative z-20 -mt-10">
      <div className="absolute inset-x-0 bottom-0 top-1/2 bg-[#F8FAFC] -z-10 pt-[0px] pb-[0px] mt-[-25px] mb-[-25px]"></div>
      <div className="container-custom mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-hidden">
          {badges.map((badge, i) => {
            const iconKey = (badge.icon || '').toLowerCase();
            const Icon = badgeIconMap[iconKey] || Star;
            return (
              <div key={i} className="p-8 flex items-center gap-6 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1D1D1D]">{badge.title}</h3>
                  <p className="text-sm text-slate-500">{badge.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
