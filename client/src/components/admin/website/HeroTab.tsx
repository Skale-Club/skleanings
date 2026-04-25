import { Check, BadgeCheck, Image, Loader2, Plus, Star, Shield, Clock, Sparkles, Heart, ThumbsUp, Trophy, Megaphone } from 'lucide-react';
import { SettingsCard } from '@/components/admin/shared/SettingsCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { authenticatedRequest } from '@/lib/queryClient';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { WebsiteTabProps } from './types';

const badgeIconOptions = [
  { label: 'Star', value: 'star', icon: Star },
  { label: 'Shield', value: 'shield', icon: Shield },
  { label: 'Clock', value: 'clock', icon: Clock },
  { label: 'Sparkles', value: 'sparkles', icon: Sparkles },
  { label: 'Heart', value: 'heart', icon: Heart },
  { label: 'Badge Check', value: 'badgeCheck', icon: BadgeCheck },
  { label: 'Thumbs Up', value: 'thumbsUp', icon: ThumbsUp },
  { label: 'Trophy', value: 'trophy', icon: Trophy },
];

export function HeroTab({
  heroTitle, setHeroTitle,
  heroSubtitle, setHeroSubtitle,
  heroImageUrl, setHeroImageUrl,
  ctaText, setCtaText,
  homepageContent,
  savedFields,
  saveHeroSettings,
  triggerAutoSave,
  updateHomepageContent,
  getAccessToken,
}: WebsiteTabProps) {
  const { toast } = useToast();

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }
      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
      await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      setHeroImageUrl(objectPath);
      await saveHeroSettings({ heroImageUrl: objectPath }, ['heroImageUrl']);
      toast({ title: 'Hero image uploaded and saved' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard icon={Megaphone} title="Hero Content">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="heroTitle">Hero Title</Label>
            <div className="relative">
              <Input
                id="heroTitle"
                value={heroTitle}
                onChange={(e) => {
                  setHeroTitle(e.target.value);
                  triggerAutoSave({ heroTitle: e.target.value }, ['heroTitle']);
                }}
                placeholder="Enter hero title"
                data-testid="input-hero-title"
              />
              <SavedIndicator field="heroTitle" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
            <div className="relative">
              <Textarea
                id="heroSubtitle"
                value={heroSubtitle}
                onChange={(e) => {
                  setHeroSubtitle(e.target.value);
                  triggerAutoSave({ heroSubtitle: e.target.value }, ['heroSubtitle']);
                }}
                placeholder="Enter hero subtitle"
                data-testid="input-hero-subtitle"
                className="min-h-[120px]"
              />
              <SavedIndicator field="heroSubtitle" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ctaText">Call to Action Button Text</Label>
            <div className="relative">
              <Input
                id="ctaText"
                value={ctaText}
                onChange={(e) => {
                  setCtaText(e.target.value);
                  triggerAutoSave({ ctaText: e.target.value }, ['ctaText']);
                }}
                placeholder="Book Now"
                data-testid="input-cta-text"
              />
              <SavedIndicator field="ctaText" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="heroImage">Hero Image</Label>
            <div className="flex flex-col gap-3">
              <div className="aspect-[4/3] w-full max-w-xs rounded-lg border-2 border-dashed border-border bg-card flex items-center justify-center overflow-hidden relative group">
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="Hero preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <Image className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Background Image</p>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                  <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                  <Plus className="w-8 h-8 text-white" />
                </label>
              </div>
              <div className="flex gap-2 max-w-xs">
                <div className="relative w-full">
                  <Input
                    value={heroImageUrl}
                    onChange={(e) => {
                      setHeroImageUrl(e.target.value);
                      triggerAutoSave({ heroImageUrl: e.target.value }, ['heroImageUrl']);
                    }}
                    placeholder="Or enter image URL (https://...)"
                    data-testid="input-hero-image"
                  />
                  <SavedIndicator field="heroImageUrl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      </SettingsCard>

      <SettingsCard icon={BadgeCheck} title="Hero Badge">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Badge Image URL</Label>
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Input
                  value={homepageContent.heroBadgeImageUrl || ''}
                  onChange={(e) =>
                    updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: e.target.value }), 'homepageContent.heroBadgeImageUrl')
                  }
                  placeholder="https://..."
                />
                <SavedIndicator field="homepageContent.heroBadgeImageUrl" />
              </div>
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const token = await getAccessToken();
                      if (!token) {
                        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
                        return;
                      }
                      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
                      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
                      await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
                      updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: objectPath }), 'homepageContent.heroBadgeImageUrl');
                      toast({ title: 'Badge uploaded and saved' });
                    } catch (error: any) {
                      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                    } finally {
                      if (e.target) e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Badge Alt Text</Label>
            <div className="relative">
              <Input
                value={homepageContent.heroBadgeAlt || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({ ...prev, heroBadgeAlt: e.target.value }), 'homepageContent.heroBadgeAlt')
                }
                placeholder="Trusted Experts"
              />
              <SavedIndicator field="homepageContent.heroBadgeAlt" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Badge Icon</Label>
            <Select
              value={homepageContent.trustBadges?.[0]?.icon || 'star'}
              onValueChange={(value) => {
                updateHomepageContent(prev => {
                  const badges = [...(prev.trustBadges || DEFAULT_HOMEPAGE_CONTENT.trustBadges || [])];
                  badges[0] = { ...(badges[0] || {}), icon: value };
                  return { ...prev, trustBadges: badges };
                }, 'homepageContent.trustBadges.0.icon');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {badgeIconOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
