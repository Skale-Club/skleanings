import { useEffect, useState } from 'react';
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Category, Service, Subcategory } from '@shared/schema';
import { authenticatedRequest, apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { CategoryForm } from './categories/CategoryForm';
import { CategoryReorderRow } from './services/CategoryReorderRow';

export function CategoriesSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [isSubDialogOpen, setIsSubDialogOpen] = useState(false);
  const [selectedCategoryForSubs, setSelectedCategoryForSubs] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subName, setSubName] = useState('');
  const reorderSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  const { data: subcategories } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  useEffect(() => {
    if (categories) {
      const sorted = [...categories].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA === orderB) return a.id - b.id;
        return orderA - orderB;
      });
      setOrderedCategories(sorted);
    }
  }, [categories]);

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; description: string; imageUrl: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('POST', '/api/categories', token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    }
  });

  const updateCategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; description: string; imageUrl: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('PUT', `/api/categories/${data.id}`, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category updated successfully' });
      setEditingCategory(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update category', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('DELETE', `/api/categories/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      toast({ title: 'Category deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete category', description: error.message, variant: 'destructive' });
    }
  });

  const getServiceCount = (categoryId: number) => {
    return services?.filter(s => s.categoryId === categoryId).length || 0;
  };

  const createSubcategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; categoryId: number }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('POST', '/api/subcategories', token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory created successfully' });
      setEditingSubcategory(null);
      setSubName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const updateSubcategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; categoryId: number }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('PUT', `/api/subcategories/${data.id}`, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory updated successfully' });
      setEditingSubcategory(null);
      setSubName('');
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const deleteSubcategory = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/subcategories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenSubDialog = (category: Category) => {
    setSelectedCategoryForSubs(category);
    setEditingSubcategory(null);
    setSubName('');
    setIsSubDialogOpen(true);
  };

  const handleSaveSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryForSubs) return;
    const payload = {
      name: subName,
      slug: subName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      categoryId: selectedCategoryForSubs.id,
    };
    if (editingSubcategory) {
      updateSubcategory.mutate({ ...payload, id: editingSubcategory.id });
    } else {
      createSubcategory.mutate(payload);
    }
  };

  const categorySubcategories = selectedCategoryForSubs
    ? subcategories?.filter(sub => sub.categoryId === selectedCategoryForSubs.id)
    : [];

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedCategories(prev => {
      const oldIndex = prev.findIndex(c => c.id === Number(active.id));
      const newIndex = prev.findIndex(c => c.id === Number(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      const previous = prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);

      const reorderPayload = reordered.map((cat, index) => ({
        id: cat.id,
        order: index
      }));

      getAccessToken().then(token => {
        if (!token) throw new Error('Authentication required');
        return authenticatedRequest('PUT', '/api/categories/reorder', token, { order: reorderPayload });
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
          toast({ title: 'Category order updated' });
        })
        .catch((error: any) => {
          toast({
            title: 'Failed to update order',
            description: error.message,
            variant: 'destructive'
          });
          setOrderedCategories(previous);
        });

      return reordered;
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage your service categories. Drag to reorder.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingCategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category" className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="border-0 bg-white dark:bg-slate-800">
            <CategoryForm
              category={editingCategory}
              getAccessToken={getAccessToken}
              onSubmit={(data) => {
                if (editingCategory) {
                  updateCategory.mutate({ ...data, id: editingCategory.id });
                } else {
                  createCategory.mutate(data);
                }
              }}
              isLoading={createCategory.isPending || updateCategory.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {orderedCategories?.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No categories yet</h3>
          <p className="text-muted-foreground mb-4">Create your first category to get started</p>
        </Card>
      ) : (
        <DndContext
          sensors={reorderSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleCategoryDragEnd}
        >
          <SortableContext
            items={orderedCategories.map(cat => cat.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid gap-3">
              {orderedCategories?.map((category, index) => (
                <CategoryReorderRow
                  key={category.id}
                  category={category}
                  serviceCount={getServiceCount(category.id)}
                  onEdit={() => { setEditingCategory(category); setIsDialogOpen(true); }}
                  onDelete={() => deleteCategory.mutate(category.id)}
                  disableDelete={getServiceCount(category.id) > 0}
                  index={index}
                  onManageSubcategories={() => handleOpenSubDialog(category)}
                  subcategories={subcategories}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={isSubDialogOpen} onOpenChange={(open) => {
        setIsSubDialogOpen(open);
        if (!open) {
          setSelectedCategoryForSubs(null);
          setEditingSubcategory(null);
          setSubName('');
        }
      }}>
        <DialogContent className="max-w-xl border-0 bg-white dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle>
              Manage subcategories {selectedCategoryForSubs ? `for ${selectedCategoryForSubs.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveSubcategory} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subcategory-name-inline">Name</Label>
              <Input
                id="subcategory-name-inline"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                required
                data-testid="input-subcategory-name-inline"
              />
            </div>
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="border-0">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                disabled={
                  !subName ||
                  createSubcategory.isPending ||
                  updateSubcategory.isPending ||
                  !selectedCategoryForSubs
                }
              >
                {(createSubcategory.isPending || updateSubcategory.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingSubcategory ? 'Update subcategory' : 'Add subcategory'}
              </Button>
            </div>
          </form>

          <div className="mt-6 space-y-3 max-h-80 overflow-y-auto pr-1">
            {categorySubcategories && categorySubcategories.length > 0 ? (
              categorySubcategories.map((subcategory) => (
                <div
                  key={subcategory.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-gray-200 dark:border-slate-700"
                  data-testid={`subcategory-item-${subcategory.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{subcategory.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {services?.filter(s => s.subcategoryId === subcategory.id).length || 0} services
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingSubcategory(subcategory);
                        setSubName(subcategory.name);
                      }}
                      data-testid={`button-edit-subcategory-${subcategory.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-subcategory-${subcategory.id}`}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Subcategory?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {(services?.filter(s => s.subcategoryId === subcategory.id).length || 0) > 0
                              ? 'This subcategory has services. Delete or reassign them first.'
                              : 'This action cannot be undone.'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSubcategory.mutate(subcategory.id)}
                            disabled={(services?.filter(s => s.subcategoryId === subcategory.id).length || 0) > 0}
                            variant="destructive"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No subcategories yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
