import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceAreaGroup, ServiceAreaCity } from "@shared/schema";
import { Spinner } from "@/components/ui/spinner";
import { useCompanySettings } from "@/context/CompanySettingsContext";
import { DEFAULT_HOMEPAGE_CONTENT } from "@/lib/homepageDefaults";

export default function ServiceAreas() {
  const { settings } = useCompanySettings();
  const hc = (settings as any)?.homepageContent;
  const areasPage = { ...DEFAULT_HOMEPAGE_CONTENT.serviceAreasPageSection, ...(hc?.serviceAreasPageSection || {}) };

  // Fetch active service area groups (regions)
  const { data: serviceAreaGroups, isLoading: groupsLoading } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups');
      if (!response.ok) throw new Error('Failed to fetch service area groups');
      return response.json();
    },
  });

  // Fetch active cities
  const { data: serviceAreaCities, isLoading: citiesLoading } = useQuery<ServiceAreaCity[]>({
    queryKey: ['/api/service-area-cities'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-cities');
      if (!response.ok) throw new Error('Failed to fetch service area cities');
      return response.json();
    },
  });

  const isLoading = groupsLoading || citiesLoading;

  // Group cities by their area group
  const groupedCities = serviceAreaGroups?.map(group => ({
    group,
    cities: serviceAreaCities?.filter(city => city.areaGroupId === group.id) || []
  }));

  if (isLoading) {
    return (
      <div className="pt-24 pb-20">
        <div className="container-custom mx-auto flex justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20">
      <section className="container-custom mx-auto mb-20">
        <div className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">{areasPage.heading}</h1>
          <p className="text-xl text-slate-600 leading-relaxed">{areasPage.intro}</p>
        </div>

        {!groupedCities || groupedCities.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>Service areas information coming soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {groupedCities.map(({ group, cities }) => (
              cities.length > 0 && (
                <div key={group.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-bold">{group.name}</h2>
                  </div>
                  {group.description && (
                    <p className="text-sm text-slate-600 mb-4">{group.description}</p>
                  )}
                  <ul className="grid grid-cols-2 gap-2">
                    {cities.map((city) => (
                      <li key={city.id} className="text-slate-600 flex items-start">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mr-2 mt-2 flex-shrink-0" />
                        <div>
                          <div>{city.name}</div>
                          {city.zipcode && (
                            <div className="text-xs text-slate-500 mt-0.5">Zipcode: {city.zipcode}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}
          </div>
        )}

        <div className="mt-12 p-6 bg-primary/5 border border-primary/10 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">{areasPage.notFoundTitle}</h3>
          <p className="text-slate-600 mb-4">{areasPage.notFoundText}</p>
          <a
            href="/contact"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
