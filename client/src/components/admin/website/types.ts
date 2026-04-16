import type React from 'react';
import type { HomepageContent } from '@shared/schema';
import type { CompanySettingsData } from '@/components/admin/shared/types';

export interface WebsiteTabProps {
  heroTitle: string;
  setHeroTitle: (v: string) => void;
  heroSubtitle: string;
  setHeroSubtitle: (v: string) => void;
  heroImageUrl: string;
  setHeroImageUrl: (v: string) => void;
  ctaText: string;
  setCtaText: (v: string) => void;
  homepageContent: HomepageContent;
  setHomepageContent: React.Dispatch<React.SetStateAction<HomepageContent>>;
  savedFields: Record<string, boolean>;
  isSaving: boolean;
  saveHeroSettings: (updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => Promise<void>;
  triggerAutoSave: (updates: Partial<CompanySettingsData>, fieldKeys?: string[]) => void;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
  markFieldsSaved: (fields: string[]) => void;
  getAccessToken: () => Promise<string | null>;
}
