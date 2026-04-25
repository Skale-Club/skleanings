import { Check, LayoutTemplate, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { SettingsCard } from '@/components/admin/shared/SettingsCard';
import type { WebsiteTabProps } from './types';

export function FooterTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const footerSection = {
    ...DEFAULT_HOMEPAGE_CONTENT.footerSection,
    ...(homepageContent.footerSection || {}),
  };

  const companyLinks = footerSection.companyLinks ?? DEFAULT_HOMEPAGE_CONTENT.footerSection!.companyLinks!;
  const resourceLinks = footerSection.resourceLinks ?? DEFAULT_HOMEPAGE_CONTENT.footerSection!.resourceLinks!;

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  const updateLink = (
    list: 'companyLinks' | 'resourceLinks',
    index: number,
    field: 'label' | 'href',
    value: string,
  ) => {
    updateHomepageContent(prev => {
      const current = prev.footerSection?.[list] ?? DEFAULT_HOMEPAGE_CONTENT.footerSection![list]!;
      const updated = current.map((item, i) => i === index ? { ...item, [field]: value } : item);
      return { ...prev, footerSection: { ...footerSection, [list]: updated } };
    }, `homepageContent.footerSection.${list}.${index}.${field}`);
  };

  const addLink = (list: 'companyLinks' | 'resourceLinks') => {
    updateHomepageContent(prev => {
      const current = prev.footerSection?.[list] ?? DEFAULT_HOMEPAGE_CONTENT.footerSection![list]!;
      return { ...prev, footerSection: { ...footerSection, [list]: [...current, { label: '', href: '/' }] } };
    });
  };

  const removeLink = (list: 'companyLinks' | 'resourceLinks', index: number) => {
    updateHomepageContent(prev => {
      const current = prev.footerSection?.[list] ?? DEFAULT_HOMEPAGE_CONTENT.footerSection![list]!;
      return { ...prev, footerSection: { ...footerSection, [list]: current.filter((_, i) => i !== index) } };
    });
  };

  return (
    <SettingsCard icon={LayoutTemplate} title="Footer">
      {/* Tagline */}
      <div className="space-y-2">
        <Label>Tagline</Label>
        <div className="relative">
          <Textarea
            value={footerSection.tagline || ''}
            onChange={(e) =>
              updateHomepageContent(prev => ({
                ...prev,
                footerSection: { ...footerSection, tagline: e.target.value },
              }), 'homepageContent.footerSection.tagline')
            }
            placeholder="Professional cleaning services..."
            className="min-h-[80px]"
          />
          <SavedIndicator field="homepageContent.footerSection.tagline" />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Company Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Company Links</Label>
            <Button variant="outline" size="sm" className="border-dashed" onClick={() => addLink('companyLinks')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Link
            </Button>
          </div>
          <div className="space-y-2">
            {companyLinks.map((link, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <div className="relative">
                    <Input
                      value={link.label}
                      onChange={(e) => updateLink('companyLinks', index, 'label', e.target.value)}
                      placeholder="Label (e.g. About Us)"
                    />
                    <SavedIndicator field={`homepageContent.footerSection.companyLinks.${index}.label`} />
                  </div>
                  <div className="relative">
                    <Input
                      value={link.href}
                      onChange={(e) => updateLink('companyLinks', index, 'href', e.target.value)}
                      placeholder="/about"
                    />
                    <SavedIndicator field={`homepageContent.footerSection.companyLinks.${index}.href`} />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0"
                  onClick={() => removeLink('companyLinks', index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Resource Links</Label>
            <Button variant="outline" size="sm" className="border-dashed" onClick={() => addLink('resourceLinks')}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Link
            </Button>
          </div>
          <div className="space-y-2">
            {resourceLinks.map((link, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1.5">
                  <div className="relative">
                    <Input
                      value={link.label}
                      onChange={(e) => updateLink('resourceLinks', index, 'label', e.target.value)}
                      placeholder="Label (e.g. Blog)"
                    />
                    <SavedIndicator field={`homepageContent.footerSection.resourceLinks.${index}.label`} />
                  </div>
                  <div className="relative">
                    <Input
                      value={link.href}
                      onChange={(e) => updateLink('resourceLinks', index, 'href', e.target.value)}
                      placeholder="/blog"
                    />
                    <SavedIndicator field={`homepageContent.footerSection.resourceLinks.${index}.href`} />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0"
                  onClick={() => removeLink('resourceLinks', index)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The "Services" column is auto-populated from your service categories. Social links are managed in Company Settings → Branding.
      </p>
    </SettingsCard>
  );
}
