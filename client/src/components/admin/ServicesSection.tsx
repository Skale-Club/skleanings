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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { Category, Service, Subcategory } from '@shared/schema';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Clock,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  Image,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
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


function ServiceGridItem({
  service,
  categoryName,
  onEdit,
  onDelete,
  onToggleLanding,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLanding: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative overflow-hidden rounded-lg bg-muted transition-all h-full flex flex-col",
        isDragging && "ring-2 ring-primary/40 shadow-lg bg-card/80",
        !service.showOnLanding && "opacity-50"
      )}
    >
      <button
        className="absolute top-2 left-2 z-20 p-2 text-muted-foreground hover:text-foreground bg-card/80 backdrop-blur-sm rounded-md shadow-sm cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Eye toggle button - top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleLanding();
        }}
        className={clsx(
          "absolute top-2 right-2 z-20 p-2 rounded-md shadow-sm transition-all",
          service.showOnLanding
            ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
            : "bg-card/80 backdrop-blur-sm text-muted-foreground hover:text-foreground"
        )}
        title={service.showOnLanding ? "Visible on landing page" : "Hidden from landing page"}
      >
        {service.showOnLanding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
      {service.imageUrl ? (
        <div
          className="w-full aspect-[4/3] overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onEdit}
        >
          <img
            src={service.imageUrl}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </div>
      ) : (
        <div
          className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-muted-foreground cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onEdit}
        >
          <Package className="w-5 h-5" />
        </div>
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-lg leading-tight pr-6">{service.name}</h3>
          {service.isHidden && (
            <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
              Add-on Only
            </Badge>
          )}
        </div>
        <div className="text-2xl font-bold text-primary mb-2">${service.price}</div>
        <Badge variant="secondary" className="w-fit border-0 bg-secondary mb-2">
          {categoryName}
        </Badge>
        <p className="text-sm text-muted-foreground mb-2">{service.description}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Clock className="w-4 h-4" />
          <span>{durationLabel}</span>
        </div>
        <div className="mt-auto pt-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex-1 bg-card dark:bg-slate-700/60 border-0"
              data-testid={`button-edit-service-${service.id}`}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-card dark:bg-slate-700/60 border-0" data-testid={`button-delete-service-${service.id}`}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{service.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    variant="destructive"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceListRow({
  service,
  categoryName,
  onEdit,
  onDelete,
  onToggleLanding,
  index,
}: {
  service: Service;
  categoryName: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLanding: () => void;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const durationLabel = `${Math.floor(service.durationMinutes / 60)}h ${service.durationMinutes % 60}m`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-card border border-border shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md",
        !service.showOnLanding && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        <button
          className="p-2 text-muted-foreground hover:text-foreground rounded-md cursor-grab active:cursor-grabbing self-center"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div
          className="w-28 sm:w-32 aspect-[4/3] rounded-md overflow-hidden bg-muted flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={onEdit}
        >
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Package className="w-5 h-5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-base leading-tight line-clamp-1">{service.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[11px] border-0 bg-secondary">#{index + 1}</Badge>
            {service.isHidden && (
              <Badge variant="secondary" className="text-[11px] border-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Add-on Only
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-semibold text-primary">${service.price}</span>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{durationLabel}</span>
          </div>
          <Badge variant="secondary" className="w-fit border-0 bg-secondary">
            {categoryName}
          </Badge>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleLanding}
            className="bg-card border-0 text-slate-600 hover:text-slate-800"
            title={service.showOnLanding ? "Visible on landing page" : "Hidden from landing page"}
          >
            {service.showOnLanding ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="bg-card border-0"
            data-testid={`button-edit-service-${service.id}`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card border-0" data-testid={`button-delete-service-${service.id}`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{service.name}". This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  variant="destructive"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

function CategoryReorderRow({
  category,
  serviceCount,
  onEdit,
  onDelete,
  disableDelete,
  index,
  onManageSubcategories,
  subcategories,
}: {
  category: Category;
  serviceCount: number;
  onEdit: () => void;
  onDelete: () => void;
  disableDelete: boolean;
  index: number;
  onManageSubcategories: () => void;
  subcategories?: Subcategory[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        "flex w-full min-w-0 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-lg bg-light-gray dark:bg-slate-800 cursor-grab active:cursor-grabbing transition-all shadow-sm",
        isDragging && "ring-2 ring-primary/40 shadow-md"
      )}
      data-testid={`category-item-${category.id}`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:contents">
        <button
          className="text-muted-foreground cursor-grab p-2 -ml-2"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder category"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 aspect-[4/3] sm:w-24 rounded-[2px] bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
            <FolderOpen className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0 sm:hidden">
          <h3 className="font-semibold truncate">{category.name}</h3>
          <Badge variant="secondary" className="mt-1 bg-[#FFFF01] text-black font-bold dark:bg-[#FFFF01] dark:text-black">
            {serviceCount} services
          </Badge>
          <Badge variant="outline" className="mt-1 border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">
            {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-0"
            onClick={onManageSubcategories}
          >
            Manage subcategories
          </Button>
        </div>
        <div className="flex items-center gap-1 sm:hidden ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            data-testid={`button-edit-category-${category.id}-mobile`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}-mobile`}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                <AlertDialogDescription>
                  {disableDelete
                    ? `This category has ${serviceCount} services. You must delete or reassign them first.`
                    : 'This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={disableDelete}
                  variant="destructive"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate">{category.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{category.description}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary" className="bg-[#FFFF01] text-black font-bold dark:bg-[#FFFF01] dark:text-black">
              {serviceCount} services
            </Badge>
            <Badge variant="outline" className="border-0 bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-200">
              {(subcategories?.filter(sub => sub.categoryId === category.id).length) ?? 0} subcategories
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="border-0"
              onClick={onManageSubcategories}
            >
              Manage subcategories
            </Button>
          </div>
        </div>
        <Badge variant="secondary" className="border-0 bg-slate-800 text-white shrink-0 self-center dark:bg-slate-700 dark:text-slate-200">
          #{index + 1}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2 break-words sm:hidden">{category.description}</p>
      <div className="hidden sm:flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          data-testid={`button-edit-category-${category.id}`}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" data-testid={`button-delete-category-${category.id}`}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Category?</AlertDialogTitle>
              <AlertDialogDescription>
                {disableDelete
                  ? `This category has ${serviceCount} services. You must delete or reassign them first.`
                  : 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                disabled={disableDelete}
                variant="destructive"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// Types for pricing
type PricingType = 'fixed_item' | 'area_based' | 'base_plus_addons' | 'custom_quote';

interface AreaSizePreset {
  name: string;
  sqft: number | null;
  price: number;
}

interface ServiceOptionInput {
  id?: number;
  name: string;
  price: string;
  maxQuantity?: number;
  order?: number;
}

interface ServiceFrequencyInput {
  id?: number;
  name: string;
  discountPercent: string;
  order?: number;
}

function ServiceForm({ service, categories, subcategories, allServices, addonRelationships, onSubmit, isLoading, getAccessToken }: {
  service: Service | null;
  categories: Category[];
  subcategories: Subcategory[];
  allServices: Service[];
  addonRelationships: { id: number, serviceId: number, addonServiceId: number }[];
  onSubmit: (data: Partial<Service> & { addonIds?: number[], options?: ServiceOptionInput[], frequencies?: ServiceFrequencyInput[] }) => void;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [price, setPrice] = useState(service?.price || '');
  const [durationHours, setDurationHours] = useState(service ? Math.floor(service.durationMinutes / 60) : 0);
  const [durationMinutes, setDurationMinutes] = useState(service ? service.durationMinutes % 60 : 0);
  const [categoryId, setCategoryId] = useState(service?.categoryId?.toString() || '');
  const [subcategoryId, setSubcategoryId] = useState(service?.subcategoryId?.toString() || '');
  const [imageUrl, setImageUrl] = useState(service?.imageUrl || '');
  const [isHidden, setIsHidden] = useState(service?.isHidden || false);
  const [addonSearch, setAddonSearch] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<number[]>(() => {
    if (!service || !Array.isArray(addonRelationships)) return [];
    return addonRelationships.filter(r => r.serviceId === service.id).map(r => r.addonServiceId);
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // New pricing fields
  const [pricingType, setPricingType] = useState<PricingType>((service as any)?.pricingType || 'fixed_item');
  const [basePrice, setBasePrice] = useState((service as any)?.basePrice || '');
  const [pricePerUnit, setPricePerUnit] = useState((service as any)?.pricePerUnit || '');
  const [minimumPrice, setMinimumPrice] = useState((service as any)?.minimumPrice || '');
  const [areaSizes, setAreaSizes] = useState<AreaSizePreset[]>(() => {
    const sizes = (service as any)?.areaSizes;
    if (Array.isArray(sizes)) return sizes;
    return [{ name: 'Small Room', sqft: 100, price: 80 }];
  });

  // Options and frequencies for base_plus_addons
  const [serviceOptions, setServiceOptions] = useState<ServiceOptionInput[]>([]);
  const [serviceFrequencies, setServiceFrequencies] = useState<ServiceFrequencyInput[]>([]);

  // Load options and frequencies when editing existing service
  useEffect(() => {
    if (service?.id && pricingType === 'base_plus_addons') {
      // Fetch options
      fetch(`/api/services/${service.id}/options`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServiceOptions(data.map((o: any) => ({
              id: o.id,
              name: o.name,
              price: o.price,
              maxQuantity: o.maxQuantity,
              order: o.order
            })));
          }
        })
        .catch(console.error);

      // Fetch frequencies
      fetch(`/api/services/${service.id}/frequencies`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServiceFrequencies(data.map((f: any) => ({
              id: f.id,
              name: f.name,
              discountPercent: f.discountPercent,
              order: f.order
            })));
          }
        })
        .catch(console.error);
    }
  }, [service?.id, pricingType]);

  const filteredSubcategories = subcategories.filter(sub => sub.categoryId === Number(categoryId));
  const availableAddons = allServices.filter(s =>
    s.id !== service?.id &&
    s.name.toLowerCase().includes(addonSearch.toLowerCase())
  );

  const handleAddonToggle = (addonId: number) => {
    setSelectedAddons(prev =>
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('Authentication required');
        return;
      }

      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      const uploadFetchRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });
      if (!uploadFetchRes.ok) throw new Error('Upload to storage failed');

      setImageUrl(objectPath);
      // Use useToast via a locally accessible variable or props if needed
      // Since toast is from useToast() in the main component, ensuring it's available.
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Service> & { addonIds?: number[], options?: ServiceOptionInput[], frequencies?: ServiceFrequencyInput[] } = {
      name,
      description,
      price: String(price),
      durationMinutes: (durationHours * 60) + durationMinutes,
      categoryId: Number(categoryId),
      imageUrl,
      isHidden,
      addonIds: selectedAddons,
      // New pricing fields
      pricingType,
    } as any;

    if (subcategoryId) {
      data.subcategoryId = Number(subcategoryId);
    }

    // Add pricing-specific fields
    if (pricingType === 'area_based') {
      (data as any).areaSizes = areaSizes;
      (data as any).pricePerUnit = pricePerUnit || null;
      (data as any).minimumPrice = minimumPrice || null;
    } else if (pricingType === 'base_plus_addons') {
      (data as any).basePrice = basePrice || null;
      data.options = serviceOptions;
      data.frequencies = serviceFrequencies;
    } else if (pricingType === 'custom_quote') {
      (data as any).minimumPrice = minimumPrice || null;
    }

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{service ? 'Edit Service' : 'Add Service'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Service Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-service-name" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={categoryId} onValueChange={(val) => { setCategoryId(val); setSubcategoryId(''); }} required>
            <SelectTrigger data-testid="select-service-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredSubcategories.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="subcategory">Subcategory (Optional)</Label>
            <Select value={subcategoryId || "none"} onValueChange={(val) => setSubcategoryId(val === "none" ? '' : val)}>
              <SelectTrigger data-testid="select-service-subcategory">
                <SelectValue placeholder="Select a subcategory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {filteredSubcategories.map(sub => (
                  <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-service-description" />
        </div>

        {/* Pricing Type Selector */}
        <div className="space-y-2">
          <Label>Pricing Type</Label>
          <Select value={pricingType} onValueChange={(val) => setPricingType(val as PricingType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select pricing type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed_item">Fixed Price per Item</SelectItem>
              <SelectItem value="area_based">Price by Area (sqft)</SelectItem>
              <SelectItem value="base_plus_addons">Base + Add-ons</SelectItem>
              <SelectItem value="custom_quote">Custom Quote</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {pricingType === 'fixed_item' && 'Each unit has a fixed price (e.g., $150 per sofa)'}
            {pricingType === 'area_based' && 'Price based on area size with preset options (e.g., carpet cleaning)'}
            {pricingType === 'base_plus_addons' && 'Base price + optional add-ons with frequency discounts (e.g., house cleaning)'}
            {pricingType === 'custom_quote' && 'Customer describes needs, team contacts with quote'}
          </p>
        </div>

        {/* FIXED ITEM: Single Price */}
        {pricingType === 'fixed_item' && (
          <div className="space-y-2">
            <Label htmlFor="price">Price (USD)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              data-testid="input-service-price"
            />
          </div>
        )}

        {/* AREA BASED: Area Sizes + Price per Unit */}
        {pricingType === 'area_based' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Area-Based Pricing</h4>

            {/* Area Size Presets */}
            <div className="space-y-2">
              <Label>Size Presets</Label>
              {areaSizes.map((size, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Name (e.g., Small Room)"
                    value={size.name}
                    onChange={(e) => {
                      const updated = [...areaSizes];
                      updated[index].name = e.target.value;
                      setAreaSizes(updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Sqft"
                    type="number"
                    value={size.sqft || ''}
                    onChange={(e) => {
                      const updated = [...areaSizes];
                      updated[index].sqft = e.target.value ? Number(e.target.value) : null;
                      setAreaSizes(updated);
                    }}
                    className="w-20"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    value={size.price}
                    onChange={(e) => {
                      const updated = [...areaSizes];
                      updated[index].price = Number(e.target.value);
                      setAreaSizes(updated);
                    }}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAreaSizes(areaSizes.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAreaSizes([...areaSizes, { name: '', sqft: null, price: 0 }])}
              >
                + Add Size Option
              </Button>
            </div>

            {/* Price per Unit for custom input */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price per Sqft (for custom size)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(e.target.value)}
                  placeholder="0.75"
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={minimumPrice}
                  onChange={(e) => setMinimumPrice(e.target.value)}
                  placeholder="50.00"
                />
              </div>
            </div>

            {/* Hidden price field for database - use first preset price or minimum */}
            <input type="hidden" value={areaSizes[0]?.price || minimumPrice || '0'} />
          </div>
        )}

        {/* BASE + ADDONS: Base Price + Options + Frequencies */}
        {pricingType === 'base_plus_addons' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Base + Add-ons Pricing</h4>

            <div className="space-y-2">
              <Label>Base Price (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={basePrice}
                onChange={(e) => {
                  setBasePrice(e.target.value);
                  setPrice(e.target.value); // Also set main price
                }}
                placeholder="120.00"
                required
              />
            </div>

            {/* Service Options */}
            <div className="space-y-2">
              <Label>Add-on Options</Label>
              <p className="text-xs text-muted-foreground">Additional services customer can add (e.g., Extra Bedroom +$20)</p>
              {serviceOptions.map((opt, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Option name"
                    value={opt.name}
                    onChange={(e) => {
                      const updated = [...serviceOptions];
                      updated[index].name = e.target.value;
                      setServiceOptions(updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    value={opt.price}
                    onChange={(e) => {
                      const updated = [...serviceOptions];
                      updated[index].price = e.target.value;
                      setServiceOptions(updated);
                    }}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setServiceOptions(serviceOptions.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setServiceOptions([...serviceOptions, { name: '', price: '' }])}
              >
                + Add Option
              </Button>
            </div>

            {/* Service Frequencies */}
            <div className="space-y-2">
              <Label>Frequency Options</Label>
              <p className="text-xs text-muted-foreground">Recurring service discounts (e.g., Weekly -15%)</p>
              {serviceFrequencies.map((freq, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Frequency name"
                    value={freq.name}
                    onChange={(e) => {
                      const updated = [...serviceFrequencies];
                      updated[index].name = e.target.value;
                      setServiceFrequencies(updated);
                    }}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Discount %"
                    type="number"
                    step="0.01"
                    value={freq.discountPercent}
                    onChange={(e) => {
                      const updated = [...serviceFrequencies];
                      updated[index].discountPercent = e.target.value;
                      setServiceFrequencies(updated);
                    }}
                    className="w-24"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setServiceFrequencies(serviceFrequencies.filter((_, i) => i !== index))}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setServiceFrequencies([...serviceFrequencies, { name: '', discountPercent: '0' }])}
              >
                + Add Frequency
              </Button>
            </div>
          </div>
        )}

        {/* CUSTOM QUOTE: Minimum Price only */}
        {pricingType === 'custom_quote' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Custom Quote Pricing</h4>
            <p className="text-xs text-muted-foreground">
              Customer will describe their needs and your team will contact them with a quote.
              A minimum charge applies to the booking.
            </p>

            <div className="space-y-2">
              <Label>Minimum Price (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={minimumPrice}
                onChange={(e) => {
                  setMinimumPrice(e.target.value);
                  setPrice(e.target.value); // Also set main price
                }}
                placeholder="150.00"
                required
              />
            </div>
          </div>
        )}

        {/* Hidden price field for non-fixed types */}
        {pricingType !== 'fixed_item' && (
          <input
            type="hidden"
            name="price"
            value={pricingType === 'area_based' ? (areaSizes[0]?.price || minimumPrice || '0') :
              pricingType === 'base_plus_addons' ? (basePrice || '0') :
                (minimumPrice || '0')}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="durationHours">Duration (Hours)</Label>
            <Input
              id="durationHours"
              type="number"
              min="0"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              data-testid="input-service-hours"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Duration (Minutes)</Label>
            <Input
              id="durationMinutes"
              type="number"
              min="0"
              max="59"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              data-testid="input-service-minutes"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Service Image</Label>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleImageUpload}
            data-testid="input-service-image-upload"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-dashed border-border cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-center group"
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl.startsWith('/objects/') ? imageUrl : imageUrl}
                  alt="Service preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white flex flex-col items-center gap-2">
                    <Pencil className="h-8 w-8" />
                    <span className="text-sm font-medium">Change Image</span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center border shadow-sm">
                  <Image className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Click to upload</p>
                  <p className="text-xs">4:3 aspect ratio recommended</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id="isHidden"
            checked={isHidden}
            onCheckedChange={(checked) => setIsHidden(!!checked)}
            data-testid="checkbox-service-hidden"
          />
          <Label htmlFor="isHidden" className="text-sm font-normal cursor-pointer">
            Hide from main services list (Service will only show as add-on)
          </Label>
        </div>

        {service && allServices.length > 1 && (
          <div className="space-y-2 pt-2">
            <Label>Suggested Add-ons</Label>
            <p className="text-xs text-muted-foreground">Choose which services to suggest when this is added</p>
            <div className="space-y-2 border rounded-md p-3 bg-muted">
              <Input
                placeholder="Search services..."
                value={addonSearch}
                onChange={(e) => setAddonSearch(e.target.value)}
                className="h-8 text-sm mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {availableAddons.length > 0 ? (
                  availableAddons.map(addon => (
                    <div key={addon.id} className="flex items-center space-x-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-1 transition-colors">
                      <Checkbox
                        id={`addon-${addon.id}`}
                        checked={selectedAddons.includes(addon.id)}
                        onCheckedChange={() => handleAddonToggle(addon.id)}
                        data-testid={`checkbox-addon-${addon.id}`}
                      />
                      <Label htmlFor={`addon-${addon.id}`} className="text-sm font-normal cursor-pointer flex-1 flex justify-between items-center">
                        <span className="truncate">{addon.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">${addon.price}</span>
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-center py-4 text-muted-foreground">No services found</p>
                )}
              </div>
              {selectedAddons.length > 0 && (
                <div className="pt-2 border-t mt-2 flex flex-wrap gap-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground w-full mb-1">Selected:</span>
                  {selectedAddons.map(id => {
                    const s = allServices.find(as => as.id === id);
                    if (!s) return null;
                    return (
                      <Badge key={id} variant="secondary" className="text-[10px] py-0 h-5 border-0 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                        {s.name}
                        <button
                          onClick={(e) => { e.preventDefault(); handleAddonToggle(id); }}
                          className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          x
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !categoryId} data-testid="button-save-service">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {service ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}


