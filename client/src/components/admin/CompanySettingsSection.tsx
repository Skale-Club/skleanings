import { useCallback, useEffect, useRef, useState } from 'react';
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
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServiceArea, ServiceAreaCity, ServiceAreaGroup } from '@shared/schema';
import { authenticatedRequest, apiRequest, queryClient } from '@/lib/queryClient';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { useToast } from '@/hooks/use-toast';
import type { CompanySettingsData } from '@/components/admin/shared/types';
import { DEFAULT_BUSINESS_HOURS, INDUSTRY_OPTIONS } from '@/components/admin/shared/constants';
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
import { Spinner } from '@/components/ui/spinner';
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
  Building2,
  ChevronDown,
  ChevronRight,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Image,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';

const normalizeIndustryValue = (value: string) => value.trim().toLowerCase();

const resolveIndustrySelection = (value?: string | null) => {
  if (!value) return '';
  const normalized = normalizeIndustryValue(value);
  const match = INDUSTRY_OPTIONS.find((option) => normalizeIndustryValue(option) === normalized);
  return match || 'Other';
};
export function CompanySettingsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettingsData>({
    companyName: 'Skleanings',
    industry: 'Cleaning',
    companyEmail: 'contact@skleanings.com',
    companyPhone: '',
    companyAddress: '',
    workingHoursStart: '08:00',
    workingHoursEnd: '18:00',
    logoMain: '',
    logoDark: '',
    logoIcon: '',
    sectionsOrder: null,
    socialLinks: [],
    mapEmbedUrl: '',
    heroTitle: '',
    heroSubtitle: '',
    heroImageUrl: '',
    ctaText: '',
    homepageContent: DEFAULT_HOMEPAGE_CONTENT,
    timeFormat: '12h',
    timeZone: 'America/New_York',
    businessHours: DEFAULT_BUSINESS_HOURS,
    minimumBookingValue: '0',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [industrySelection, setIndustrySelection] = useState<string>(resolveIndustrySelection('Cleaning'));
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: fetchedSettings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  useEffect(() => {
    if (fetchedSettings) {
      setSettings(fetchedSettings);
      setIndustrySelection(resolveIndustrySelection(fetchedSettings.industry));
    }
  }, [fetchedSettings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveSettings = useCallback(async (newSettings: Partial<CompanySettingsData>) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      await authenticatedRequest('PUT', '/api/company-settings', token, newSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      setLastSaved(new Date());
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken]);

  const updateField = useCallback(<K extends keyof CompanySettingsData>(field: K, value: CompanySettingsData[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }));

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveSettings({ [field]: value });
    }, 800);
  }, [saveSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'dark' | 'icon') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Get access token for authentication
      const token = await getAccessToken(); // This should be available from useAdminAuth
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      // Use authenticated request to get upload URL
      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      const fieldMap = { main: 'logoMain', dark: 'logoDark', icon: 'logoIcon' } as const;
      const fieldName = fieldMap[type];

      setSettings(prev => ({ ...prev, [fieldName]: objectPath }));
      await saveSettings({ [fieldName]: objectPath });

      toast({ title: 'Asset uploaded and saved' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">Manage your business information and assets</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Auto-saved</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Business Information
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={settings.companyName || ''}
                  onChange={(e) => updateField('companyName', e.target.value)}
                  data-testid="input-company-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={industrySelection || resolveIndustrySelection(settings.industry)}
                  onValueChange={(value) => {
                    setIndustrySelection(value);
                    if (value === 'Other') {
                      if (resolveIndustrySelection(settings.industry) !== 'Other') {
                        setSettings((prev) => ({ ...prev, industry: '' }));
                        saveSettings({ industry: '' });
                      }
                      return;
                    }
                    setSettings((prev) => ({ ...prev, industry: value }));
                    saveSettings({ industry: value });
                  }}
                >
                  <SelectTrigger id="industry" data-testid="input-company-industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {industrySelection === 'Other' && (
                  <Input
                    id="industry-custom"
                    value={settings.industry || ''}
                    onChange={(e) => updateField('industry', e.target.value)}
                    placeholder="Type industry"
                    data-testid="input-company-industry-custom"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Contact Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={settings.companyEmail || ''}
                  onChange={(e) => updateField('companyEmail', e.target.value)}
                  data-testid="input-company-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Phone Number</Label>
                <Input
                  id="companyPhone"
                  value={settings.companyPhone || ''}
                  onChange={(e) => updateField('companyPhone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  data-testid="input-company-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Business Address</Label>
                <Input
                  id="companyAddress"
                  value={settings.companyAddress || ''}
                  onChange={(e) => updateField('companyAddress', e.target.value)}
                  placeholder="123 Main St, City, State"
                  data-testid="input-company-address"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mapEmbedUrl">Map Embed URL (Iframe src)</Label>
                <Input
                  id="mapEmbedUrl"
                  value={settings.mapEmbedUrl || ''}
                  onChange={(e) => updateField('mapEmbedUrl', e.target.value)}
                  placeholder="https://www.google.com/maps/embed?..."
                  data-testid="input-map-embed-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the iframe "src" attribute from Google Maps "Share -{'>'} Embed a map" to update the map shown on the home page.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Service Areas
            </h2>
            <p className="text-sm text-muted-foreground">Manage regions/counties where you provide services (e.g., MetroWest, Greater Boston)</p>
            <UnifiedServiceAreasManager />
          </div>

        </div>

        <div className="space-y-6">
          <div className="bg-muted p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" />
              Branding Assets
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Main Logo (Light Mode)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden relative group">
                    {settings.logoMain ? (
                      <img src={settings.logoMain} alt="Main Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Main Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'main')} accept="image/*" />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Dark Logo (Optional)</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-lg border-2 border-dashed border-border bg-slate-900 dark:bg-slate-100 flex items-center justify-center overflow-hidden relative group">
                    {settings.logoDark ? (
                      <img src={settings.logoDark} alt="Dark Logo" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Dark Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'dark')} accept="image/*" />
                      <Plus className="w-8 h-8 text-white" />
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Favicon / App Icon</Label>
                <div className="flex flex-col gap-3">
                  <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border bg-white flex items-center justify-center overflow-hidden relative group mx-auto">
                    {settings.logoIcon ? (
                      <img src={settings.logoIcon} alt="Icon" className="max-h-full max-w-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-2">
                        <Image className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                        <p className="text-[10px] text-muted-foreground">Icon</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Input type="file" className="hidden" onChange={(e) => handleLogoUpload(e, 'icon')} accept="image/*" />
                      <Plus className="w-6 h-6 text-white" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-6 mt-2">
                <Label className="text-base font-semibold">Social Media Links (Max 5)</Label>
                <div className="space-y-3">
                  {(settings.socialLinks || []).map((link, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <Select
                          value={link.platform}
                          onValueChange={(value) => {
                            const newLinks = [...(settings.socialLinks || [])];
                            newLinks[index].platform = value;
                            setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                            saveSettings({ socialLinks: newLinks });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Platform" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="twitter">X (Twitter)</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="tiktok">TikTok</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={link.url}
                          onChange={(e) => {
                            const newLinks = [...(settings.socialLinks || [])];
                            newLinks[index].url = e.target.value;
                            setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                          }}
                          onBlur={() => saveSettings({ socialLinks: settings.socialLinks })}
                          placeholder="https://social-media.com/yourprofile"
                          className="flex-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-1"
                        onClick={() => {
                          const newLinks = (settings.socialLinks || []).filter((_, i) => i !== index);
                          setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                          saveSettings({ socialLinks: newLinks });
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {(settings.socialLinks || []).length < 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => {
                        const newLinks = [...(settings.socialLinks || []), { platform: 'facebook', url: '' }];
                        setSettings(prev => ({ ...prev, socialLinks: newLinks }));
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Social Link
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Service Areas Manager Component (inside Company Settings)
function ServiceAreasManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<ServiceArea | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    zipcode: '',
    isActive: true,
  });

  // Fetch all service areas (including inactive for admin)
  const { data: fetchedAreas, isLoading } = useQuery<ServiceArea[]>({
    queryKey: ['/api/service-areas', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-areas?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch service areas');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedAreas) {
      setAreas(fetchedAreas);
    }
  }, [fetchedAreas]);

  // Create mutation
  const createArea = useMutation({
    mutationFn: async (data: typeof formData & { order: number }) => {
      return apiRequest('POST', '/api/service-areas', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
      toast({ title: 'Service area created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service area', description: error.message, variant: 'destructive' });
    }
  });

  // Update mutation
  const updateArea = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/service-areas/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
      toast({ title: 'Service area updated successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service area', description: error.message, variant: 'destructive' });
    }
  });

  // Delete mutation
  const deleteArea = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-areas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
      toast({ title: 'Service area deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service area', description: error.message, variant: 'destructive' });
    }
  });

  // Reorder mutation
  const reorderAreas = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('POST', '/api/service-areas/reorder', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-areas', 'all'] });
    },
  });

  // Drag and drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && areas) {
      const oldIndex = areas.findIndex((a) => a.id === active.id);
      const newIndex = areas.findIndex((a) => a.id === over.id);
      const newAreas = arrayMove(areas, oldIndex, newIndex);
      setAreas(newAreas);
      const updates = newAreas.map((area, index) => ({ id: area.id, order: index }));
      reorderAreas.mutate(updates);
    }
  };

  // Form handlers
  const resetForm = () => {
    setFormData({ name: '', region: '', zipcode: '', isActive: true });
    setEditingArea(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingArea) {
      updateArea.mutate({ id: editingArea.id, data: formData });
    } else {
      createArea.mutate({ ...formData, order: areas.length });
    }
  };

  const handleEdit = (area: ServiceArea) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      region: area.region,
      zipcode: area.zipcode || '',
      isActive: area.isActive,
    });
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center p-4"><Spinner /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Area
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingArea ? 'Edit Service Area' : 'Add Service Area'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="region">Region/County *</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="e.g., Middlesex County, Norfolk County, Greater Boston"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">City/Town Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Boston, Cambridge"
                  required
                />
              </div>
              <div>
                <Label htmlFor="zipcode">Zipcode (Optional)</Label>
                <Input
                  id="zipcode"
                  value={formData.zipcode}
                  onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                  placeholder="e.g., 02138"
                  maxLength={5}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">
                  {editingArea ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {areas.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No service areas yet. Add your first area to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={areas.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {areas.map((area) => (
                <SortableServiceAreaItem
                  key={area.id}
                  area={area}
                  onEdit={handleEdit}
                  onDelete={deleteArea.mutate}
                  onToggleActive={(id, isActive) =>
                    updateArea.mutate({ id, data: { name: area.name, region: area.region, zipcode: area.zipcode || '', isActive } })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Sortable item component for Service Areas
function SortableServiceAreaItem({
  area,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  area: ServiceArea;
  onEdit: (area: ServiceArea) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: area.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{area.name}</span>
            <Badge variant={area.isActive ? 'default' : 'secondary'} className="text-xs">
              {area.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{area.region}</span>
            {area.zipcode && (
              <>
                <span>•</span>
                <span>Zip: {area.zipcode}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onToggleActive(area.id, !area.isActive)}
        >
          {area.isActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(area)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (window.confirm('Delete this service area?')) {
              onDelete(area.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// ===== NEW HIERARCHICAL SERVICE AREAS MANAGERS =====

// Unified Service Areas Manager (Groups + Cities in one interface)
function UnifiedServiceAreasManager() {
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
                    <MapPin className="w-5 h-5 text-blue-600" />
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

// Keep old components for reference/backward compatibility (can be removed later)
function ServiceAreaGroupsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [groups, setGroups] = useState<ServiceAreaGroup[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServiceAreaGroup | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    isActive: true,
  });

  const { data: fetchedGroups, isLoading } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch service area groups');
      return response.json();
    },
  });

  const { data: cities } = useQuery<ServiceAreaCity[]>({
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

  const createGroup = useMutation({
    mutationFn: async (data: typeof formData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-groups', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Service area group created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create service area group', description: error.message, variant: 'destructive' });
    }
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/service-area-groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Service area group updated successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update service area group', description: error.message, variant: 'destructive' });
    }
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/service-area-groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
      toast({ title: 'Service area group deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete service area group', description: error.message, variant: 'destructive' });
    }
  });

  const reorderGroups = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('POST', '/api/service-area-groups/reorder', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-groups', 'all'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && groups) {
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);
      const updates = newGroups.map((group, index) => ({ id: group.id, order: index }));
      reorderGroups.mutate(updates);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', slug: '', description: '', isActive: true });
    setEditingGroup(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataWithSlug = { ...formData, slug: generateSlug(formData.name) };
    if (editingGroup) {
      updateGroup.mutate({ id: editingGroup.id, data: dataWithSlug });
    } else {
      createGroup.mutate({ ...dataWithSlug, order: groups.length });
    }
  };

  const handleEdit = (group: ServiceAreaGroup) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      slug: group.slug,
      description: group.description || '',
      isActive: group.isActive,
    });
    setIsDialogOpen(true);
  };

  const getCityCount = (groupId: number) => {
    return cities?.filter(c => c.areaGroupId === groupId).length || 0;
  };

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Area Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Service Area Group' : 'Add Service Area Group'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="group-name">Region/County Name *</Label>
                <Input
                  id="group-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., MetroWest, Greater Boston"
                  required
                />
              </div>
              <div>
                <Label htmlFor="group-description">Description (Optional)</Label>
                <Textarea
                  id="group-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this service area"
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="group-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="group-isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">
                  {editingGroup ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No service area groups yet. Add your first region to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={groups.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {groups.map((group) => (
                <SortableServiceAreaGroupItem
                  key={group.id}
                  group={group}
                  cityCount={getCityCount(group.id)}
                  onEdit={handleEdit}
                  onDelete={deleteGroup.mutate}
                  onToggleActive={(id, isActive) =>
                    updateGroup.mutate({ id, data: { ...formData, name: group.name, slug: group.slug, description: group.description || '', isActive } })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableServiceAreaGroupItem({
  group,
  cityCount,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  group: ServiceAreaGroup;
  cityCount: number;
  onEdit: (group: ServiceAreaGroup) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const { toast } = useToast();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{group.name}</span>
            <Badge variant={group.isActive ? 'default' : 'secondary'} className="text-xs">
              {group.isActive ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {cityCount} {cityCount === 1 ? 'city' : 'cities'}
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
          onClick={() => onToggleActive(group.id, !group.isActive)}
        >
          {group.isActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(group)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (cityCount > 0) {
              toast({ title: `Cannot delete group with ${cityCount} cities`, description: 'Delete or reassign cities first', variant: 'destructive' });
            } else if (window.confirm('Delete this service area group?')) {
              onDelete(group.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}

// Service Area Cities Manager Component
function ServiceAreaCitiesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cities, setCities] = useState<ServiceAreaCity[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<ServiceAreaCity | null>(null);
  const [filterGroupId, setFilterGroupId] = useState<string>('all');
  const [formData, setFormData] = useState({
    areaGroupId: 0,
    name: '',
    zipcode: '',
    isActive: true,
  });

  const { data: groups } = useQuery<ServiceAreaGroup[]>({
    queryKey: ['/api/service-area-groups'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-groups');
      if (!response.ok) throw new Error('Failed to fetch groups');
      return response.json();
    },
  });

  const { data: fetchedCities, isLoading } = useQuery<ServiceAreaCity[]>({
    queryKey: ['/api/service-area-cities', 'all'],
    queryFn: async () => {
      const response = await fetch('/api/service-area-cities?includeInactive=1');
      if (!response.ok) throw new Error('Failed to fetch cities');
      return response.json();
    },
  });

  useEffect(() => {
    if (fetchedCities) {
      setCities(fetchedCities);
    }
  }, [fetchedCities]);

  const createCity = useMutation({
    mutationFn: async (data: typeof formData & { order: number }) => {
      return apiRequest('POST', '/api/service-area-cities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City created successfully' });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create city', description: error.message, variant: 'destructive' });
    }
  });

  const updateCity = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return apiRequest('PUT', `/api/service-area-cities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
      toast({ title: 'City updated successfully' });
      resetForm();
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

  const reorderCities = useMutation({
    mutationFn: async (updates: { id: number; order: number }[]) => {
      return apiRequest('POST', '/api/service-area-cities/reorder', updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-area-cities', 'all'] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && cities) {
      const oldIndex = cities.findIndex((c) => c.id === active.id);
      const newIndex = cities.findIndex((c) => c.id === over.id);
      const newCities = arrayMove(cities, oldIndex, newIndex);
      setCities(newCities);
      const updates = newCities.map((city, index) => ({ id: city.id, order: index }));
      reorderCities.mutate(updates);
    }
  };

  const resetForm = () => {
    setFormData({ areaGroupId: 0, name: '', zipcode: '', isActive: true });
    setEditingCity(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCity) {
      updateCity.mutate({ id: editingCity.id, data: formData });
    } else {
      createCity.mutate({ ...formData, order: cities.length });
    }
  };

  const handleEdit = (city: ServiceAreaCity) => {
    setEditingCity(city);
    setFormData({
      areaGroupId: city.areaGroupId,
      name: city.name,
      zipcode: city.zipcode || '',
      isActive: city.isActive,
    });
    setIsDialogOpen(true);
  };

  const getGroupName = (groupId: number) => {
    return groups?.find(g => g.id === groupId)?.name || 'Unknown';
  };

  const filteredCities = cities?.filter(city => {
    return filterGroupId === 'all' || city.areaGroupId === Number(filterGroupId);
  });

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <Select value={filterGroupId} onValueChange={setFilterGroupId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {groups?.map(group => (
              <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { resetForm(); setIsDialogOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add City
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCity ? 'Edit City' : 'Add City'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="city-group">Service Area Group *</Label>
                <Select
                  value={formData.areaGroupId ? String(formData.areaGroupId) : ''}
                  onValueChange={(value) => setFormData({ ...formData, areaGroupId: Number(value) })}
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Framingham, Natick"
                  required
                />
              </div>
              <div>
                <Label htmlFor="city-zipcode">Zipcode (Optional)</Label>
                <Input
                  id="city-zipcode"
                  value={formData.zipcode}
                  onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                  placeholder="e.g., 02138"
                  maxLength={5}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="city-isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="city-isActive">Active (visible on website)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit" disabled={!formData.areaGroupId}>
                  {editingCity ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredCities.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          <p>No cities yet. Add your first city to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredCities.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {filteredCities.map((city) => (
                <SortableServiceAreaCityItem
                  key={city.id}
                  city={city}
                  groupName={getGroupName(city.areaGroupId)}
                  onEdit={handleEdit}
                  onDelete={deleteCity.mutate}
                  onToggleActive={(id, isActive) =>
                    updateCity.mutate({ id, data: { ...formData, areaGroupId: city.areaGroupId, name: city.name, zipcode: city.zipcode || '', isActive } })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableServiceAreaCityItem({
  city,
  groupName,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  city: ServiceAreaCity;
  groupName: string;
  onEdit: (city: ServiceAreaCity) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, isActive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: city.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
      <div className="flex items-center gap-3 flex-1">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{city.name}</span>
            <Badge variant={city.isActive ? 'default' : 'secondary'} className="text-xs">
              {city.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="text-xs border-0 bg-secondary">
              {groupName}
            </Badge>
            {city.zipcode && (
              <>
                <span>•</span>
                <span>Zip: {city.zipcode}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => onToggleActive(city.id, !city.isActive)}
        >
          {city.isActive ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(city)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={() => {
            if (window.confirm('Delete this city?')) {
              onDelete(city.id);
            }
          }}
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  );
}


