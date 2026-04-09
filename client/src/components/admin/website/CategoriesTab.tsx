import { Check, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { WebsiteTabProps } from './types';

export function CategoriesTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const categoriesSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(homepageContent.categoriesSection || {}),
  };

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <FolderOpen className="w-4 h-4 text-primary" />
        Categories Section
      </h3>
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
  );
}
