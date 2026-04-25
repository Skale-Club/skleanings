import { Check, Palette, RotateCcw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import { SettingsCard } from '@/components/admin/shared/SettingsCard';
import type { WebsiteTabProps } from './types';

const DEFAULT_PRIMARY = DEFAULT_HOMEPAGE_CONTENT.brandColors!.primary!;
const DEFAULT_SECONDARY = DEFAULT_HOMEPAGE_CONTENT.brandColors!.secondary!;

export function ColorsTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const colors = {
    ...DEFAULT_HOMEPAGE_CONTENT.brandColors,
    ...(homepageContent.brandColors || {}),
  };

  const primary = colors.primary || DEFAULT_PRIMARY;
  const secondary = colors.secondary || DEFAULT_SECONDARY;

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  const setColor = (key: 'primary' | 'secondary', value: string) => {
    updateHomepageContent(
      prev => ({ ...prev, brandColors: { ...colors, [key]: value } }),
      `homepageContent.brandColors.${key}`,
    );
  };

  return (
    <div className="space-y-6">
      <SettingsCard icon={Palette} title="Brand Colors">
        <p className="text-sm text-muted-foreground">
          These colors are applied site-wide as CSS variables. Changes take effect immediately on save.
        </p>

        <div className="grid gap-8 md:grid-cols-2">
        {/* Primary */}
        <div className="space-y-3">
          <Label className="font-semibold">Primary Color</Label>
          <p className="text-xs text-muted-foreground">Used for buttons, links, highlights.</p>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg border border-border shadow-sm flex-shrink-0"
              style={{ backgroundColor: primary }}
            />
            <div className="flex-1 space-y-1.5">
              <input
                type="color"
                value={primary}
                onChange={e => setColor('primary', e.target.value)}
                className="w-full h-9 rounded-md border border-input cursor-pointer p-0.5 bg-background"
              />
              <div className="relative">
                <Input
                  value={primary}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor('primary', v);
                  }}
                  maxLength={7}
                  className="font-mono text-sm"
                  placeholder="#1C53A3"
                />
                <SavedIndicator field="homepageContent.brandColors.primary" />
              </div>
            </div>
          </div>
          {primary !== DEFAULT_PRIMARY && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-1.5"
              onClick={() => setColor('primary', DEFAULT_PRIMARY)}
            >
              <RotateCcw className="w-3 h-3" /> Reset to default
            </Button>
          )}
        </div>

        {/* Secondary */}
        <div className="space-y-3">
          <Label className="font-semibold">Secondary / CTA Color</Label>
          <p className="text-xs text-muted-foreground">Used for CTA buttons and accents.</p>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg border border-border shadow-sm flex-shrink-0"
              style={{ backgroundColor: secondary }}
            />
            <div className="flex-1 space-y-1.5">
              <input
                type="color"
                value={secondary}
                onChange={e => setColor('secondary', e.target.value)}
                className="w-full h-9 rounded-md border border-input cursor-pointer p-0.5 bg-background"
              />
              <div className="relative">
                <Input
                  value={secondary}
                  onChange={e => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor('secondary', v);
                  }}
                  maxLength={7}
                  className="font-mono text-sm"
                  placeholder="#FFFF01"
                />
                <SavedIndicator field="homepageContent.brandColors.secondary" />
              </div>
            </div>
          </div>
          {secondary !== DEFAULT_SECONDARY && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground gap-1.5"
              onClick={() => setColor('secondary', DEFAULT_SECONDARY)}
            >
              <RotateCcw className="w-3 h-3" /> Reset to default
            </Button>
          )}
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={Eye} title="Preview">
        <div className="flex flex-wrap gap-3 items-center">
          <button
            className="px-5 py-2.5 rounded-full font-bold text-sm"
            style={{ backgroundColor: primary, color: '#ffffff' }}
          >
            Primary Button
          </button>
          <button
            className="px-5 py-2.5 rounded-full font-bold text-sm"
            style={{ backgroundColor: secondary, color: '#1D1D1D' }}
          >
            CTA Button
          </button>
          <span className="text-sm font-semibold" style={{ color: primary }}>Link text</span>
        </div>
      </SettingsCard>
    </div>
  );
}
