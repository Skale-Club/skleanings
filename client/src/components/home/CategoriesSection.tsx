import { useEffect, useRef, useState } from "react";
import { ServiceCard } from "@/components/ui/ServiceCard";
import { trackCTAClick } from "@/lib/analytics";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";
import type { HomepageContent } from "@shared/schema";

interface Category {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface Service {
  id: number;
  categoryId: number;
  [key: string]: unknown;
}

interface CategoriesSectionProps {
  categories?: Category[];
  services?: Service[];
  isLoading: boolean;
  content?: HomepageContent['categoriesSection'];
  onCategoryClick: (categoryId: number) => void;
}

export function CategoriesSection({
  categories,
  services,
  isLoading,
  content,
  onCategoryClick,
}: CategoriesSectionProps) {
  const sectionContent = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(content || {}),
  };

  const activeCategories = categories?.filter(category =>
    services?.some(service => service.categoryId === category.id)
  );

  const serviceCarouselItems = (services || []).slice(0, 15);
  const mobileServiceItems = (services || []).slice(0, 4);
  const serviceCarouselLoop = [...serviceCarouselItems, ...serviceCarouselItems];

  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const maxScrollRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isHoveringRef = useRef(false);
  const hasCapturedRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startScrollRef = useRef(0);
  const didDragRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => { prefersReducedMotionRef.current = mediaQuery.matches; };
    updateMotion();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateMotion);
      return () => mediaQuery.removeEventListener("change", updateMotion);
    }
    mediaQuery.addListener(updateMotion);
    return () => mediaQuery.removeListener(updateMotion);
  }, []);

  useEffect(() => {
    const scroller = marqueeRef.current;
    if (!scroller) return;

    const updateMaxScroll = () => {
      const maxScroll = scroller.scrollWidth / 2;
      maxScrollRef.current = maxScroll;
      if (maxScroll > 0 && scroller.scrollLeft >= maxScroll) {
        scroller.scrollLeft = scroller.scrollLeft % maxScroll;
      }
    };

    updateMaxScroll();
    const resizeObserver = new ResizeObserver(() => { updateMaxScroll(); });
    resizeObserver.observe(scroller);
    window.addEventListener("resize", updateMaxScroll);

    const durationMs = 120000;
    let lastTime = performance.now();

    const step = (time: number) => {
      const el = marqueeRef.current;
      if (!el) return;
      const delta = time - lastTime;
      lastTime = time;
      if (!prefersReducedMotionRef.current && !isDraggingRef.current && !isHoveringRef.current && maxScrollRef.current > 0) {
        const distance = (maxScrollRef.current / durationMs) * delta;
        el.scrollLeft += distance;
        if (el.scrollLeft >= maxScrollRef.current) {
          el.scrollLeft -= maxScrollRef.current;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateMaxScroll);
    };
  }, [serviceCarouselItems.length]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const el = marqueeRef.current;
    if (!el) return;
    activePointerIdRef.current = event.pointerId;
    didDragRef.current = false;
    isDraggingRef.current = false;
    hasCapturedRef.current = false;
    setIsDragging(false);
    startXRef.current = event.clientX;
    startScrollRef.current = el.scrollLeft;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    const el = marqueeRef.current;
    if (!el) return;
    const delta = event.clientX - startXRef.current;
    if (!isDraggingRef.current && Math.abs(delta) > 6) {
      isDraggingRef.current = true;
      didDragRef.current = true;
      setIsDragging(true);
      if (!hasCapturedRef.current) {
        el.setPointerCapture?.(event.pointerId);
        hasCapturedRef.current = true;
      }
    }
    if (!isDraggingRef.current) return;
    const maxScroll = maxScrollRef.current;
    let nextScroll = startScrollRef.current - delta;
    if (maxScroll > 0) {
      while (nextScroll < 0) nextScroll += maxScroll;
      while (nextScroll >= maxScroll) nextScroll -= maxScroll;
    }
    el.scrollLeft = nextScroll;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    const el = marqueeRef.current;
    activePointerIdRef.current = null;
    if (hasCapturedRef.current) {
      el?.releasePointerCapture?.(event.pointerId);
      hasCapturedRef.current = false;
    }
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      requestAnimationFrame(() => { didDragRef.current = false; });
      return;
    }
    didDragRef.current = false;
  };

  return (
    <section className="py-20 bg-[#F8FAFC]">
      <div className="container-custom mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            {sectionContent.title}
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            {sectionContent.subtitle}
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${
            activeCategories?.length === 1
              ? 'lg:grid-cols-1 max-w-md mx-auto'
              : activeCategories?.length === 2
              ? 'lg:grid-cols-2 max-w-4xl mx-auto'
              : 'lg:grid-cols-3'
          } gap-8`}>
            {activeCategories?.map((category) => (
              <div
                key={category.id}
                className="group cursor-pointer relative overflow-hidden rounded-2xl h-80 shadow-md hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-slate-100 to-slate-200"
                onClick={() => onCategoryClick(category.id)}
              >
                {category.imageUrl ? (
                  <>
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5"></div>
                )}
                <div className="absolute bottom-0 left-0 p-8 w-full">
                  <h3 className="text-2xl font-bold text-white mb-2 group-hover:translate-x-2 transition-transform">
                    {category.name}
                  </h3>
                  <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                    {category.description}
                  </p>
                  <button
                    className="w-full py-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold rounded-lg opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all"
                    onClick={() => trackCTAClick('category_card', category.name)}
                  >
                    {sectionContent.ctaText}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="container-custom mx-auto mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : serviceCarouselItems.length > 0 ? (
        <div className="mt-12">
          <div className="container-custom mx-auto sm:hidden">
            <div className="grid grid-cols-1 gap-4 items-start">
              {mobileServiceItems.map((service) => (
                <ServiceCard key={service.id} service={service as any} />
              ))}
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="relative overflow-x-hidden overflow-y-visible w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#F8FAFC] to-transparent z-10"></div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#F8FAFC] to-transparent z-10"></div>
              <div
                ref={marqueeRef}
                className={`w-full overflow-x-auto overflow-y-visible px-4 sm:px-6 lg:px-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden select-none touch-pan-y ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
                data-testid="services-carousel"
                onMouseEnter={() => { isHoveringRef.current = true; }}
                onMouseLeave={() => { isHoveringRef.current = false; }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClickCapture={(event) => {
                  if (didDragRef.current) {
                    if (event.cancelable) event.preventDefault();
                    event.stopPropagation();
                  }
                }}
              >
                <div className="flex w-max gap-4 items-start">
                  {serviceCarouselLoop.map((service, index) => {
                    const isDuplicate = index >= serviceCarouselItems.length;
                    return (
                      <div
                        key={`${service.id}-${index}`}
                        className="shrink-0 w-[clamp(220px,22vw,280px)]"
                        aria-hidden={isDuplicate}
                      >
                        <ServiceCard service={service as any} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
