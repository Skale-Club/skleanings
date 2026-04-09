import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceAreaCity, ServiceAreaGroup } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

export function UnifiedServiceAreasManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<ServiceAreaGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isCityDialogOpen, setIsCityDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceAreaGroup | null>(null);
  const [editingCity, setEditingCity] = useState<ServiceAreaCity | null>(null);
  const [selectedGroupForCity, setSelectedGroupForCity] = useState<number | null>(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
  });
  const [cityFormData, setCityFormData] = useState({
    areaGroupId: 0,
    name: '',
    zipcode: '',
    isActive: true,
  });

  const { data: fetchedGroups, isLoading: groupsLoading } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch service area groups');
      return response.json();
    },
  });

  const { data: cities, isLoading: citiesLoading } = useQuery<ServiceAreaCity[]>({
    queryKey: ['/api/service-area-cities', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-cities?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch cities');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedGroups) {
      setGroups(fetchedGroups);
    }
  }, [fetchedGroups]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  // Group mutations
  const createGroup = useMutation({
    mutationFn: async (data: typeof groupFormData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-groups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Region created successfully' });
      resetGroupForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create region', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof groupFormData }) => {
      return apiRequest('PUT', `/api/service-area-groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Region updated successfully' });
      resetGroupForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update region', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Region deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete region', description: error.message, variant: 'destructive' });
    }
  });

  // City mutations
  const createCity = useMutation({
    mutationFn: async (data: typeof cityFormData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-cities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City created successfully' });
      resetCityForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create city', description: error.message, variant: 'destructive' });
    }
  });

  const updateCity = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof cityFormData }) => {
      return apiRequest('PUT', `/api/service-area-cities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City updated successfully' });
      resetCityForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update city', description: error.message, variant: 'destructive' });
    }
  });

  const deleteCity = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-cities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete city', description: error.message, variant: 'destructive' });
    }
  });

  const resetGroupForm = () => {
    setGroupFormData({ name: '', slug: '', description: '', isActive: true });
    setEditingGroup(null);
    setIsGroupDialogOpen(false);
  };

  const resetCityForm = () => {
    setCityFormData({ areaGroupId: 0, name: '', zipcode: '', isActive: true });
    setEditingCity(null);
    setIsCityDialogOpen(false);
    setSelectedGroupForCity(null);
  };

  const handleGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithSlug = { ...groupFormData, slug: generateSlug(groupFormData.name) };
    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, data: dataWithSlug });
    } else {
      createGroup.mutate({ ...dataWithSlug, order: groups.length });
    }
  };

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const groupCities = cities?.filter(c => c.areaGroupId === cityFormData.areaGroupId) || [];
    if (editingCity) {
      updateCity.mutate({ id: editingCity.id, data: cityFormData });
    } else {
      createCity.mutate({ ...cityFormData, order: groupCities.length });
    }
  };

  const handleEditGroup = (group: ServiceAreaGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      slug: group.slug,
      description: group.description || '',
      isActive: group.isActive,
    });
    setIsGroupDialogOpen(true);
  };

  const handleEditCity = (city: ServiceAreaCity) => {
    setEditingCity(city);
    setCityFormData({
      areaGroupId: city.areaGroupId,
      name: city.name,
      zipcode: city.zipcode || '',
      isActive: city.isActive,
    });
    setIsCityDialogOpen(true);
  };

  const handleAddCityToGroup = (groupId: number) => {
    setSelectedGroupForCity(groupId);
    setCityFormData({ ...cityFormData, areaGroupId: groupId });
    setIsCityDialogOpen(true);
  };

  const toggleGroupExpansion = (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getCitiesForGroup = (groupId: number) => {
    return cities?.filter(c => c.areaGroupId === groupId) || [];
  };

  if (groupsLoading || citiesLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Group Button */}
      <div className="flex justify-end">
        <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetGroupForm(); setIsGroupDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Area Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Service Area Group' : 'Add Service Area Group'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <Label htmlFor="group-name">Region/County Name *</Label>
                <Input
                  id="group-name"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="e.g., MetroWest, Greater Boston"
                  required
                />
              </div>
              <div>
                <Label htmlFor="group-description">Description (Optional)</Label>
                <Textarea
                  id="group-description"
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  placeholder="Brief description of this service area"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="group-isActive"
                  checked={groupFormData.isActive}
                  onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
                />
                <Label htmlFor="group-isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetGroupForm}>Cancel</Button>
                <Button type="submit">
                  {editingGroup ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* City Dialog */}
      <Dialog open={isCityDialogOpen} onOpenChange={setIsCityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCity ? 'Edit City' : 'Add City'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCitySubmit} className="space-y-4">
            <div>
              <Label htmlFor="city-group">Service Area Group *</Label>
              <Select
                value={cityFormData.areaGroupId ? String(cityFormData.areaGroupId) : ''}
                onValueChange={(value) => setCityFormData({ ...cityFormData, areaGroupId: Number(value) })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {groups?.map(group => (
                    <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="city-name">City/Town Name *</Label>
              <Input
                id="city-name"
                value={cityFormData.name}
                onChange={(e) => setCityFormData({ ...cityFormData, name: e.target.value })}
                placeholder="e.g., Framingham, Natick"
                required
              />
            </div>
            <div>
              <Label htmlFor="city-zipcode">Zipcode (Optional)</Label>
              <Input
                id="city-zipcode"
                value={cityFormData.zipcode}
                onChange={(e) => setCityFormData({ ...cityFormData, zipcode: e.target.value })}
                placeholder="e.g., 02138"
                maxLength={5}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="city-isActive"
                checked={cityFormData.isActive}
                onCheckedChange={(checked) => setCityFormData({ ...cityFormData, isActive: checked })}
              />
              <Label htmlFor="city-isActive">Active (visible on website)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCityForm}>Cancel</Button>
              <Button type="submit" disabled={!cityFormData.areaGroupId}>
                {editingCity ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No service area groups yet. Add your first region to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const groupCities = getCitiesForGroup(group.id);
            const isExpanded = expandedGroups.has(group.id);

            return (
              <div key={group.id} className="border rounded-lg bg-slate-50">
                {/* Group Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => toggleGroupExpansion(group.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                    <MapPin className="w-5 h-5 text-primary" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{group.name}</span>
                        <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
                          {group.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {groupCities.length} {groupCities.length === 1 ? 'city' : 'cities'}
                        </Badge>
                      </div>
                      {group.description && (
                        <p className="text-xs text-slate-500 mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => updateGroup.mutate({ id: group.id, data: { ...groupFormData, name: group.name, slug: group.slug, description: group.description || '', isActive: !group.isActive } })}
                    >
                      {group.isActive ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditGroup(group)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        if (groupCities.length > 0) {
                          toast({ title: `Cannot delete region with ${groupCities.length} cities`, description: 'Delete or reassign cities first', variant: 'destructive' });
                        } else if (window.confirm(`Delete region "${group.name}"?`)) {
                          deleteGroup.mutate(group.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Cities List (Expanded) */}
                {isExpanded && (
                  <div className="border-t bg-white p-4 space-y-2">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-slate-600">Cities in {group.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddCityToGroup(group.id)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add City
                      </Button>
                    </div>

                    {groupCities.length === 0 ? (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No cities yet. Click "Add City" to get started.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {groupCities.map((city) => (
                          <div key={city.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm font-medium">{city.name}</span>
                              {city.zipcode && (
                                <span className="text-xs text-slate-500">• Zip: {city.zipcode}</span>
                              )}
                              <Badge variant={city.isActive ? 'default' : 'secondary'} className="text-xs h-5">
                                {city.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => updateCity.mutate({ id: city.id, data: { ...cityFormData, areaGroupId: city.areaGroupId, name: city.name, zipcode: city.zipcode || '', isActive: !city.isActive } })}
                              >
                                {city.isActive ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleEditCity(city)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => {
                                  if (window.confirm(`Delete city "${city.name}"?`)) {
                                    deleteCity.mutate(city.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
