import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { BlogPost, Service } from '@shared/schema';
import { apiRequest, authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { markdownToHtml, renderMarkdown } from '@/lib/markdown';
import BlogSettings from '@/pages/admin/BlogSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Image,
  LayoutGrid,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
export function BlogSection({ resetSignal, getAccessToken }: { resetSignal: number; getAccessToken: () => Promise<string | null> }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'posts' | 'settings'>('posts');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'status'>('newest');
  const [serviceSearch, setServiceSearch] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [isRenamingTag, setIsRenamingTag] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isSeoChecklistOpen, setIsSeoChecklistOpen] = useState(false);
  const [isHtmlDialogOpen, setIsHtmlDialogOpen] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState('');
  const blogMenuTitle = 'Blog Posts';
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    metaDescription: '',
    focusKeyword: '',
    tags: '' as string,
    featureImageUrl: '',
    status: 'published',
    authorName: 'Skleanings',
    publishedAt: new Date().toISOString().split('T')[0] as string | null,
    serviceIds: [] as number[],
  });
  const [tagInput, setTagInput] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastContentRef = useRef('');
  const lastResetSignalRef = useRef(0);
  const linkRangeRef = useRef<Range | null>(null);
  const currentLinkRef = useRef<HTMLAnchorElement | null>(null);
  const seoFieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSeoChecklistOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (seoFieldRef.current?.contains(target)) return;
      setIsSeoChecklistOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isSeoChecklistOpen]);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog'],
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const sortedPosts = useMemo(() => {
    if (!posts) return [];

    const sorted = [...posts];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateA - dateB;
        });
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'status':
        return sorted.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'published' ? -1 : 1;
        });
      default:
        return sorted;
    }
  }, [posts, sortBy]);

  const availableTags = useMemo(() => {
    if (!posts) return [];
    const tagMap = new Map<string, string>();
    posts.forEach((post) => {
      const rawTags = (post.tags || '').split(',');
      rawTags.forEach((tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!tagMap.has(key)) {
          tagMap.set(key, trimmed);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const selectedTagSet = useMemo(() => {
    return new Set(
      formData.tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [formData.tags]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFormData((prev) => {
      const existing = prev.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return { ...prev, tags: existing.length ? `${existing.join(',')},${trimmed}` : trimmed };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      metaDescription: '',
      focusKeyword: '',
      tags: '',
      featureImageUrl: '',
      status: 'published',
      authorName: 'Skleanings',
      publishedAt: new Date().toISOString().split('T')[0] as string | null,
      serviceIds: [],
    });
    setTagInput('');
  }, []);

  const handleBackToPosts = useCallback(() => {
    setIsCreateOpen(false);
    setEditingPost(null);
    setServiceSearch('');
    setIsSaved(false);
    resetForm();
  }, [resetForm]);

  // Reset saved state when form data changes
  useEffect(() => {
    if (isSaved) {
      setIsSaved(false);
    }
  }, [formData]);

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return;
    lastResetSignalRef.current = resetSignal;
    if (editingPost || isCreateOpen) {
      setIsCreateOpen(false);
      setEditingPost(null);
      setServiceSearch('');
      setIsSaved(false);
      resetForm();
    }
  }, [resetSignal, editingPost, isCreateOpen, resetForm]);

  useEffect(() => {
    if (!contentRef.current) return;
    if (formData.content === lastContentRef.current) return;
    if (document.activeElement === contentRef.current) return;
    contentRef.current.innerHTML = formData.content;
    lastContentRef.current = formData.content;
  }, [formData.content]);

  const syncEditorContent = useCallback(() => {
    if (!contentRef.current) return;
    const rawHtml = contentRef.current.innerHTML;
    const text = contentRef.current.textContent?.trim() || '';
    const nextHtml = text ? rawHtml : '';
    lastContentRef.current = nextHtml;
    setFormData(prev => (prev.content === nextHtml ? prev : { ...prev, content: nextHtml }));
  }, []);

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      if (!contentRef.current) return;
      contentRef.current.focus();
      document.execCommand(command, false, value);
      syncEditorContent();
    },
    [syncEditorContent]
  );

  const clearEditorFormatting = useCallback(() => {
    if (!contentRef.current) return;
    contentRef.current.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const block = (range.startContainer as HTMLElement)?.parentElement?.closest('p,h1,h2,h3,h4,li,div');
      if (block) {
        const blockRange = document.createRange();
        blockRange.selectNodeContents(block);
        selection.removeAllRanges();
        selection.addRange(blockRange);
      }
    }
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    document.execCommand('formatBlock', false, '<p>');
    syncEditorContent();
  }, [syncEditorContent]);

  const setEditorBlock = useCallback(
    (tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4') => {
      runEditorCommand('formatBlock', `<${tag}>`);
    },
    [runEditorCommand]
  );

  const insertEditorLink = useCallback(() => {
    if (!contentRef.current) return;
    const selection = window.getSelection();
    const node = selection?.anchorNode || selection?.focusNode;
    const anchor = node ? (node.parentElement?.closest('a') ?? null) : null;
    if (anchor) {
      currentLinkRef.current = anchor;
      setLinkUrl(anchor.getAttribute('href') || '');
      setIsLinkDialogOpen(true);
      return;
    }
    if (selection && selection.rangeCount > 0) {
      linkRangeRef.current = selection.getRangeAt(0).cloneRange();
    } else {
      linkRangeRef.current = null;
    }
    setLinkUrl('');
    setIsLinkDialogOpen(true);
  }, [runEditorCommand]);

  const handleInsertLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) {
      setIsLinkDialogOpen(false);
      return;
    }
    if (currentLinkRef.current) {
      currentLinkRef.current.setAttribute('href', url);
      syncEditorContent();
      setIsLinkDialogOpen(false);
      currentLinkRef.current = null;
      return;
    }
    const selection = window.getSelection();
    if (selection && linkRangeRef.current) {
      selection.removeAllRanges();
      selection.addRange(linkRangeRef.current);
    }
    if (!selection || selection.rangeCount === 0) {
      setIsLinkDialogOpen(false);
      return;
    }
    if (selection.isCollapsed) {
      document.execCommand('insertHTML', false, `<a href="${url}">${url}</a>`);
    } else {
      document.execCommand('createLink', false, url);
    }
    syncEditorContent();
    setIsLinkDialogOpen(false);
    linkRangeRef.current = null;
  }, [linkUrl, syncEditorContent]);

  const openHtmlEditor = useCallback(() => {
    if (contentRef.current) {
      setHtmlDraft(contentRef.current.innerHTML);
    } else {
      setHtmlDraft(formData.content || '');
    }
    setIsHtmlDialogOpen(true);
  }, [formData.content]);

  const applyHtmlEditor = useCallback(() => {
    const nextHtml = htmlDraft.trim();
    setFormData(prev => ({ ...prev, content: nextHtml }));
    if (contentRef.current) {
      contentRef.current.innerHTML = nextHtml;
      lastContentRef.current = nextHtml;
    }
    setIsHtmlDialogOpen(false);
  }, [htmlDraft]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await authenticatedRequest('POST', '/api/blog', token, data);
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      const createdPost = response;
      toast({ title: 'Blog post created successfully' });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      // Update form to editing mode with the created post
      if (createdPost && createdPost.id) {
        setEditingPost(createdPost);
      }
    },
    onError: (err: any) => {
      toast({ title: 'Error creating post', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('PUT', `/api/blog/${id}`, token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: 'Error updating post', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      return authenticatedRequest('DELETE', `/api/blog/${id}`, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Blog post deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting post', description: err.message, variant: 'destructive' });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('DELETE', `/api/blog/tags/${encodeURIComponent(tag)}`, token);
    },
    onSuccess: (_data, tag) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag removed', description: `"${tag}" removed from all posts.` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to remove tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsDeletingTag(false);
      setTagToDelete(null);
    }
  });

  const renameTagMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      await authenticatedRequest('PUT', `/api/blog/tags/${encodeURIComponent(from)}`, token, { name: to });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag updated', description: `"${variables.from}" renamed to "${variables.to}".` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsRenamingTag(false);
      setEditingTag(null);
      setEditingTagValue('');
    }
  });

  const handleConfirmRemoveTag = useCallback(() => {
    if (!tagToDelete || isDeletingTag) return;
    setIsDeletingTag(true);
    removeTagMutation.mutate(tagToDelete);
  }, [tagToDelete, isDeletingTag, removeTagMutation]);

  const handleStartEditTag = useCallback((tag: string) => {
    if (isRenamingTag) return;
    setEditingTag(tag);
    setEditingTagValue(tag);
  }, [isRenamingTag]);

  const handleCancelEditTag = useCallback(() => {
    setEditingTag(null);
    setEditingTagValue('');
  }, []);

  const handleSubmitEditTag = useCallback(() => {
    if (!editingTag || isRenamingTag) return;
    const next = editingTagValue.trim();
    if (!next) {
      handleCancelEditTag();
      return;
    }
    if (next === editingTag) {
      handleCancelEditTag();
      return;
    }
    const nextLower = next.toLowerCase();
    const currentLower = editingTag.toLowerCase();
    const hasDuplicate = availableTags.some(
      (tag) => tag.toLowerCase() === nextLower && tag.toLowerCase() !== currentLower
    );
    if (hasDuplicate) {
      toast({ title: 'Tag already exists', description: `"${next}" is already in use.` });
      return;
    }
    setIsRenamingTag(true);
    renameTagMutation.mutate({ from: editingTag, to: next });
  }, [editingTag, editingTagValue, isRenamingTag, availableTags, renameTagMutation, toast, handleCancelEditTag]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const handleEdit = async (post: BlogPost) => {
    const postServices = await fetch(`/api/blog/${post.id}/services`).then(r => r.json());
    setEditingPost(post);
    setIsSaved(false);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      metaDescription: post.metaDescription || '',
      focusKeyword: post.focusKeyword || '',
      tags: (post as any).tags || '',
      featureImageUrl: post.featureImageUrl || '',
      status: post.status,
      authorName: post.authorName || 'Admin',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : null,
      serviceIds: postServices.map((s: Service) => s.id),
    });
    setTagInput('');
  };

  const getPostSeoScore = useCallback((post: BlogPost) => {
    const keyword = (post.focusKeyword || '').toLowerCase().trim();
    if (!keyword) {
      return { score: null as number | null, badgeClass: 'bg-muted text-muted-foreground' };
    }

    const title = (post.title || '').toLowerCase();
    const slug = (post.slug || '').toLowerCase();
    const content = (post.content || '').toLowerCase();
    const metaDesc = (post.metaDescription || '').toLowerCase();

    let score = 0;
    if (title.includes(keyword)) score += 25;
    if (slug.includes(keyword.replace(/\s+/g, '-'))) score += 15;
    if (metaDesc.includes(keyword)) score += 25;

    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const keywordCount = (content.match(keywordRegex) || []).length;
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

    if (keywordCount >= 1) score += 10;
    if (keywordCount >= 3) score += 10;
    if (density >= 0.5 && density <= 2.5) score += 15;

    const badgeClass = score >= 80
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : score >= 50
        ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
        : 'bg-red-500/15 text-red-600 dark:text-red-400';

    return { score, badgeClass };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast({ title: 'Content is required', variant: 'destructive' });
      return;
    }
    const dataToSend = {
      ...formData,
      publishedAt: formData.status === 'published' && formData.publishedAt
        ? new Date(formData.publishedAt).toISOString()
        : formData.status === 'published'
          ? new Date().toISOString()
          : null,
    };

    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        toast({ title: 'Authentication required', variant: 'destructive' });
        return;
      }

      const uploadResponse = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadResponse.json();

      await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      setFormData(prev => ({ ...prev, featureImageUrl: objectPath }));
      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const toggleServiceSelection = (serviceId: number) => {
    setFormData(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter(id => id !== serviceId)
        : prev.serviceIds.length < 3
          ? [...prev.serviceIds, serviceId]
          : prev.serviceIds,
    }));
  };

  const renderForm = () => {
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

      return {
        score,
        barColor,
        badgeClass,
        checks: {
          inTitle,
          inSlug,
          inMeta,
          hasOneUse,
          hasThreeUses,
          densityOk,
        },
        density,
        keywordCount,
      };
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
          className={clsx(
            isSaved && 'bg-green-600 hover:bg-green-600 text-white'
          )}
          data-testid="button-blog-save"
        >
          {(createMutation.isPending || updateMutation.isPending) && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {isSaved && <Check className="w-4 h-4 mr-2" />}
          {saveLabel}
        </Button>
        {editingPost && formData.slug && (
          <Button
            variant="outline"
            onClick={() => window.open(`/blog/${formData.slug}`, '_blank')}
            className="border-0"
          >
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
            <div className="relative rounded-md bg-background overflow-visible" ref={seoFieldRef}>
              <div className="relative">
                <Input
                  id="focusKeyword"
                  value={formData.focusKeyword}
                  onChange={(e) => setFormData(prev => ({ ...prev, focusKeyword: e.target.value }))}
                  placeholder="Primary SEO keyword"
                  className="pr-14 rounded-none border-0 bg-transparent"
                  data-testid="input-blog-keyword"
                  onFocus={() => setIsSeoChecklistOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsSeoChecklistOpen(false);
                  }}
                />
                {focusScore && (
                  <button
                    type="button"
                    className={clsx(
                      "absolute right-2 top-1/2 -translate-y-1/2 flex h-5 items-center rounded-full px-2 text-[10px] font-medium leading-none",
                      focusScore.badgeClass
                    )}
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
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.inTitle ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.inTitle ? "text-foreground" : ""}>
                          Focus keyword in title
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.inSlug ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.inSlug ? "text-foreground" : ""}>
                          Focus keyword in slug
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.inMeta ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.inMeta ? "text-foreground" : ""}>
                          Focus keyword in meta description
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.hasOneUse ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.hasOneUse ? "text-foreground" : ""}>
                          Keyword appears at least once in content
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.hasThreeUses ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.hasThreeUses ? "text-foreground" : ""}>
                          Keyword appears 3+ times in content
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={focusScore.checks.densityOk ? "text-green-600" : "text-muted-foreground"}>•</span>
                        <span className={focusScore.checks.densityOk ? "text-foreground" : ""}>
                          Keyword density between 0.5% and 2.5%
                        </span>
                      </li>
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
                <button
                  key={tag}
                  type="button"
                  onClick={() => setEditorBlock(tag as 'p' | 'h1' | 'h2' | 'h3' | 'h4')}
                  className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
                >
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border/60" />
              <button
                type="button"
                onClick={() => runEditorCommand('bold')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Bold
              </button>
              <button
                type="button"
                onClick={() => runEditorCommand('italic')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => runEditorCommand('insertUnorderedList')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Bulleted list
              </button>
              <button
                type="button"
                onClick={() => runEditorCommand('insertOrderedList')}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Numbered list
              </button>
              <button
                type="button"
                onClick={insertEditorLink}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Link
              </button>
              <button
                type="button"
                onClick={clearEditorFormatting}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={openHtmlEditor}
                className="h-8 rounded-md px-2 text-foreground hover:bg-muted"
              >
                HTML
              </button>
            </div>
            <div
              id="content"
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck
              onInput={syncEditorContent}
              onBlur={syncEditorContent}
              onPaste={(e) => {
                const htmlData = e.clipboardData.getData('text/html');
                const text = e.clipboardData.getData('text/plain');

                // If HTML is available, use it directly
                if (htmlData && htmlData.trim()) {
                  e.preventDefault();
                  // Clean up common formatting from external sources
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

                // Otherwise, detect if plain text looks like Markdown
                if (text && (
                  text.includes('# ') ||
                  text.includes('## ') ||
                  text.includes('**') ||
                  text.includes('* ') ||
                  text.match(/^\d+\. /m) ||
                  text.includes('[') && text.includes('](')
                )) {
                  e.preventDefault();
                  const html = markdownToHtml(text);
                  document.execCommand('insertHTML', false, html);
                  syncEditorContent();
                  return;
                }

                // If plain text looks like HTML, insert as HTML
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
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={handleInsertLink}>
                  Apply
                </Button>
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
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="button" onClick={applyHtmlEditor}>
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <p className="text-xs text-muted-foreground">
            Paste HTML or Markdown — auto-converts and formats!
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="metaDescription">Meta Description</Label>
            <Textarea
              id="metaDescription"
              value={formData.metaDescription}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                metaDescription: e.target.value.slice(0, 155)
              }))}
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
                  <img
                    src={formData.featureImageUrl}
                    alt="Feature"
                    className="w-full h-full object-cover"
                    data-testid="img-blog-feature-preview"
                  />
                  <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                    Uploaded
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Click to change</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, featureImageUrl: '' }));
                    }}
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
              <input
                id="featureImageInput"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                data-testid="input-blog-feature-image"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 min-h-9 rounded-md bg-background px-3 py-2">
              {formData.tags.split(',').filter(t => t.trim()).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
                >
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
                      setFormData(prev => ({
                        ...prev,
                        tags: prev.tags ? `${prev.tags},${newTag}` : newTag
                      }));
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
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      >
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
                {services?.filter(s =>
                  !s.isHidden &&
                  s.name.toLowerCase().includes(serviceSearch.toLowerCase())
                ).map(service => (
                  <div
                    key={service.id}
                    className="flex items-center gap-2"
                  >
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
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
            >
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
                  className={clsx(
                    "flex h-9 w-full items-center justify-between rounded-md bg-background px-3 py-2 text-sm",
                    !publishedDate && "text-muted-foreground"
                  )}
                  data-testid="input-blog-date"
                >
                  <span className="truncate">
                    {publishedDate ? format(publishedDate, "MM/dd/yyyy") : "Select date"}
                  </span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto rounded-2xl border-0 p-0 shadow-lg overflow-hidden"
                align="end"
                side="bottom"
                sideOffset={8}
              >
                <CalendarPicker
                  mode="single"
                  selected={publishedDate}
                  onSelect={(date) =>
                    setFormData(prev => ({
                      ...prev,
                      publishedAt: date ? format(date, "yyyy-MM-dd") : null
                    }))
                  }
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
          <Button
            type="button"
            variant="ghost"
            onClick={handleBackToPosts}
            data-testid="button-blog-back-bottom"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Posts
          </Button>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:gap-3">
            {actionButtons}
          </div>
        </div>
      </form>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isCreateOpen || editingPost) {
    const saveLabel = isSaved ? 'Saved' : editingPost ? 'Update Post' : 'Create Post';
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToPosts}
              data-testid="button-blog-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Posts
            </Button>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:gap-3">
            <Button
              type="submit"
              form="blog-post-form"
              size="sm"
              disabled={createMutation.isPending || updateMutation.isPending}
              className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
              data-testid="button-blog-save-top"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {isSaved && <Check className="w-4 h-4 mr-2" />}
              {saveLabel}
            </Button>
            {editingPost && formData.slug && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/blog/${formData.slug}`, '_blank')}
                className="border-0"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Post
              </Button>
            )}
          </div>
        </div>
        <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
          {renderForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-blog-title">{blogMenuTitle}</h1>
          <p className="text-sm text-muted-foreground">Manage your blog content and SEO</p>
        </div>
        <div className="flex bg-muted rounded-lg p-1 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === 'posts'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Posts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              activeTab === 'settings'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Settings
          </button>
        </div>
      </div>

      {activeTab === 'posts' ? (
        <div className="space-y-6">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-none">
              <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full sm:w-auto justify-start px-2 -ml-2 text-muted-foreground hover:text-foreground">
                    <Tag className="w-4 h-4 mr-2" />
                    Manage Tags
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md border-0">
                  <DialogHeader>
                    <DialogTitle>Manage Tags</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {availableTags.length > 0 ? (
                      availableTags.map((tag) => (
                        <div
                          key={tag}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2"
                          onDoubleClick={() => handleStartEditTag(tag)}
                        >
                          {editingTag === tag ? (
                            <Input
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSubmitEditTag();
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  handleCancelEditTag();
                                }
                              }}
                              onBlur={handleSubmitEditTag}
                              autoFocus
                              className="h-8 border-0 bg-transparent px-0 text-sm"
                              data-testid={`input-tag-edit-${tag}`}
                            />
                          ) : (
                            <span className="text-sm font-medium">{tag}</span>
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleStartEditTag(tag)}
                              disabled={isDeletingTag || isRenamingTag}
                              data-testid={`button-tag-edit-${tag}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setTagToDelete(tag)}
                              disabled={isDeletingTag || editingTag === tag || isRenamingTag}
                              data-testid={`button-tag-delete-${tag}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tags available.</p>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">Close</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-blog-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title-asc">Title (A-Z)</SelectItem>
                  <SelectItem value="title-desc">Title (Z-A)</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full sm:w-auto" onClick={(e) => {
                e.preventDefault();
                setIsCreateOpen(true);
              }} data-testid="button-blog-create">
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
            </div>
          </div>

          <div className="bg-muted p-3 sm:p-6 rounded-lg space-y-6 transition-all">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Posts
            </h2>
            {sortedPosts && sortedPosts.length > 0 ? (
              <div className="space-y-3">
                {sortedPosts.map(post => {
                  const seoScore = getPostSeoScore(post);
                  return (
                    <div key={post.id} className="flex flex-col gap-3 p-3 bg-card/90 dark:bg-slate-900/70 rounded-lg overflow-hidden border border-transparent hover:border-border/50 transition-all shadow-sm" data-testid={`row-blog-${post.id}`}>
                      {/* Top Row: Image + Title + Date */}
                      <div className="flex items-start gap-3">
                        {post.featureImageUrl ? (
                          <img
                            src={post.featureImageUrl}
                            alt={post.title}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity shrink-0 bg-muted"
                            onClick={() => handleEdit(post)}
                            data-testid={`img-blog-${post.id}`}
                          />
                        ) : (
                          <div
                            className="w-16 h-16 sm:w-20 sm:h-20 bg-muted rounded-md flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors shrink-0"
                            onClick={() => handleEdit(post)}
                          >
                            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/50" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-16 sm:h-20 py-0.5">
                          <div>
                            <h3
                              className="font-medium text-sm sm:text-base line-clamp-2 leading-tight cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleEdit(post)}
                              data-testid={`text-blog-title-${post.id}`}
                            >
                              {post.title}
                            </h3>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {post.publishedAt ? format(new Date(post.publishedAt), 'MMM d, yyyy') : 'Not published'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Bottom Row: Badges and Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                          <div
                            className={clsx(
                              "flex items-center h-6 rounded-full px-2 text-[10px] sm:text-[11px] font-medium shrink-0",
                              seoScore.badgeClass
                            )}
                            data-testid={`badge-blog-seo-${post.id}`}
                          >
                            SEO {seoScore.score === null ? '—' : `${seoScore.score}`}
                          </div>
                          <Badge
                            variant={post.status === 'published' ? 'default' : 'secondary'}
                            className="h-6 rounded-full px-2 text-[10px] sm:text-[11px] leading-none flex items-center shrink-0"
                            data-testid={`badge-blog-status-${post.id}`}
                          >
                            {post.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(post)}
                            data-testid={`button-blog-edit-${post.id}`}
                            className="h-8 w-8 hover:bg-muted"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-blog-delete-${post.id}`} className="h-8 w-8 hover:bg-muted">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Blog Post?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{post.title}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(post.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No blog posts yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first blog post to engage your audience
                </p>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-blog-first-post">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <BlogSettings />
      )}
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag</AlertDialogTitle>
            <AlertDialogDescription>
              {tagToDelete
                ? `Remove "${tagToDelete}" from all posts? This cannot be undone.`
                : 'Remove this tag from all posts?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTag}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveTag} disabled={isDeletingTag}>
              {isDeletingTag ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

