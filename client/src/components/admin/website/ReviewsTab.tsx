import { Check, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { SettingsCard } from '@/components/admin/shared/SettingsCard';
import type { WebsiteTabProps } from './types';

export function ReviewsTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const reviewsSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.reviewsSection,
    ...(homepageContent.reviewsSection || {}),
  };

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  return (
    <SettingsCard icon={Star} title="Reviews Section">
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
    </SettingsCard>
  );
}
