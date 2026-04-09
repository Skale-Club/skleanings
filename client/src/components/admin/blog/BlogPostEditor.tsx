import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { BlogPost, Service } from '@shared/schema';
import { markdownToHtml } from '@/lib/markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { ArrowLeft, Calendar, Check, ExternalLink, Image, Loader2, Trash2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';

export interface BlogEditorProps {
  formData: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    metaDescription: string;
    focusKeyword: string;
    tags: string;
    featureImageUrl: string;
    status: string;
    authorName: string;
    publishedAt: string | null;
    serviceIds: number[];
  };
  setFormData: React.Dispatch<React.SetStateAction<BlogEditorProps['formData']>>;
  tagInput: string;
  setTagInput: React.Dispatch<React.SetStateAction<string>>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  linkRangeRef: React.MutableRefObject<Range | null>;
  currentLinkRef: React.MutableRefObject<HTMLAnchorElement | null>;
  seoFieldRef: React.RefObject<HTMLDivElement | null>;
  isSaved: boolean;
  isEditorExpanded: boolean;
  setIsEditorExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isLinkDialogOpen: boolean;
  setIsLinkDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  linkUrl: string;
  setLinkUrl: React.Dispatch<React.SetStateAction<string>>;
  isSeoChecklistOpen: boolean;
  setIsSeoChecklistOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isHtmlDialogOpen: boolean;
  setIsHtmlDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  htmlDraft: string;
  setHtmlDraft: React.Dispatch<React.SetStateAction<string>>;
  editingPost: BlogPost | null;
  services: Service[] | undefined;
  serviceSearch: string;
  setServiceSearch: React.Dispatch<React.SetStateAction<string>>;
  selectedTagSet: Set<string>;
  availableTags: string[];
  addTag: (tag: string) => void;
  syncEditorContent: () => void;
  runEditorCommand: (command: string, value?: string) => void;
  clearEditorFormatting: () => void;
  setEditorBlock: (tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4') => void;
  insertEditorLink: () => void;
  handleInsertLink: () => void;
  openHtmlEditor: () => void;
  applyHtmlEditor: () => void;
  handleTitleChange: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleServiceSelection: (serviceId: number) => void;
  handleBackToPosts: () => void;
  createMutation: UseMutationResult<any, any, any, any>;
  updateMutation: UseMutationResult<any, any, any, any>;
}

export function BlogPostEditor(props: BlogEditorProps) {
  const {
    formData, setFormData, tagInput, setTagInput,
    contentRef, linkRangeRef, currentLinkRef, seoFieldRef,
    isSaved, isEditorExpanded, setIsEditorExpanded,
    isLinkDialogOpen, setIsLinkDialogOpen, linkUrl, setLinkUrl,
    isSeoChecklistOpen, setIsSeoChecklistOpen,
    isHtmlDialogOpen, setIsHtmlDialogOpen, htmlDraft, setHtmlDraft,
    editingPost, services, serviceSearch, setServiceSearch,
    selectedTagSet, availableTags, addTag,
    syncEditorContent, runEditorCommand, clearEditorFormatting, setEditorBlock,
    insertEditorLink, handleInsertLink, openHtmlEditor, applyHtmlEditor,
    handleTitleChange, handleSubmit, handleImageUpload, toggleServiceSelection,
    handleBackToPosts, createMutation, updateMutation,
  } = props;

  const publishedDate = formData.publishedAt
    ? new Date(`${formData.publishedAt}T00:00:00`)
    : undefined;

  const focusScore = (() => {
    const keyword = formData.focusKeyword.toLowerCase().trim();
    if (!keyword) return null;

    const title = formData.title.toLowerCase();
    const slug = formData.slug.toLowerCase();
    const content = formData.content.toLowerCase();
    const metaDesc = formData.metaDescription.toLowerCase();

    let score = 0;
    const inTitle = title.includes(keyword);
    const inSlug = slug.includes(keyword.replace(/\s+/g, '-'));
    const inMeta = metaDesc.includes(keyword);
    if (inTitle) score += 25;
    if (inSlug) score += 15;
    if (inMeta) score += 25;

    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const keywordCount = (content.match(keywordRegex) || []).length;
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

    const hasOneUse = keywordCount >= 1;
    const hasThreeUses = keywordCount >= 3;
    const densityOk = density >= 0.5 && density <= 2.5;
    if (hasOneUse) score += 10;
    if (hasThreeUses) score += 10;
    if (densityOk) score += 15;

    const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    const badgeClass = score >= 80
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : score >= 50
        ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
        : 'bg-red-500/15 text-red-600 dark:text-red-400';

    return { score, barColor, badgeClass, checks: { inTitle, inSlug, inMeta, hasOneUse, hasThreeUses, densityOk }, density, keywordCount };
  })();

  const isPublished = formData.status === 'published';
  const saveLabel = isSaved
    ? 'Saved'
    : editingPost
      ? (isPublished ? 'Publish' : 'Update Post')
      : (isPublished ? 'Publish' : 'Create Post');

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Button
        type="submit"
        form="blog-post-form"
        disabled={createMutation.isPending || updateMutation.isPending}
        className={clsx(isSaved && 'bg-green-600 hover:bg-green-600 text-white')}
        data-testid="button-blog-save"
      >
        {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {isSaved && <Check className="w-4 h-4 mr-2" />}
        {saveLabel}
      </Button>
      {editingPost && formData.slug && (
        <Button variant="outline" onClick={() => window.open(`/blog/${formData.slug}`, '_blank')} className="border-0">
          <ExternalLink className="w-4 h-4 mr-2" />
          View Post
        </Button>
      )}
    </div>
  );

  return (
    <form id="blog-post-form" onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-12">
        <div className="space-y-2 md:col-span-5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter post title"
            className="border-0 bg-background"
            required
            data-testid="input-blog-title"
          />
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="url-friendly-slug"
            className="border-0 bg-background"
            required
            data-testid="input-blog-slug"
          />
        </div>
        <div className="space-y-1 md:col-span-4">
          <Label htmlFor="focusKeyword">Focus Keyword</Label>
          <div className="relative rounded-md bg-background overflow-visible" ref={seoFieldRef as React.RefObject<HTMLDivElement>}>
            <div className="relative">
              <Input
                id="focusKeyword"
                value={formData.focusKeyword}
                onChange={(e) => setFormData(prev => ({ ...prev, focusKeyword: e.target.value }))}
                placeholder="Primary SEO keyword"
                className="pr-14 rounded-none border-0 bg-transparent"
                data-testid="input-blog-keyword"
                onFocus={() => setIsSeoChecklistOpen(true)}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsSeoChecklistOpen(false); }}
              />
              {focusScore && (
                <button
                  type="button"
                  className={clsx("absolute right-2 top-1/2 -translate-y-1/2 flex h-5 items-center rounded-full px-2 text-[10px] font-medium leading-none", focusScore.badgeClass)}
                  aria-label="View SEO score checklist"
                  onClick={() => setIsSeoChecklistOpen(true)}
                >
                  {focusScore.score}/100
                </button>
              )}
            </div>
            {focusScore && (
              <div className="relative z-20 h-[3px] bg-slate-200 dark:bg-slate-700">
                <div className={clsx("h-full transition-all", focusScore.barColor)} style={{ width: `${focusScore.score}%` }} />
              </div>
            )}
            {focusScore && isSeoChecklistOpen && (
              <div
                className="absolute left-0 right-0 z-10 rounded-b-[4px] rounded-t-[0px] border-0 bg-popover p-3 shadow-lg"
                style={{ top: 'calc(100% - 3px)' }}
                role="dialog"
                aria-label="SEO 100% checklist"
              >
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="text-sm font-semibold text-foreground">SEO 100% checklist</div>
                  <ul className="space-y-1">
                    {[
                      { check: focusScore.checks.inTitle, label: 'Focus keyword in title' },
                      { check: focusScore.checks.inSlug, label: 'Focus keyword in slug' },
                      { check: focusScore.checks.inMeta, label: 'Focus keyword in meta description' },
                      { check: focusScore.checks.hasOneUse, label: 'Keyword appears at least once in content' },
                      { check: focusScore.checks.hasThreeUses, label: 'Keyword appears 3+ times in content' },
                      { check: focusScore.checks.densityOk, label: 'Keyword density between 0.5% and 2.5%' },
                    ].map(({ check, label }) => (
                      <li key={label} className="flex items-start gap-2">
                        <span className={check ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={check ? "text-foreground" : ""}>{label}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1 text-[11px]">
                    Current: {focusScore.keywordCount} uses · {focusScore.density.toFixed(2)}% density
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="content">Content *</Label>
          <button
            type="button"
            onClick={() => setIsEditorExpanded(prev => !prev)}
            className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            {isEditorExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        <div className="rounded-md bg-background overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-2 py-2 text-[11px] text-muted-foreground sm:text-xs">
            {[
              { label: 'P', tag: 'p' },
              { label: 'H1', tag: 'h1' },
              { label: 'H2', tag: 'h2' },
              { label: 'H3', tag: 'h3' },
              { label: 'H4', tag: 'h4' },
            ].map(({ label, tag }) => (
              <button key={tag} type="button" onClick={() => setEditorBlock(tag as 'p' | 'h1' | 'h2' | 'h3' | 'h4')} className="h-8 rounded-md px-2 text-foreground hover:bg-muted">
                {label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-border/60" />
            {[
              { label: 'Bold', cmd: 'bold' },
              { label: 'Italic', cmd: 'italic' },
              { label: 'Bulleted list', cmd: 'insertUnorderedList' },
              { label: 'Numbered list', cmd: 'insertOrderedList' },
            ].map(({ label, cmd }) => (
              <button key={cmd} type="button" onClick={() => runEditorCommand(cmd)} className="h-8 rounded-md px-2 text-foreground hover:bg-muted">
                {label}
              </button>
            ))}
            <button type="button" onClick={insertEditorLink} className="h-8 rounded-md px-2 text-foreground hover:bg-muted">Link</button>
            <button type="button" onClick={clearEditorFormatting} className="h-8 rounded-md px-2 text-foreground hover:bg-muted">Clear</button>
            <button type="button" onClick={openHtmlEditor} className="h-8 rounded-md px-2 text-foreground hover:bg-muted">HTML</button>
          </div>
          <div
            id="content"
            ref={contentRef as React.RefObject<HTMLDivElement>}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={syncEditorContent}
            onBlur={syncEditorContent}
            onPaste={(e) => {
              const htmlData = e.clipboardData.getData('text/html');
              const text = e.clipboardData.getData('text/plain');

              if (htmlData && htmlData.trim()) {
                e.preventDefault();
                let cleanHtml = htmlData
                  .replace(/<meta[^>]*>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<!--[\s\S]*?-->/g, '')
                  .replace(/\sclass="[^"]*"/gi, '')
                  .replace(/\sid="[^"]*"/gi, '')
                  .replace(/\sstyle="[^"]*"/gi, '');
                document.execCommand('insertHTML', false, cleanHtml);
                syncEditorContent();
                return;
              }

              if (text && (
                text.includes('# ') || text.includes('## ') || text.includes('**') ||
                text.includes('* ') || text.match(/^\d+\. /m) || (text.includes('[') && text.includes(']('))
              )) {
                e.preventDefault();
                const html = markdownToHtml(text);
                document.execCommand('insertHTML', false, html);
                syncEditorContent();
                return;
              }

              if (text && /<\/?[a-z][\s\S]*>/i.test(text)) {
                e.preventDefault();
                let cleanHtml = text
                  .replace(/<meta[^>]*>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<!--[\s\S]*?-->/g, '')
                  .replace(/\sclass="[^"]*"/gi, '')
                  .replace(/\sid="[^"]*"/gi, '')
                  .replace(/\sstyle="[^"]*"/gi, '');
                document.execCommand('insertHTML', false, cleanHtml);
                syncEditorContent();
              }
            }}
            data-placeholder="Write or paste your blog post content here..."
            className={clsx(
              "admin-editor px-3 py-2 text-sm focus:outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-visible sm:overflow-y-auto",
              isEditorExpanded
                ? "min-h-[260px] max-h-none sm:min-h-[420px] sm:max-h-[70vh]"
                : "min-h-[150px] max-h-none sm:min-h-[220px] sm:max-h-[45vh]"
            )}
            data-testid="textarea-blog-content"
          />
        </div>

        <Dialog
          open={isLinkDialogOpen}
          onOpenChange={(open) => {
            setIsLinkDialogOpen(open);
            if (!open) {
              currentLinkRef.current = null;
              linkRangeRef.current = null;
            }
          }}
        >
          <DialogContent className="sm:max-w-sm border-0">
            <DialogHeader>
              <DialogTitle>Add link</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="border-0 bg-muted/40"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (currentLinkRef.current) {
                    const link = currentLinkRef.current;
                    link.replaceWith(document.createTextNode(link.textContent || link.href));
                    syncEditorContent();
                  } else {
                    const selection = window.getSelection();
                    if (selection && linkRangeRef.current) {
                      selection.removeAllRanges();
                      selection.addRange(linkRangeRef.current);
                    }
                    runEditorCommand('unlink');
                  }
                  setIsLinkDialogOpen(false);
                  currentLinkRef.current = null;
                  linkRangeRef.current = null;
                }}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={handleInsertLink}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isHtmlDialogOpen} onOpenChange={setIsHtmlDialogOpen}>
          <DialogContent className="sm:max-w-2xl border-0">
            <DialogHeader>
              <DialogTitle>Edit HTML</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="html-source">HTML</Label>
              <Textarea
                id="html-source"
                value={htmlDraft}
                onChange={(e) => setHtmlDraft(e.target.value)}
                className="min-h-[240px] font-mono text-xs border-0 bg-muted/40"
                placeholder="<h2>Title</h2>"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="button" onClick={applyHtmlEditor}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p className="text-xs text-muted-foreground">Paste HTML or Markdown — auto-converts and formats!</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="metaDescription">Meta Description</Label>
          <Textarea
            id="metaDescription"
            value={formData.metaDescription}
            onChange={(e) => setFormData(prev => ({ ...prev, metaDescription: e.target.value.slice(0, 155) }))}
            placeholder="Short description for SEO and blog cards..."
            className="min-h-[100px] border-0 bg-background"
            data-testid="textarea-blog-meta"
          />
          <p className="text-xs text-muted-foreground">{formData.metaDescription.length}/155 characters · Used for SEO and blog cards</p>
        </div>
        <div className="space-y-2">
          <Label>Feature Image</Label>
          <div
            className="relative w-full sm:w-1/2 aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group"
            onClick={() => document.getElementById('featureImageInput')?.click()}
          >
            {formData.featureImageUrl ? (
              <>
                <img src={formData.featureImageUrl} alt="Feature" className="w-full h-full object-cover" data-testid="img-blog-feature-preview" />
                <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">Uploaded</div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Click to change</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFormData(prev => ({ ...prev, featureImageUrl: '' })); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                <Image className="w-8 h-8 mb-2" />
                <span className="text-sm">Click to upload</span>
                <span className="text-xs mt-1">1200x675px (16:9)</span>
              </div>
            )}
            <input id="featureImageInput" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" data-testid="input-blog-feature-image" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 min-h-9 rounded-md bg-background px-3 py-2">
            {formData.tags.split(',').filter(t => t.trim()).map((tag, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                {tag.trim()}
                <button
                  type="button"
                  onClick={() => {
                    const tags = formData.tags.split(',').filter(t => t.trim());
                    tags.splice(index, 1);
                    setFormData(prev => ({ ...prev, tags: tags.join(',') }));
                  }}
                  className="hover:text-destructive"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const newTag = tagInput.trim();
                  if (newTag && !formData.tags.split(',').map(t => t.trim().toLowerCase()).includes(newTag.toLowerCase())) {
                    setFormData(prev => ({ ...prev, tags: prev.tags ? `${prev.tags},${newTag}` : newTag }));
                  }
                  setTagInput('');
                }
              }}
              placeholder={formData.tags ? "Add more..." : "Type and press Enter..."}
              className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Available tags</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !selectedTagSet.has(tag.toLowerCase()))
                  .map((tag) => (
                    <button key={tag} type="button" onClick={() => addTag(tag)} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground">
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Related Services (max 3)</Label>
          <div className="rounded-md bg-background overflow-hidden">
            <Input
              placeholder="Search services..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="rounded-none border-0 bg-transparent"
              data-testid="input-service-search"
            />
            <div className="grid gap-2 max-h-[120px] overflow-y-auto border-t border-border/50 p-3">
              {services?.filter(s => !s.isHidden && s.name.toLowerCase().includes(serviceSearch.toLowerCase())).map(service => (
                <div key={service.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`service-${service.id}`}
                    checked={formData.serviceIds.includes(service.id)}
                    onCheckedChange={() => toggleServiceSelection(service.id)}
                    disabled={!formData.serviceIds.includes(service.id) && formData.serviceIds.length >= 3}
                    data-testid={`checkbox-service-${service.id}`}
                  />
                  <Label htmlFor={`service-${service.id}`} className="text-sm cursor-pointer">
                    {service.name} - ${service.price}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
            <SelectTrigger className="border-0 bg-background" data-testid="select-blog-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="publishedAt">Publication Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="publishedAt"
                type="button"
                className={clsx("flex h-9 w-full items-center justify-between rounded-md bg-background px-3 py-2 text-sm", !publishedDate && "text-muted-foreground")}
                data-testid="input-blog-date"
              >
                <span className="truncate">{publishedDate ? format(publishedDate, "MM/dd/yyyy") : "Select date"}</span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-2xl border-0 p-0 shadow-lg overflow-hidden" align="end" side="bottom" sideOffset={8}>
              <CalendarPicker
                mode="single"
                selected={publishedDate}
                onSelect={(date) => setFormData(prev => ({ ...prev, publishedAt: date ? format(date, "yyyy-MM-dd") : null }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorName">Author</Label>
          <Input
            id="authorName"
            value={formData.authorName}
            onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
            placeholder="Skleanings"
            className="border-0 bg-background"
            data-testid="input-blog-author"
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 pt-4 border-t border-border/70 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" onClick={handleBackToPosts} data-testid="button-blog-back-bottom">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Posts
        </Button>
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:gap-3">
          {actionButtons}
        </div>
      </div>
    </form>
  );
}
