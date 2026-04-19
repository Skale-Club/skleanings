import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HomepageContent } from '@shared/schema';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { CompanySettingsData } from '@/components/admin/shared/types';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeroTab } from './website/HeroTab';
import { TrustBadgesTab } from './website/TrustBadgesTab';
import { CategoriesTab } from './website/CategoriesTab';
import { ReviewsTab } from './website/ReviewsTab';
import { BlogTab } from './website/BlogTab';
import { AreasServedTab } from './website/AreasServedTab';
import { FooterTab } from './website/FooterTab';
import { PagesTab } from './website/PagesTab';
import { ColorsTab } from './website/ColorsTab';
import type { WebsiteTabProps } from './website/types';
import { useHashTab } from '@/hooks/use-hash-tab';

const WEBSITE_TABS = ['hero', 'badges', 'categories', 'reviews', 'blog', 'areas', 'footer', 'pages', 'colors'] as const;

export function HeroSettingsSection({ getAccessToken }: { getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });

  const [activeTab, setActiveTab] = useHashTab('hero', WEBSITE_TABS);
  const [heroTitle, setHeroTitle] = useState('');
  const [heroSubtitle, setHeroSubtitle] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(DEFAULT_HOMEPAGE_CONTENT);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFieldTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settings) {
      setHeroTitle(settings.heroTitle || '');
      setHeroSubtitle(settings.heroSubtitle || '');
      setHeroImageUrl(settings.heroImageUrl || '');
      setCtaText(settings.ctaText || '');
      setHomepageContent({
        ...DEFAULT_HOMEPAGE_CONTENT,
        ...(settings.homepageContent || {}),
        trustBadges: settings.homepageContent?.trustBadges?.length
          ? settings.homepageContent.trustBadges
          : DEFAULT_HOMEPAGE_CONTENT.trustBadges,
        categoriesSection: { ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection, ...(settings.homepageContent?.categoriesSection || {}) },
        reviewsSection: { ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection, ...(settings.homepageContent?.reviewsSection || {}) },
        blogSection: { ...DEFAULT_HOMEPAGE_CONTENT.blogSection, ...(settings.homepageContent?.blogSection || {}) },
        areasServedSection: { ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection, ...(settings.homepageContent?.areasServedSection || {}) },
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
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      Object.values(savedFieldTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const markFieldsSaved = useCallback((fields: string[]) => {
    fields.forEach(field => {
      setSavedFields(prev => ({ ...prev, [field]: true }));
      if (savedFieldTimers.current[field]) clearTimeout(savedFieldTimers.current[field]);
      savedFieldTimers.current[field] = setTimeout(() => {
        setSavedFields(prev => { const next = { ...prev }; delete next[field]; return next; });
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
      if (keysToMark.length > 0) markFieldsSaved(keysToMark);
    } catch (error: any) {
      toast({ title: 'Error saving hero settings', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [toast, getAccessToken, markFieldsSaved]);

  const triggerAutoSave = useCallback((updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tabProps: WebsiteTabProps = {
    heroTitle, setHeroTitle,
    heroSubtitle, setHeroSubtitle,
    heroImageUrl, setHeroImageUrl,
    ctaText, setCtaText,
    homepageContent, setHomepageContent,
    savedFields, isSaving,
    saveHeroSettings, triggerAutoSave, markFieldsSaved,
    updateHomepageContent,
    getAccessToken,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold font-outfit">Website</h2>
          <p className="text-muted-foreground text-sm mt-1">Customize your homepage content</p>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="badges">Trust Badges</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="areas">Areas Served</TabsTrigger>
          <TabsTrigger value="footer">Footer</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
        </TabsList>
        <TabsContent value="hero" className="mt-6"><HeroTab {...tabProps} /></TabsContent>
        <TabsContent value="badges" className="mt-6"><TrustBadgesTab {...tabProps} /></TabsContent>
        <TabsContent value="categories" className="mt-6"><CategoriesTab {...tabProps} /></TabsContent>
        <TabsContent value="reviews" className="mt-6"><ReviewsTab {...tabProps} /></TabsContent>
        <TabsContent value="blog" className="mt-6"><BlogTab {...tabProps} /></TabsContent>
        <TabsContent value="areas" className="mt-6"><AreasServedTab {...tabProps} /></TabsContent>
        <TabsContent value="footer" className="mt-6"><FooterTab {...tabProps} /></TabsContent>
        <TabsContent value="pages" className="mt-6"><PagesTab {...tabProps} /></TabsContent>
        <TabsContent value="colors" className="mt-6"><ColorsTab {...tabProps} /></TabsContent>
      </Tabs>
    </div>
  );
}
