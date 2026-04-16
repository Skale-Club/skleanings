import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { Category, Service, Subcategory } from '@shared/schema';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LayoutGrid,
  List,
  Loader2,
  Package,
  Plus,
} from 'lucide-react';
import { ServiceGridItem } from './services/ServiceGridItem';
import { ServiceListRow } from './services/ServiceListRow';
import { CategoryReorderRow } from './services/CategoryReorderRow';
import { ServiceForm } from './services/ServiceForm';
export function ServicesSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderedServices, setOrderedServices] = useState<Service[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const scrollPositionRef = useRef<number>(0);

  // Restore scroll position when dialog closes
  useEffect(() => {
    if (!isDialogOpen && scrollPositionRef.current > 0) {
      const container = document.getElementById('admin-top');
      if (container) {
        // Force restore scroll position multiple times to fight layout shifts
        const restore = () => {
          if (scrollPositionRef.current > 0 && Math.abs(container.scrollTop - scrollPositionRef.current) > 5) {
            container.scrollTop = scrollPositionRef.current;
          }
        };

        // Immediate attempt
        restore();

        // Aggressive staggered attempts to handle React Query invalidation and re-renders
        const timers = [
          setTimeout(restore, 10),
          setTimeout(restore, 50),
          setTimeout(restore, 100),
          setTimeout(restore, 200),
          setTimeout(restore, 300),
          setTimeout(restore, 500),
          setTimeout(restore, 800)
        ];

        return () => timers.forEach(clearTimeout);
      }
    }
  }, [isDialogOpen]);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  const { data: services, isLoading } = useQuery<Service[]>({
    queryKey: ['/api/services', { includeHidden: true }],
    queryFn: () => fetch('/api/services?includeHidden=true').then(r => r.json())
  });

  const { data: addonRelationships } = useQuery<{ id: number, serviceId: number, addonServiceId: number }[]>({
    queryKey: ['/api/service-addons'],
    queryFn: () => fetch('/api/service-addons').then(r => r.json())
  });

  const reorderSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createService = useMutation({
    mutationFn: async (data: Omit<Service, 'id'> & { addonIds?: number[], options?: any[], frequencies?: any[] }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const { addonIds, options, frequencies, ...serviceData } = data;
      const response = await authenticatedRequest('POST', '/api/services', token, serviceData);
      const newService = await response.json() as Service;
      if (newService?.id) {
        // Save addons
        if (addonIds && addonIds.length > 0) {
          await authenticatedRequest('PUT', `/api/services/${newService.id}/addons`, token, { addonIds });
        }
        // Save options for base_plus_addons
        if (options && options.length > 0) {
          await authenticatedRequest('PUT', `/api/services/${newService.id}/options`, token, { options });
        }
        // Save frequencies for base_plus_addons
        if (frequencies && frequencies.length > 0) {
          await authenticatedRequest('PUT', `/api/services/${newService.id}/frequencies`, token, { frequencies });
        }
      }
      return newService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service', description: error.message, variant: 'destructive' });
    }
  });

  const updateService = useMutation({
    mutationFn: async (data: Service & { addonIds?: number[], options?: any[], frequencies?: any[] }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const { addonIds, options, frequencies, ...serviceData } = data;
      const response = await authenticatedRequest('PUT', `/api/services/${data.id}`, token, serviceData);
      const updatedService = await response.json();
      // Update addons
      if (addonIds !== undefined) {
        await authenticatedRequest('PUT', `/api/services/${data.id}/addons`, token, { addonIds });
      }
      // Update options for base_plus_addons
      if (options !== undefined) {
        await authenticatedRequest('PUT', `/api/services/${data.id}/options`, token, { options });
      }
      // Update frequencies for base_plus_addons
      if (frequencies !== undefined) {
        await authenticatedRequest('PUT', `/api/services/${data.id}/frequencies`, token, { frequencies });
      }
      return updatedService;
    },
    onSuccess: async (updatedService) => {
      // Update local state immediately for instant UI feedback
      setOrderedServices(prev =>
        prev.map(s => s.id === updatedService.id ? updatedService : s)
      );
      // Also update the query cache directly
      queryClient.setQueryData(['/api/services', { includeHidden: true }], (old: Service[] | undefined) =>
        old?.map(s => s.id === updatedService.id ? updatedService : s) ?? []
      );
      // Refetch to ensure consistency
      await queryClient.refetchQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      await queryClient.refetchQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service updated successfully' });
      const savedScrollPosition = scrollPositionRef.current;
      setEditingService(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service', description: error.message, variant: 'destructive' });
    }
  });

  const deleteService = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('DELETE', `/api/services/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', { includeHidden: true }] });
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      queryClient.invalidateQueries({ queryKey: ['/api/service-addons'] });
      toast({ title: 'Service deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service', description: error.message, variant: 'destructive' });
    }
  });

  const toggleShowOnLanding = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('PUT', `/api/services/${id}/toggle-landing`, token);
      return res.json();
    },
    onSuccess: (updatedService) => {
      // Update local state immediately for instant UI feedback
      setOrderedServices(prev =>
        prev.map(s => s.id === updatedService.id ? updatedService : s)
      );
      // Also update the query cache directly
      queryClient.setQueryData(['/api/services', { includeHidden: true }], (old: Service[] | undefined) =>
        old?.map(s => s.id === updatedService.id ? updatedService : s) ?? []
      );
      const isVisible = updatedService.showOnLanding;
      toast({
        title: isVisible ? 'Service visible on landing page' : 'Service hidden from landing page',
        description: isVisible ? 'Customers will see this service on the homepage' : 'This service is now hidden from the homepage'
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to toggle visibility', description: error.message, variant: 'destructive' });
    }
  });

  const reorderServices = useMutation<Service[], Error, { id: number; order: number }[]>({
    mutationFn: async (orderData: { id: number; order: number }[]) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('PUT', '/api/services/reorder', token, { order: orderData });
      return res.json();
    },
    onError: (error: Error) => {
      // Refetch to restore correct order on error
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({ title: 'Failed to reorder services', description: error.message, variant: 'destructive' });
    },
    onSuccess: (data) => {
      const sorted = [...(data || [])].sort((a, b) => {
        const oa = a.order ?? 0;
        const ob = b.order ?? 0;
        return oa !== ob ? oa - ob : a.id - b.id;
      });
      // Update local state and cache directly without refetching
      setOrderedServices(sorted);
      queryClient.setQueryData(['/api/services', { includeHidden: true }], sorted);
      queryClient.setQueryData(['/api/services'], sorted.filter(s => !s.isHidden));
      toast({ title: 'Service order updated' });
    }
  });

  const filteredServices = useMemo(() => {
    const base = orderedServices.length > 0 ? orderedServices : services || [];
    const filtered = base.filter(service => {
      const matchesCategory = filterCategory === 'all' || service.categoryId === Number(filterCategory);
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
    return filtered.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });
  }, [services, filterCategory, searchQuery, orderedServices]);

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const orderedServicesRef = useRef(orderedServices);
  orderedServicesRef.current = orderedServices;

  useEffect(() => {
    // Only sync from server on initial load or when services list changes (add/delete)
    // Skip during reorder operations to avoid flicker
    if (!services || reorderServices.isPending) return;

    const current = orderedServicesRef.current;

    // Check if this is just a reorder (same IDs, different order) - skip sync
    if (current.length > 0) {
      const currentIds = current.map(s => s.id);
      const newIds = new Set(services.map(s => s.id));
      const sameServices = currentIds.length === newIds.size &&
        currentIds.every(id => newIds.has(id));
      if (sameServices) return;
    }

    const sorted = [...services].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });
    setOrderedServices(sorted);
  }, [services, reorderServices.isPending]);

  const handleServiceDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedServices.findIndex(item => item.id === Number(active.id));
    const newIndex = orderedServices.findIndex(item => item.id === Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(orderedServices, oldIndex, newIndex);
    const withOrder = reordered.map((svc, index) => ({ ...svc, order: index }));

    // Optimistically update local state for immediate visual feedback
    setOrderedServices(withOrder);

    // Send only the id and order to the server
    const orderData = withOrder.map(svc => ({ id: svc.id, order: svc.order as number }));
    reorderServices.mutate(orderData);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Services</h1>
        <p className="text-muted-foreground">Manage your cleaning services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingService(null); }}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="h-10 px-3 text-sm bg-primary text-primary-foreground border-0 shadow-none focus-visible:ring-0"
              data-testid="button-add-service"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" onCloseAutoFocus={(e) => e.preventDefault()}>
            <ServiceForm
              service={editingService}
              categories={categories || []}
              subcategories={subcategories || []}
              allServices={services || []}
              addonRelationships={addonRelationships || []}
              getAccessToken={getAccessToken}
              onSubmit={(data) => {
                if (editingService) {
                  updateService.mutate({ ...data, id: editingService.id } as Service);
                } else {
                  createService.mutate(data as Omit<Service, 'id'>);
                }
              }}
              isLoading={createService.isPending || updateService.isPending}
            />
          </DialogContent>
        </Dialog>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('grid')}
            className={clsx(
              "h-10 min-w-[88px] bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0",
              viewMode === 'grid' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-4 h-4 mr-1.5" />
            Grid
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('list')}
            className={clsx(
              "h-10 min-w-[88px] bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0",
              viewMode === 'list' ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-4 h-4 mr-1.5" />
            List
          </Button>
        </div>
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs h-10 bg-card/70 text-sm placeholder:text-muted-foreground border-0 shadow-none focus-visible:ring-0"
          data-testid="input-search-services"
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px] h-10 bg-card/70 text-sm border-0 shadow-none focus-visible:ring-0" data-testid="select-filter-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent className="border-0 shadow-none">
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredServices?.length === 0 ? (
        <Card className="p-12 text-center bg-card border border-border">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No services found</h3>
          <p className="text-muted-foreground mb-4">
            {services?.length === 0 ? 'Create your first service to get started' : 'Try adjusting your filters'}
          </p>
        </Card>
      ) : (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleServiceDragEnd}
        >
          <SortableContext
            items={filteredServices.map(s => s.id)}
            strategy={viewMode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {viewMode === 'grid' ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {filteredServices?.map((service) => (
                  <ServiceGridItem
                    key={service.id}
                    service={service}
                    categoryName={getCategoryName(service.categoryId)}
                    onEdit={() => {
                      const container = document.getElementById('admin-top');
                      scrollPositionRef.current = container?.scrollTop || 0;
                      setEditingService(service);
                      setIsDialogOpen(true);
                    }}
                    onDelete={() => deleteService.mutate(service.id)}
                    onToggleLanding={() => toggleShowOnLanding.mutate(service.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredServices?.map((service, index) => (
                  <ServiceListRow
                    key={service.id}
                    service={service}
                    categoryName={getCategoryName(service.categoryId)}
                    onEdit={() => {
                      const container = document.getElementById('admin-top');
                      scrollPositionRef.current = container?.scrollTop || 0;
                      setEditingService(service);
                      setIsDialogOpen(true);
                    }}
                    onDelete={() => deleteService.mutate(service.id)}
                    onToggleLanding={() => toggleShowOnLanding.mutate(service.id)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
