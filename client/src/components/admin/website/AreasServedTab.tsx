import { Check, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { WebsiteTabProps } from './types';

export function AreasServedTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const areasServedSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.areasServedSection,
    ...(homepageContent.areasServedSection || {}),
  };

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        Areas Served Section
      </h3>
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
  );
}
