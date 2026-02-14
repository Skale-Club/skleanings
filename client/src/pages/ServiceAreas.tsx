import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceAreaGroup, ServiceAreaCity } from "@shared/schema";
import { Spinner } from "@/components/ui/spinner";

export default function ServiceAreas() {
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
          <h1 className="text-4xl md:text-6xl font-bold mb-6">Areas We Serve</h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            Skleanings proudly serves communities throughout Massachusetts. We bring our professional cleaning services to your doorstep with reliable, upfront pricing and easy online booking.
          </p>
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
                    <MapPin className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold">{group.name}</h2>
                  </div>
                  {group.description && (
                    <p className="text-sm text-slate-600 mb-4">{group.description}</p>
                  )}
                  <ul className="grid grid-cols-2 gap-2">
                    {cities.map((city) => (
                      <li key={city.id} className="text-slate-600 flex items-start">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2 mt-2 flex-shrink-0" />
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

        <div className="mt-12 p-6 bg-blue-50 border border-blue-100 rounded-2xl">
          <h3 className="text-xl font-bold mb-2">Don't see your area?</h3>
          <p className="text-slate-600 mb-4">
            We're constantly expanding our service coverage. Contact us to check if we can serve your location.
          </p>
          <a
            href="/contact"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-blue-700 transition-colors"
          >
            Contact Us
          </a>
        </div>
      </section>
    </div>
  );
}
