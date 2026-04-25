interface PageHeroProps {
  heading?: string;
  intro?: string;
  align?: 'left' | 'center';
}

export function PageHero({ heading, intro, align = 'left' }: PageHeroProps) {
  if (align === 'center') {
    return (
      <div className="text-center mb-12">
        {heading && <h1 className="text-3xl md:text-5xl font-bold mb-4">{heading}</h1>}
        {intro && <p className="text-slate-600 max-w-2xl mx-auto text-lg">{intro}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mb-8">
      {heading && <h1 className="text-4xl md:text-6xl font-bold mb-6">{heading}</h1>}
      {intro && <p className="text-xl text-slate-600 leading-relaxed">{intro}</p>}
    </div>
  );
}
