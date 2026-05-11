import { useEffect, useRef, useState } from 'react';
import type { Category, Service, Subcategory } from '@shared/schema';
import { authenticatedRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Image, Loader2, Pencil } from 'lucide-react';

// ─── Pricing types ────────────────────────────────────────────────────────────

export type PricingType = 'fixed_item' | 'area_based' | 'base_plus_addons' | 'custom_quote';

export interface AreaSizePreset {
  name: string;
  sqft: number | null;
  price: number;
}

export interface ServiceOptionInput {
  id?: number;
  name: string;
  price: string;
  maxQuantity?: number;
  order?: number;
}

export interface ServiceFrequencyInput {
  id?: number;
  name: string;
  discountPercent: string;
  order?: number;
}

export interface ServiceDurationInput {
  id?: number;
  label: string;
  durationHours: number;
  durationMinutesRemainder: number; // minutes portion (0-59)
  price: string;
  order?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceForm({
  service, categories, subcategories, allServices, addonRelationships,
  onSubmit, isLoading, getAccessToken,
}: {
  service: Service | null;
  categories: Category[];
  subcategories: Subcategory[];
  allServices: Service[];
  addonRelationships: { id: number; serviceId: number; addonServiceId: number }[];
  onSubmit: (data: Partial<Service> & { addonIds?: number[]; options?: ServiceOptionInput[]; frequencies?: ServiceFrequencyInput[] }) => void;
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

  const [pricingType, setPricingType] = useState<PricingType>((service as any)?.pricingType || 'fixed_item');
  const [basePrice, setBasePrice] = useState((service as any)?.basePrice || '');
  const [pricePerUnit, setPricePerUnit] = useState((service as any)?.pricePerUnit || '');
  const [minimumPrice, setMinimumPrice] = useState((service as any)?.minimumPrice || '');
  const [areaSizes, setAreaSizes] = useState<AreaSizePreset[]>(() => {
    const sizes = (service as any)?.areaSizes;
    if (Array.isArray(sizes)) return sizes;
    return [{ name: 'Small Room', sqft: 100, price: 80 }];
  });

  const [serviceOptions, setServiceOptions] = useState<ServiceOptionInput[]>([]);
  const [serviceFrequencies, setServiceFrequencies] = useState<ServiceFrequencyInput[]>([]);
  const [serviceDurations, setServiceDurations] = useState<ServiceDurationInput[]>([]);
  const [durationsLoading, setDurationsLoading] = useState(false);

  // Booking Rules
  const [bufferTimeBefore, setBufferTimeBefore] = useState<number>(service?.bufferTimeBefore ?? 0);
  const [bufferTimeAfter, setBufferTimeAfter] = useState<number>(service?.bufferTimeAfter ?? 0);
  const [minimumNoticeHours, setMinimumNoticeHours] = useState<number>(service?.minimumNoticeHours ?? 0);
  const [timeSlotInterval, setTimeSlotInterval] = useState<number | null>(service?.timeSlotInterval ?? null);
  const [showBookingRules, setShowBookingRules] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState<boolean>(service?.requiresConfirmation ?? false);

  // Booking Questions
  const [showBookingQuestions, setShowBookingQuestions] = useState(false);
  const [bookingQuestions, setBookingQuestions] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState<{
    label: string; type: string; options: string; required: boolean; order: number;
  } | null>(null);

  useEffect(() => {
    if (service?.id && pricingType === 'base_plus_addons') {
      fetch(`/api/services/${service.id}/options`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServiceOptions(data.map((o: any) => ({ id: o.id, name: o.name, price: o.price, maxQuantity: o.maxQuantity, order: o.order })));
          }
        })
        .catch(console.error);

      fetch(`/api/services/${service.id}/frequencies`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServiceFrequencies(data.map((f: any) => ({ id: f.id, name: f.name, discountPercent: f.discountPercent, order: f.order })));
          }
        })
        .catch(console.error);
    }
  }, [service?.id, pricingType]);

  useEffect(() => {
    if (!service?.id) return;
    fetch(`/api/services/${service.id}/questions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBookingQuestions(data); })
      .catch(() => {});
  }, [service?.id]);

  useEffect(() => {
    if (!service?.id) return;
    setDurationsLoading(true);
    fetch(`/api/services/${service.id}/durations`)
      .then(res => res.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setServiceDurations(data.map(d => ({
            id: d.id,
            label: d.label,
            durationHours: Math.floor(d.durationMinutes / 60),
            durationMinutesRemainder: d.durationMinutes % 60,
            price: d.price,
            order: d.order,
          })));
        }
      })
      .catch(console.error)
      .finally(() => setDurationsLoading(false));
  }, [service?.id]);

  const filteredSubcategories = subcategories.filter(sub => sub.categoryId === Number(categoryId));
  const availableAddons = allServices.filter(s => s.id !== service?.id && s.name.toLowerCase().includes(addonSearch.toLowerCase()));

  const handleAddonToggle = (addonId: number) => {
    setSelectedAddons(prev => prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const token = await getAccessToken();
      if (!token) { console.error('Authentication required'); return; }
      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
      const uploadFetchRes = await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!uploadFetchRes.ok) throw new Error('Upload to storage failed');
      setImageUrl(objectPath);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleAddDuration = () => {
    if (!service?.id) return;
    const newRow: ServiceDurationInput = { label: '', durationHours: 2, durationMinutesRemainder: 0, price: '0.00' };
    setServiceDurations(prev => [...prev, newRow]);
  };

  const handleSaveDuration = async (index: number) => {
    if (!service?.id) return;
    const d = serviceDurations[index];
    const durationMinutes = d.durationHours * 60 + d.durationMinutesRemainder;
    const body = { label: d.label, durationMinutes, price: d.price, order: index };
    try {
      const token = await getAccessToken();
      if (!token) return;
      if (d.id) {
        // PATCH existing
        const res = await fetch(`/api/services/${service.id}/durations/${d.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const updated = await res.json();
        setServiceDurations(prev => prev.map((row, i) => i === index ? { ...row, id: updated.id } : row));
      } else {
        // POST new
        const res = await fetch(`/api/services/${service.id}/durations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const created = await res.json();
        setServiceDurations(prev => prev.map((row, i) => i === index ? { ...row, id: created.id } : row));
      }
    } catch (err) {
      console.error('Failed to save duration', err);
    }
  };

  const handleDeleteDuration = async (index: number) => {
    const d = serviceDurations[index];
    if (d.id && service?.id) {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await fetch(`/api/services/${service.id}/durations/${d.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Failed to delete duration', err);
      }
    }
    setServiceDurations(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: Partial<Service> & { addonIds?: number[]; options?: ServiceOptionInput[]; frequencies?: ServiceFrequencyInput[] } = {
      name, description, price: String(price),
      durationMinutes: (durationHours * 60) + durationMinutes,
      categoryId: Number(categoryId), imageUrl, isHidden, addonIds: selectedAddons, pricingType,
      bufferTimeBefore, bufferTimeAfter, minimumNoticeHours, timeSlotInterval,
      requiresConfirmation,
    } as any;

    if (subcategoryId) data.subcategoryId = Number(subcategoryId);

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
              {categories.map(cat => <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>)}
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
                {filteredSubcategories.map(sub => <SelectItem key={sub.id} value={String(sub.id)}>{sub.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-service-description" />
        </div>

        <div className="space-y-2">
          <Label>Pricing Type</Label>
          <Select value={pricingType} onValueChange={(val) => setPricingType(val as PricingType)}>
            <SelectTrigger><SelectValue placeholder="Select pricing type" /></SelectTrigger>
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

        {pricingType === 'fixed_item' && (
          <div className="space-y-2">
            <Label htmlFor="price">Price (USD)</Label>
            <Input id="price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required data-testid="input-service-price" />
          </div>
        )}

        {pricingType === 'area_based' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Area-Based Pricing</h4>
            <div className="space-y-2">
              <Label>Size Presets</Label>
              {areaSizes.map((size, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input placeholder="Name (e.g., Small Room)" value={size.name} onChange={(e) => { const u = [...areaSizes]; u[index].name = e.target.value; setAreaSizes(u); }} className="flex-1" />
                  <Input placeholder="Sqft" type="number" value={size.sqft || ''} onChange={(e) => { const u = [...areaSizes]; u[index].sqft = e.target.value ? Number(e.target.value) : null; setAreaSizes(u); }} className="w-20" />
                  <Input placeholder="Price" type="number" step="0.01" value={size.price} onChange={(e) => { const u = [...areaSizes]; u[index].price = Number(e.target.value); setAreaSizes(u); }} className="w-24" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAreaSizes(areaSizes.filter((_, i) => i !== index))}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setAreaSizes([...areaSizes, { name: '', sqft: null, price: 0 }])}>+ Add Size Option</Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price per Sqft (for custom size)</Label>
                <Input type="number" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} placeholder="0.75" />
              </div>
              <div className="space-y-2">
                <Label>Minimum Price</Label>
                <Input type="number" step="0.01" value={minimumPrice} onChange={(e) => setMinimumPrice(e.target.value)} placeholder="50.00" />
              </div>
            </div>
            <input type="hidden" value={areaSizes[0]?.price || minimumPrice || '0'} />
          </div>
        )}

        {pricingType === 'base_plus_addons' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Base + Add-ons Pricing</h4>
            <div className="space-y-2">
              <Label>Base Price (USD)</Label>
              <Input type="number" step="0.01" value={basePrice} onChange={(e) => { setBasePrice(e.target.value); setPrice(e.target.value); }} placeholder="120.00" required />
            </div>
            <div className="space-y-2">
              <Label>Add-on Options</Label>
              <p className="text-xs text-muted-foreground">Additional services customer can add (e.g., Extra Bedroom +$20)</p>
              {serviceOptions.map((opt, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input placeholder="Option name" value={opt.name} onChange={(e) => { const u = [...serviceOptions]; u[index].name = e.target.value; setServiceOptions(u); }} className="flex-1" />
                  <Input placeholder="Price" type="number" step="0.01" value={opt.price} onChange={(e) => { const u = [...serviceOptions]; u[index].price = e.target.value; setServiceOptions(u); }} className="w-24" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setServiceOptions(serviceOptions.filter((_, i) => i !== index))}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setServiceOptions([...serviceOptions, { name: '', price: '' }])}>+ Add Option</Button>
            </div>
            <div className="space-y-2">
              <Label>Frequency Options</Label>
              <p className="text-xs text-muted-foreground">Recurring service discounts (e.g., Weekly -15%)</p>
              {serviceFrequencies.map((freq, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input placeholder="Frequency name" value={freq.name} onChange={(e) => { const u = [...serviceFrequencies]; u[index].name = e.target.value; setServiceFrequencies(u); }} className="flex-1" />
                  <Input placeholder="Discount %" type="number" step="0.01" value={freq.discountPercent} onChange={(e) => { const u = [...serviceFrequencies]; u[index].discountPercent = e.target.value; setServiceFrequencies(u); }} className="w-24" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setServiceFrequencies(serviceFrequencies.filter((_, i) => i !== index))}>✕</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setServiceFrequencies([...serviceFrequencies, { name: '', discountPercent: '0' }])}>+ Add Frequency</Button>
            </div>
          </div>
        )}

        {pricingType === 'custom_quote' && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-semibold text-sm">Custom Quote Pricing</h4>
            <p className="text-xs text-muted-foreground">Customer will describe their needs and your team will contact them with a quote. A minimum charge applies to the booking.</p>
            <div className="space-y-2">
              <Label>Minimum Price (USD)</Label>
              <Input type="number" step="0.01" value={minimumPrice} onChange={(e) => { setMinimumPrice(e.target.value); setPrice(e.target.value); }} placeholder="150.00" required />
            </div>
          </div>
        )}

        {pricingType !== 'fixed_item' && (
          <input type="hidden" name="price" value={
            pricingType === 'area_based' ? (areaSizes[0]?.price || minimumPrice || '0') :
              pricingType === 'base_plus_addons' ? (basePrice || '0') : (minimumPrice || '0')
          } />
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="durationHours">Duration (Hours)</Label>
            <Input id="durationHours" type="number" min="0" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} data-testid="input-service-hours" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationMinutes">Duration (Minutes)</Label>
            <Input id="durationMinutes" type="number" min="0" max="59" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} data-testid="input-service-minutes" />
          </div>
        </div>

        {/* Booking Rules section */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowBookingRules(v => !v)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span className="text-xs text-muted-foreground">{showBookingRules ? '▲' : '▼'}</span>
            Booking Rules
            {(bufferTimeBefore > 0 || bufferTimeAfter > 0 || minimumNoticeHours > 0 || timeSlotInterval !== null) && (
              <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">configured</span>
            )}
          </button>
          {showBookingRules && (
            <div className="mt-3 space-y-4 p-4 border rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Controls how this service blocks calendar time and when customers can book.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bufferTimeBefore">Buffer Before (min)</Label>
                  <Input
                    id="bufferTimeBefore"
                    type="number"
                    min="0"
                    step="5"
                    value={bufferTimeBefore}
                    onChange={(e) => setBufferTimeBefore(Number(e.target.value))}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground">Prep time before service starts</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bufferTimeAfter">Buffer After (min)</Label>
                  <Input
                    id="bufferTimeAfter"
                    type="number"
                    min="0"
                    step="5"
                    value={bufferTimeAfter}
                    onChange={(e) => setBufferTimeAfter(Number(e.target.value))}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground">Travel time to next client</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minimumNoticeHours">Minimum Notice (hours)</Label>
                  <Input
                    id="minimumNoticeHours"
                    type="number"
                    min="0"
                    step="1"
                    value={minimumNoticeHours}
                    onChange={(e) => setMinimumNoticeHours(Number(e.target.value))}
                    placeholder="0"
                  />
                  <p className="text-[11px] text-muted-foreground">Hours ahead required for booking</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeSlotInterval">Slot Interval (min)</Label>
                  <Input
                    id="timeSlotInterval"
                    type="number"
                    min="5"
                    step="5"
                    value={timeSlotInterval ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTimeSlotInterval(val === '' ? null : Number(val));
                    }}
                    placeholder="Leave blank to use duration"
                  />
                  <p className="text-[11px] text-muted-foreground">Blank = use service duration as step</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="requires-confirmation"
                  checked={requiresConfirmation}
                  onCheckedChange={(checked) => setRequiresConfirmation(checked === true)}
                  data-testid="checkbox-requires-confirmation"
                />
                <Label htmlFor="requires-confirmation" className="text-sm font-normal cursor-pointer">
                  Requires manual confirmation
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                When enabled, bookings for this service start with "awaiting approval" status and must be manually approved by an admin.
              </p>
            </div>
          )}
        </div>

        {service?.id && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowBookingQuestions(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <span className="text-xs text-muted-foreground">{showBookingQuestions ? '▲' : '▼'}</span>
              Booking Questions
              {bookingQuestions.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
                  {bookingQuestions.length}
                </span>
              )}
            </button>

            {showBookingQuestions && (
              <div className="mt-3 space-y-4 rounded-lg border border-gray-200 bg-muted/30 p-4">

                {/* Existing questions list */}
                {bookingQuestions.map((q) => (
                  <div key={q.id} className="flex flex-col gap-2 rounded-md border border-gray-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <input
                          className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Question label"
                          value={q.label}
                          onChange={e => setBookingQuestions(prev =>
                            prev.map(x => x.id === q.id ? { ...x, label: e.target.value } : x)
                          )}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={q.type}
                            onChange={e => setBookingQuestions(prev =>
                              prev.map(x => x.id === q.id ? { ...x, type: e.target.value } : x)
                            )}
                          >
                            <option value="text">Short Answer</option>
                            <option value="textarea">Long Answer</option>
                            <option value="select">Multiple Choice</option>
                          </select>
                          <label className="flex items-center gap-1 text-sm text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.required}
                              onChange={e => setBookingQuestions(prev =>
                                prev.map(x => x.id === q.id ? { ...x, required: e.target.checked } : x)
                              )}
                            />
                            Required
                          </label>
                          <input
                            type="number"
                            className="w-16 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Order"
                            value={q.order}
                            onChange={e => setBookingQuestions(prev =>
                              prev.map(x => x.id === q.id ? { ...x, order: Number(e.target.value) } : x)
                            )}
                          />
                        </div>
                        {q.type === 'select' && (
                          <input
                            className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Options (comma-separated): Cat, Dog, None"
                            value={Array.isArray(q.options) ? q.options.join(', ') : (q.options ?? '')}
                            onChange={e => setBookingQuestions(prev =>
                              prev.map(x => x.id === q.id ? { ...x, options: e.target.value } : x)
                            )}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-destructive hover:text-destructive/80 text-sm shrink-0"
                        onClick={async () => {
                          await fetch(`/api/services/${service.id}/questions/${q.id}`, { method: 'DELETE' });
                          setBookingQuestions(prev => prev.filter(x => x.id !== q.id));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <button
                      type="button"
                      className="self-end rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90"
                      onClick={async () => {
                        const body = {
                          label: q.label,
                          type: q.type,
                          required: q.required,
                          order: q.order,
                          options: q.type === 'select'
                            ? (typeof q.options === 'string'
                                ? q.options.split(',').map((s: string) => s.trim()).filter(Boolean)
                                : q.options)
                            : null,
                        };
                        await fetch(`/api/services/${service.id}/questions/${q.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(body),
                        });
                      }}
                    >
                      Save
                    </button>
                  </div>
                ))}

                {/* New question form */}
                {newQuestion !== null && (
                  <div className="rounded-md border border-dashed border-gray-300 bg-white p-3 space-y-2">
                    <input
                      className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Question label *"
                      value={newQuestion.label}
                      onChange={e => setNewQuestion(q => q && { ...q, label: e.target.value })}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={newQuestion.type}
                        onChange={e => setNewQuestion(q => q && { ...q, type: e.target.value })}
                      >
                        <option value="text">Short Answer</option>
                        <option value="textarea">Long Answer</option>
                        <option value="select">Multiple Choice</option>
                      </select>
                      <label className="flex items-center gap-1 text-sm text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newQuestion.required}
                          onChange={e => setNewQuestion(q => q && { ...q, required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                    {newQuestion.type === 'select' && (
                      <input
                        className="w-full rounded border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Options (comma-separated): Cat, Dog, None"
                        value={newQuestion.options}
                        onChange={e => setNewQuestion(q => q && { ...q, options: e.target.value })}
                      />
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90"
                        onClick={async () => {
                          if (!newQuestion.label.trim()) return;
                          const body = {
                            label: newQuestion.label.trim(),
                            type: newQuestion.type,
                            required: newQuestion.required,
                            order: newQuestion.order,
                            options: newQuestion.type === 'select'
                              ? newQuestion.options.split(',').map(s => s.trim()).filter(Boolean)
                              : null,
                          };
                          const res = await fetch(`/api/services/${service.id}/questions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                          });
                          const created = await res.json();
                          setBookingQuestions(prev => [...prev, created]);
                          setNewQuestion(null);
                        }}
                      >
                        Save Question
                      </button>
                      <button
                        type="button"
                        className="rounded border border-gray-200 px-3 py-1 text-xs text-slate-600 hover:bg-gray-50"
                        onClick={() => setNewQuestion(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Add Question button */}
                {newQuestion === null && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:text-primary/80 underline"
                    onClick={() => setNewQuestion({ label: '', type: 'text', options: '', required: false, order: bookingQuestions.length })}
                  >
                    + Add Question
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {service?.id && (
          <div className="space-y-2 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Available Durations</Label>
              <Button type="button" size="sm" variant="outline" onClick={handleAddDuration}>
                + Add Duration
              </Button>
            </div>
            {durationsLoading && <p className="text-xs text-slate-400">Loading...</p>}
            {serviceDurations.length === 0 && !durationsLoading && (
              <p className="text-xs text-slate-400">
                No durations configured. The booking flow will use the default duration above.
              </p>
            )}
            {serviceDurations.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={d.label}
                    onChange={e => setServiceDurations(prev => prev.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))}
                    placeholder="e.g. 2 hours — Small apartment"
                    className="text-xs h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hours</Label>
                  <Input
                    type="number" min={0} max={24}
                    value={d.durationHours}
                    onChange={e => setServiceDurations(prev => prev.map((r, idx) => idx === i ? { ...r, durationHours: Number(e.target.value) } : r))}
                    className="text-xs h-8 w-16"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number" min={0} max={59}
                    value={d.durationMinutesRemainder}
                    onChange={e => setServiceDurations(prev => prev.map((r, idx) => idx === i ? { ...r, durationMinutesRemainder: Number(e.target.value) } : r))}
                    className="text-xs h-8 w-16"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price $</Label>
                  <Input
                    type="number" min={0} step={0.01}
                    value={d.price}
                    onChange={e => setServiceDurations(prev => prev.map((r, idx) => idx === i ? { ...r, price: e.target.value } : r))}
                    className="text-xs h-8 w-20"
                  />
                </div>
                <div className="flex gap-1 self-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => handleSaveDuration(i)} className="text-xs h-8 px-2">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteDuration(i)} className="text-xs h-8 px-2 text-red-500 hover:text-red-700">Del</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label>Service Image</Label>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} data-testid="input-service-image-upload" />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-dashed border-border cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-center group"
          >
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="Service preview" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white flex flex-col items-center gap-2">
                    <Pencil className="h-8 w-8" />
                    <span className="text-sm font-medium">Change Image</span>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">4:3 Preview</div>
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
          <Checkbox id="isHidden" checked={isHidden} onCheckedChange={(checked) => setIsHidden(!!checked)} data-testid="checkbox-service-hidden" />
          <Label htmlFor="isHidden" className="text-sm font-normal cursor-pointer">
            Hide from main services list (Service will only show as add-on)
          </Label>
        </div>

        {service && allServices.length > 1 && (
          <div className="space-y-2 pt-2">
            <Label>Suggested Add-ons</Label>
            <p className="text-xs text-muted-foreground">Choose which services to suggest when this is added</p>
            <div className="space-y-2 border rounded-md p-3 bg-muted">
              <Input placeholder="Search services..." value={addonSearch} onChange={(e) => setAddonSearch(e.target.value)} className="h-8 text-sm mb-2" />
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {availableAddons.length > 0 ? (
                  availableAddons.map(addon => (
                    <div key={addon.id} className="flex items-center space-x-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded px-1 transition-colors">
                      <Checkbox id={`addon-${addon.id}`} checked={selectedAddons.includes(addon.id)} onCheckedChange={() => handleAddonToggle(addon.id)} data-testid={`checkbox-addon-${addon.id}`} />
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
                      <Badge key={id} variant="secondary" className="text-[10px] py-0 h-5 border-0 bg-primary/10 text-primary dark:bg-primary/20">
                        {s.name}
                        <button onClick={(e) => { e.preventDefault(); handleAddonToggle(id); }} className="ml-1 hover:text-primary/70">x</button>
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
