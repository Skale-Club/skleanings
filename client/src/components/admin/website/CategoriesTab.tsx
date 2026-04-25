import { Check, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SettingsCard } from '@/components/admin/shared/SettingsCard';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { HomepageContent } from '@shared/schema';
import type { WebsiteTabProps } from './types';

type CategoriesSection = HomepageContent['categoriesSection'];

export function CategoriesTab({
  homepageContent,
  updateHomepageContent,
  savedFields,
}: WebsiteTabProps) {
  const categoriesSection: CategoriesSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
    ...(homepageContent.categoriesSection || {}),
  };

  const updateCategoriesSection = (
    field: keyof NonNullable<CategoriesSection>,
    value: string,
    savedFieldKey: string,
  ) => {
    updateHomepageContent(
      (prev) => ({
        ...prev,
        categoriesSection: {
          ...DEFAULT_HOMEPAGE_CONTENT.categoriesSection,
          ...(prev.categoriesSection || {}),
          [field]: value,
        },
      }),
      savedFieldKey,
    );
  };

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? (
      <Check
        className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-600"
      />
    ) : null;

  return (
    <SettingsCard icon={FolderOpen} title="Categories Section">
      <div className="space-y-2">
        <Label>Title</Label>
        <div className="relative">
          <Input
            value={categoriesSection?.title || ''}
            onChange={(e) =>
              updateCategoriesSection(
                'title',
                e.target.value,
                'homepageContent.categoriesSection.title',
              )
            }
          />
          <SavedIndicator field="homepageContent.categoriesSection.title" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Subtitle</Label>
        <div className="relative">
          <Textarea
            value={categoriesSection?.subtitle || ''}
            onChange={(e) =>
              updateCategoriesSection(
                'subtitle',
                e.target.value,
                'homepageContent.categoriesSection.subtitle',
              )
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
            value={categoriesSection?.ctaText || ''}
            onChange={(e) =>
              updateCategoriesSection(
                'ctaText',
                e.target.value,
                'homepageContent.categoriesSection.ctaText',
              )
            }
          />
          <SavedIndicator field="homepageContent.categoriesSection.ctaText" />
        </div>
      </div>
    </SettingsCard>
  );
}
