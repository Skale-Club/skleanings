import { Check, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { WebsiteTabProps } from './types';

export function BlogTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const blogSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.blogSection,
    ...(homepageContent.blogSection || {}),
  };

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Blog Section
      </h3>
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
  );
}
