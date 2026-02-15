import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HomepageContent } from '@shared/schema';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { CompanySettingsData } from '@/components/admin/shared/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  BadgeCheck,
  Check,
  Clock,
  FileText,
  FolderOpen,
  Heart,
  Image,
  Loader2,
  MapPin,
  Plus,
  Shield,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  Trophy,
} from 'lucide-react';
export function HeroSettingsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });
  const heroMenuTitle = 'Hero Section';

  const HERO_DEFAULTS = {
    title: '',
    subtitle: '',
    ctaText: '',
    image: '',
  };

  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});
  const SavedIndicator = ({ field }: { field: string }) => (
    savedFields[field] ? (
      <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" />
    ) : null
  );

  useEffect(() => {
    if (settings) {
      setHeroTitle(settings.heroTitle || HERO_DEFAULTS.title);
      setHeroSubtitle(settings.heroSubtitle || HERO_DEFAULTS.subtitle);
      setHeroImageUrl(settings.heroImageUrl || HERO_DEFAULTS.image);
      setCtaText(settings.ctaText || HERO_DEFAULTS.ctaText);
      setHomepageContent({
        ...DEFAULT_HOMEPAGE_CONTENT,
        ...(settings.homepageContent || {}),
        trustBadges: settings.homepageContent?.trustBadges?.length
          ? settings.homepageContent.trustBadges
          : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
        categoriesSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
          ...(settings.homepageContent?.categoriesSection || {}),
        },
        reviewsSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
          ...(settings.homepageContent?.reviewsSection || {}),
        },
        blogSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
          ...(settings.homepageContent?.blogSection || {}),
        },
        areasServedSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
          ...(settings.homepageContent?.areasServedSection || {}),
        },
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!isLoading && !settings) {
      setHeroTitle('');
      setHeroSubtitle('');
      setHeroImageUrl('');
      setCtaText('');
      setHomepageContent(DEFAULT_HOMEPAGE_CONTENT);
    }
  }, [isLoading, settings]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const trustBadges = homepageContent.trustBadges || [];
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
  const categoriesSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(homepageContent.categoriesSection || {}),
  };
  const reviewsSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
    ...(homepageContent.reviewsSection || {}),
  };
  const blogSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
    ...(homepageContent.blogSection || {}),
  };
  const areasServedSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };

  const markFieldsSaved = useCallback((fields: string[]) => {
    fields.forEach(field => {
      setSavedFields(prev => ({ ...prev, [field]: true }));
      if (savedFieldTimers.current[field]) {
        clearTimeout(savedFieldTimers.current[field]);
      }
      savedFieldTimers.current[field] = setTimeout(() => {
        setSavedFields(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }, 3000);
    });
  }, []);

  const saveHeroSettings = useCallback(async (updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Save failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      await authenticatedRequest('PUT', '/api/company-settings', token, updates);
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      const keysToMark = fieldKeys && fieldKeys.length > 0 ? fieldKeys : Object.keys(updates);
      if (keysToMark.length > 0) {
        markFieldsSaved(keysToMark);
      }
    } catch (error: any) {
      toast({
        title: 'Error saving hero settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken]);

  const triggerAutoSave = useCallback((updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveHeroSettings(updates, fieldKeys);
    }, 800);
  }, [saveHeroSettings]);

  const updateHomepageContent = useCallback((updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => {
    setHomepageContent(prev => {
      const updated = updater(prev);
      triggerAutoSave({ homepageContent: updated }, fieldKey ? [fieldKey] : ['homepageContent']);
      return updated;
    });
  }, [triggerAutoSave]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      console.log('Token retrieved:', token ? 'Present' : 'Missing');
      if (!token) {
        toast({ title: 'Upload failed', description: 'Authentication required', variant: 'destructive' });
        return;
      }

      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      setHeroImageUrl(objectPath);
      await saveHeroSettings({ heroImageUrl: objectPath }, ['heroImageUrl']);
      toast({ title: 'Hero image uploaded and saved' });
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
          <h1 className="text-2xl font-bold">{heroMenuTitle}</h1>
          <p className="text-muted-foreground">Customize hero and homepage content</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-muted p-6 rounded-lg transition-all space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Hero Section
          </h2>
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
        </div>

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

        <div className="border-t border-border pt-6 space-y-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" />
            Hero Badge
          </h3>
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
                        setHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: objectPath }));
                        triggerAutoSave({ homepageContent: { ...(homepageContent || {}), heroBadgeImageUrl: objectPath } }, ['homepageContent.heroBadgeImageUrl']);
                        toast({ title: 'Badge uploaded and saved' });
                      } catch (error: any) {
                        toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                      } finally {
                        if (e.target) {
                          e.target.value = '';
                        }
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
        </div>
      </div>

      <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" />
            Trust Badges
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                trustBadges: [...(prev.trustBadges || []), { title: 'New Badge', description: '' }],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Add badge
          </Button>
        </div>
        <div className="space-y-4">
          {trustBadges.map((badge, index) => (
            <div
              key={index}
              className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] items-start bg-card p-3 rounded-lg border border-border"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <div className="relative">
                  <Input
                    value={badge.title}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          title: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.title`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.title`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="relative">
                  <Input
                    value={badge.description}
                    onChange={(e) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = {
                          ...(updatedBadges[index] || { title: '', description: '' }),
                          description: e.target.value,
                        };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.description`)
                    }
                  />
                  <SavedIndicator field={`homepageContent.trustBadges.${index}.description`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={badge.icon || badgeIconOptions[index % badgeIconOptions.length].value}
                  onValueChange={(value) =>
                    updateHomepageContent(prev => {
                      const updatedBadges = [...(prev.trustBadges || [])];
                      updatedBadges[index] = {
                        ...(updatedBadges[index] || { title: '', description: '' }),
                        icon: value,
                      };
                      return { ...prev, trustBadges: updatedBadges };
                    }, `homepageContent.trustBadges.${index}.icon`)
                  }
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
              <div className="flex justify-end items-start pt-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    updateHomepageContent(prev => {
                      const updatedBadges = (prev.trustBadges || []).filter((_, i) => i !== index);
                      return { ...prev, trustBadges: updatedBadges };
                    })
                  }
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          {trustBadges.length === 0 && (
            <p className="text-sm text-muted-foreground">No badges added yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Categories Section
          </h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={categoriesSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.title')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={categoriesSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.categoriesSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={categoriesSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    categoriesSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
                      ...(prev.categoriesSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.categoriesSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.categoriesSection.ctaText" />
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" />
            Reviews Section
          </h2>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={reviewsSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.title')
                }
              />
              <SavedIndicator field="homepageContent.reviewsSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={reviewsSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.reviewsSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Review Widget Embed URL</Label>
            <div className="relative">
              <Input
                value={reviewsSection.embedUrl || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    reviewsSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
                      ...(prev.reviewsSection || {}),
                      embedUrl: e.target.value,
                    },
                  }), 'homepageContent.reviewsSection.embedUrl')
                }
                placeholder="https://..."
              />
              <SavedIndicator field="homepageContent.reviewsSection.embedUrl" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Blog Section
          </h2>
          <div className="space-y-2">
            <Label>Title</Label>
            <div className="relative">
              <Input
                value={blogSection.title || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      title: e.target.value,
                    },
                  }), 'homepageContent.blogSection.title')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.title" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Textarea
                value={blogSection.subtitle || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      subtitle: e.target.value,
                    },
                  }), 'homepageContent.blogSection.subtitle')
                }
                className="min-h-[100px]"
              />
              <SavedIndicator field="homepageContent.blogSection.subtitle" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>View All Text</Label>
            <div className="relative">
              <Input
                value={blogSection.viewAllText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      viewAllText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.viewAllText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.viewAllText" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Card CTA Text</Label>
            <div className="relative">
              <Input
                value={blogSection.readMoreText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    blogSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
                      ...(prev.blogSection || {}),
                      readMoreText: e.target.value,
                    },
                  }), 'homepageContent.blogSection.readMoreText')
                }
              />
              <SavedIndicator field="homepageContent.blogSection.readMoreText" />
            </div>
          </div>
        </div>

        <div className="bg-muted p-6 rounded-lg transition-all space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Areas Served Section
          </h2>
          <div className="space-y-2">
            <Label>Label</Label>
            <div className="relative">
              <Input
                value={areasServedSection.label || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      label: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.label')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.label" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input
                value={areasServedSection.heading || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      heading: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.heading')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.heading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <div className="relative">
              <Textarea
                value={areasServedSection.description || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      description: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.description')
                }
                className="min-h-[120px]"
              />
              <SavedIndicator field="homepageContent.areasServedSection.description" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>CTA Text</Label>
            <div className="relative">
              <Input
                value={areasServedSection.ctaText || ''}
                onChange={(e) =>
                  updateHomepageContent(prev => ({
                    ...prev,
                    areasServedSection: {
                      ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
                      ...(prev.areasServedSection || {}),
                      ctaText: e.target.value,
                    },
                  }), 'homepageContent.areasServedSection.ctaText')
                }
              />
              <SavedIndicator field="homepageContent.areasServedSection.ctaText" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


