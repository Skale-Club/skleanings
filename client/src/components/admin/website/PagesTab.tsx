import { Check, FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_HOMEPAGE_CONTENT } from '@/lib/homepageDefaults';
import type { WebsiteTabProps } from './types';

export function PagesTab({ homepageContent, updateHomepageContent, savedFields }: WebsiteTabProps) {
  const about = { ...DEFAULT_HOMEPAGE_CONTENT.aboutSection, ...(homepageContent.aboutSection || {}) };
  const team = { ...DEFAULT_HOMEPAGE_CONTENT.teamSection, ...(homepageContent.teamSection || {}) };
  const areasPage = { ...DEFAULT_HOMEPAGE_CONTENT.serviceAreasPageSection, ...(homepageContent.serviceAreasPageSection || {}) };
  const faqPage = { ...DEFAULT_HOMEPAGE_CONTENT.faqPageSection, ...(homepageContent.faqPageSection || {}) };
  const blogPage = { ...DEFAULT_HOMEPAGE_CONTENT.blogPageSection, ...(homepageContent.blogPageSection || {}) };
  const confirmation = { ...DEFAULT_HOMEPAGE_CONTENT.confirmationSection, ...(homepageContent.confirmationSection || {}) };

  const aboutFeatures = about.features ?? DEFAULT_HOMEPAGE_CONTENT.aboutSection!.features!;
  const teamFeatures = team.features ?? DEFAULT_HOMEPAGE_CONTENT.teamSection!.features!;
  const teamStats = team.stats ?? DEFAULT_HOMEPAGE_CONTENT.teamSection!.stats!;

  const SavedIndicator = ({ field }: { field: string }) =>
    savedFields[field] ? <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" /> : null;

  const field = (section: string, key: string) => `homepageContent.${section}.${key}`;

  // Generic section updater
  const update = (section: keyof typeof homepageContent, patch: Record<string, unknown>, fk?: string) =>
    updateHomepageContent(prev => ({
      ...prev,
      [section]: { ...(prev[section] as object || {}), ...patch },
    }), fk ? `homepageContent.${String(section)}.${fk}` : undefined);

  return (
    <div className="space-y-10">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        Page Content
      </h3>

      {/* ── About Page ─────────────────────────────────── */}
      <section className="space-y-4 border-t pt-6">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">About Page</h4>

        <div className="space-y-2">
          <Label>Heading</Label>
          <div className="relative">
            <Input value={about.heading || ''} onChange={e => update('aboutSection', { heading: e.target.value }, 'heading')} />
            <SavedIndicator field={field('aboutSection', 'heading')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Intro</Label>
          <div className="relative">
            <Textarea value={about.intro || ''} onChange={e => update('aboutSection', { intro: e.target.value }, 'intro')} className="min-h-[80px]" />
            <SavedIndicator field={field('aboutSection', 'intro')} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Feature Cards</Label>
            <Button variant="outline" size="sm" className="border-dashed" onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                aboutSection: { ...about, features: [...aboutFeatures, { title: '', desc: '' }] },
              }))
            }>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
          {aboutFeatures.map((f, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-start bg-muted/50 p-3 rounded-lg border border-border">
              <div className="relative">
                <Input value={f.title} placeholder="Title" onChange={e => {
                  const next = aboutFeatures.map((x, j) => j === i ? { ...x, title: e.target.value } : x);
                  update('aboutSection', { features: next }, `features.${i}.title`);
                }} />
                <SavedIndicator field={field('aboutSection', `features.${i}.title`)} />
              </div>
              <div className="relative">
                <Input value={f.desc} placeholder="Description" onChange={e => {
                  const next = aboutFeatures.map((x, j) => j === i ? { ...x, desc: e.target.value } : x);
                  update('aboutSection', { features: next }, `features.${i}.desc`);
                }} />
                <SavedIndicator field={field('aboutSection', `features.${i}.desc`)} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => update('aboutSection', { features: aboutFeatures.filter((_, j) => j !== i) })}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Mission Title</Label>
          <div className="relative">
            <Input value={about.missionTitle || ''} onChange={e => update('aboutSection', { missionTitle: e.target.value }, 'missionTitle')} />
            <SavedIndicator field={field('aboutSection', 'missionTitle')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mission Text</Label>
          <div className="relative">
            <Textarea value={about.missionText || ''} onChange={e => update('aboutSection', { missionText: e.target.value }, 'missionText')} className="min-h-[100px]" />
            <SavedIndicator field={field('aboutSection', 'missionText')} />
          </div>
        </div>
      </section>

      {/* ── Team Page ───────────────────────────────────── */}
      <section className="space-y-4 border-t pt-6">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Team Page</h4>

        <div className="space-y-2">
          <Label>Heading</Label>
          <div className="relative">
            <Input value={team.heading || ''} onChange={e => update('teamSection', { heading: e.target.value }, 'heading')} />
            <SavedIndicator field={field('teamSection', 'heading')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Intro</Label>
          <div className="relative">
            <Textarea value={team.intro || ''} onChange={e => update('teamSection', { intro: e.target.value }, 'intro')} className="min-h-[80px]" />
            <SavedIndicator field={field('teamSection', 'intro')} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Feature Cards</Label>
            <Button variant="outline" size="sm" className="border-dashed" onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                teamSection: { ...team, features: [...teamFeatures, { title: '', desc: '' }] },
              }))
            }>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          </div>
          {teamFeatures.map((f, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-start bg-muted/50 p-3 rounded-lg border border-border">
              <div className="relative">
                <Input value={f.title} placeholder="Title" onChange={e => {
                  const next = teamFeatures.map((x, j) => j === i ? { ...x, title: e.target.value } : x);
                  update('teamSection', { features: next }, `features.${i}.title`);
                }} />
                <SavedIndicator field={field('teamSection', `features.${i}.title`)} />
              </div>
              <div className="relative">
                <Input value={f.desc} placeholder="Description" onChange={e => {
                  const next = teamFeatures.map((x, j) => j === i ? { ...x, desc: e.target.value } : x);
                  update('teamSection', { features: next }, `features.${i}.desc`);
                }} />
                <SavedIndicator field={field('teamSection', `features.${i}.desc`)} />
              </div>
              <Button variant="ghost" size="icon" onClick={() => update('teamSection', { features: teamFeatures.filter((_, j) => j !== i) })}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>"Why Choose" Title</Label>
          <div className="relative">
            <Input value={team.whyChooseTitle || ''} onChange={e => update('teamSection', { whyChooseTitle: e.target.value }, 'whyChooseTitle')} />
            <SavedIndicator field={field('teamSection', 'whyChooseTitle')} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>"Why Choose" Text</Label>
          <div className="relative">
            <Textarea value={team.whyChooseText || ''} onChange={e => update('teamSection', { whyChooseText: e.target.value }, 'whyChooseText')} className="min-h-[100px]" />
            <SavedIndicator field={field('teamSection', 'whyChooseText')} />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Stats</Label>
          {teamStats.map((s, i) => (
            <div key={i} className="grid gap-2 grid-cols-[120px_1fr_auto] items-start bg-muted/50 p-3 rounded-lg border border-border">
              <div className="relative">
                <Input value={s.value} placeholder="100%" onChange={e => {
                  const next = teamStats.map((x, j) => j === i ? { ...x, value: e.target.value } : x);
                  update('teamSection', { stats: next }, `stats.${i}.value`);
                }} />
                <SavedIndicator field={field('teamSection', `stats.${i}.value`)} />
              </div>
              <div className="relative">
                <Input value={s.label} placeholder="Label" onChange={e => {
                  const next = teamStats.map((x, j) => j === i ? { ...x, label: e.target.value } : x);
                  update('teamSection', { stats: next }, `stats.${i}.label`);
                }} />
                <SavedIndicator field={field('teamSection', `stats.${i}.label`)} />
              </div>
              <div className="w-9" />
            </div>
          ))}
        </div>
      </section>

      {/* ── Service Areas Page ──────────────────────────── */}
      <section className="space-y-4 border-t pt-6">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Service Areas Page</h4>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input value={areasPage.heading || ''} onChange={e => update('serviceAreasPageSection', { heading: e.target.value }, 'heading')} />
              <SavedIndicator field={field('serviceAreasPageSection', 'heading')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>"Not Found" Title</Label>
            <div className="relative">
              <Input value={areasPage.notFoundTitle || ''} onChange={e => update('serviceAreasPageSection', { notFoundTitle: e.target.value }, 'notFoundTitle')} />
              <SavedIndicator field={field('serviceAreasPageSection', 'notFoundTitle')} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Intro</Label>
          <div className="relative">
            <Textarea value={areasPage.intro || ''} onChange={e => update('serviceAreasPageSection', { intro: e.target.value }, 'intro')} className="min-h-[80px]" />
            <SavedIndicator field={field('serviceAreasPageSection', 'intro')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>"Not Found" Text</Label>
          <div className="relative">
            <Textarea value={areasPage.notFoundText || ''} onChange={e => update('serviceAreasPageSection', { notFoundText: e.target.value }, 'notFoundText')} className="min-h-[60px]" />
            <SavedIndicator field={field('serviceAreasPageSection', 'notFoundText')} />
          </div>
        </div>
      </section>

      {/* ── FAQ Page ────────────────────────────────────── */}
      <section className="space-y-4 border-t pt-6">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">FAQ Page</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input value={faqPage.heading || ''} onChange={e => update('faqPageSection', { heading: e.target.value }, 'heading')} />
              <SavedIndicator field={field('faqPageSection', 'heading')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Input value={faqPage.subtitle || ''} onChange={e => update('faqPageSection', { subtitle: e.target.value }, 'subtitle')} />
              <SavedIndicator field={field('faqPageSection', 'subtitle')} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Blog Page ───────────────────────────────────── */}
      <section className="space-y-4 border-t pt-6">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Blog Page</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Heading</Label>
            <div className="relative">
              <Input value={blogPage.heading || ''} onChange={e => update('blogPageSection', { heading: e.target.value }, 'heading')} />
              <SavedIndicator field={field('blogPageSection', 'heading')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtitle</Label>
            <div className="relative">
              <Input value={blogPage.subtitle || ''} onChange={e => update('blogPageSection', { subtitle: e.target.value }, 'subtitle')} />
              <SavedIndicator field={field('blogPageSection', 'subtitle')} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Confirmation Page ───────────────────────────── */}
      <section className="space-y-4 border-t pt-6">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Booking Confirmation Page</h4>
        <div className="space-y-2">
          <Label>Message (Online Payment)</Label>
          <div className="relative">
            <Textarea value={confirmation.paidMessage || ''} onChange={e => update('confirmationSection', { paidMessage: e.target.value }, 'paidMessage')} className="min-h-[80px]" />
            <SavedIndicator field={field('confirmationSection', 'paidMessage')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Message (Pay on Site)</Label>
          <div className="relative">
            <Textarea value={confirmation.sitePaymentMessage || ''} onChange={e => update('confirmationSection', { sitePaymentMessage: e.target.value }, 'sitePaymentMessage')} className="min-h-[80px]" />
            <SavedIndicator field={field('confirmationSection', 'sitePaymentMessage')} />
          </div>
        </div>
      </section>
    </div>
  );
}
