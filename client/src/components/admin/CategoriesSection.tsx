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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type { Category, Service, Subcategory } from '@shared/schema';
import { authenticatedRequest, apiRequest, queryClient } from '@/lib/queryClient';
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
import { FolderOpen, GripVertical, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';

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
                className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border-0"
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

function CategoryForm({ category, onSubmit, isLoading, getAccessToken }: {
  category: Category | null;
  onSubmit: (data: { name: string; slug: string; description: string; imageUrl: string }) => void;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

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
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), description, imageUrl });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-category-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-category-description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Category Image</Label>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Or URL:</span>
              <Input
                id="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-xs"
                data-testid="input-category-image"
              />
            </div>
            {imageUrl && (
              <div className="relative w-48 aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-border cursor-pointer group" onClick={() => document.getElementById('categoryImageUpload')?.click()}>
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-50"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-white text-xs font-medium">Click to upload</p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  4:3 Preview
                </div>
              </div>
            )}
            <Input
              id="categoryImageUpload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              data-testid="input-category-image-upload"
              className="hidden"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button" className="border-0">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-category" className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 border-0">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {category ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SubcategoriesSection() {
  const { toast } = useToast();
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['/api/categories']
  });

  const { data: subcategories, isLoading } = useQuery<Subcategory[]>({
    queryKey: ['/api/subcategories']
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services']
  });

  const createSubcategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; categoryId: number }) => {
      return apiRequest('POST', '/api/subcategories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory created successfully' });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create subcategory', description: error.message, variant: 'destructive' });
    }
  });

  const updateSubcategory = useMutation({
    mutationFn: async (data: { id: number; name: string; slug: string; categoryId: number }) => {
      return apiRequest('PUT', `/api/subcategories/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subcategories'] });
      toast({ title: 'Subcategory updated successfully' });
      setEditingSubcategory(null);
      setIsDialogOpen(false);
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

  const getCategoryName = (categoryId: number) => {
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getServiceCount = (subcategoryId: number) => {
    return services?.filter(s => s.subcategoryId === subcategoryId).length || 0;
  };

  const filteredSubcategories = subcategories?.filter(sub => {
    return filterCategory === 'all' || sub.categoryId === Number(filterCategory);
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subcategories</h1>
          <p className="text-muted-foreground">Organize services within categories</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingSubcategory(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-subcategory">
              <Plus className="w-4 h-4 mr-2" />
              Add Subcategory
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubcategoryForm
              subcategory={editingSubcategory}
              categories={categories || []}
              onSubmit={(data) => {
                if (editingSubcategory) {
                  updateSubcategory.mutate({ ...data, id: editingSubcategory.id });
                } else {
                  createSubcategory.mutate(data);
                }
              }}
              isLoading={createSubcategory.isPending || updateSubcategory.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-subcategory-category">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map(cat => (
              <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredSubcategories?.length === 0 ? (
        <div className="p-12 text-center bg-card border border-border rounded-lg">
          <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">No subcategories yet</h3>
          <p className="text-muted-foreground mb-4">Create subcategories to organize your services</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredSubcategories?.map((subcategory) => (
            <div
              key={subcategory.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted transition-all"
              data-testid={`subcategory-item-${subcategory.id}`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{subcategory.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="border-0 bg-secondary">
                    {getCategoryName(subcategory.categoryId)}
                  </Badge>
                  <Badge variant="outline" className="border-0 bg-secondary">
                    {getServiceCount(subcategory.id)} services
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setEditingSubcategory(subcategory); setIsDialogOpen(true); }}
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
                        {getServiceCount(subcategory.id) > 0
                          ? `This subcategory has ${getServiceCount(subcategory.id)} services. You must delete or reassign them first.`
                          : 'This action cannot be undone.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteSubcategory.mutate(subcategory.id)}
                        disabled={getServiceCount(subcategory.id) > 0}
                        variant="destructive"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubcategoryForm({ subcategory, categories, onSubmit, isLoading }: {
  subcategory: Subcategory | null;
  categories: Category[];
  onSubmit: (data: { name: string; slug: string; categoryId: number }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(subcategory?.name || '');
  const [categoryId, setCategoryId] = useState(subcategory?.categoryId?.toString() || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), categoryId: Number(categoryId) });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{subcategory ? 'Edit Subcategory' : 'Add Subcategory'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="subcategory-name">Name</Label>
          <Input id="subcategory-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-subcategory-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="subcategory-category">Parent Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId} required>
            <SelectTrigger data-testid="select-subcategory-category">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading || !categoryId} data-testid="button-save-subcategory">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {subcategory ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
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

