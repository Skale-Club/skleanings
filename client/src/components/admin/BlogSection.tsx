import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { BlogPost, Service } from '@shared/schema';
import { authenticatedRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import BlogSettings from '@/pages/admin/BlogSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from 'lucide-react';
import { BlogPostEditor } from './blog/BlogPostEditor';

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

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog', 'admin', statusFilter],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await authenticatedRequest('GET', `/api/blog/admin/posts?${params.toString()}`, token);
      return res.json();
    },
  });

  const { data: services } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const sortedPosts = useMemo(() => {
    if (!posts) return [];
    const sorted = [...posts];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.publishedAt || a.createdAt || 0).getTime() - new Date(b.publishedAt || b.createdAt || 0).getTime());
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'status':
        return sorted.sort((a, b) => a.status === b.status ? 0 : a.status === 'published' ? -1 : 1);
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
        if (!tagMap.has(key)) tagMap.set(key, trimmed);
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const selectedTagSet = useMemo(() => {
    return new Set(formData.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  }, [formData.tags]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFormData((prev) => {
      const existing = prev.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return prev;
      return { ...prev, tags: existing.length ? `${existing.join(',')},${trimmed}` : trimmed };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '', slug: '', content: '', excerpt: '', metaDescription: '',
      focusKeyword: '', tags: '', featureImageUrl: '', status: 'published',
      authorName: 'Skleanings', publishedAt: new Date().toISOString().split('T')[0], serviceIds: [],
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

  useEffect(() => {
    if (isSaved) setIsSaved(false);
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

  const runEditorCommand = useCallback((command: string, value?: string) => {
    if (!contentRef.current) return;
    contentRef.current.focus();
    document.execCommand(command, false, value);
    syncEditorContent();
  }, [syncEditorContent]);

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

  const setEditorBlock = useCallback((tag: 'p' | 'h1' | 'h2' | 'h3' | 'h4') => {
    runEditorCommand('formatBlock', `<${tag}>`);
  }, [runEditorCommand]);

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
    if (!url) { setIsLinkDialogOpen(false); return; }
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
    if (!selection || selection.rangeCount === 0) { setIsLinkDialogOpen(false); return; }
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
    setHtmlDraft(contentRef.current ? contentRef.current.innerHTML : formData.content || '');
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
      toast({ title: 'Blog post created successfully' });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      if (response?.id) setEditingPost(response);
    },
    onError: (err: any) => toast({ title: 'Error creating post', description: err.message, variant: 'destructive' }),
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
    onError: (err: any) => toast({ title: 'Error updating post', description: err.message, variant: 'destructive' }),
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
    onError: (err: any) => toast({ title: 'Error deleting post', description: err.message, variant: 'destructive' }),
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
    onError: (err: any) => toast({ title: 'Failed to remove tag', description: err.message, variant: 'destructive' }),
    onSettled: () => { setIsDeletingTag(false); setTagToDelete(null); },
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
    onError: (err: any) => toast({ title: 'Failed to update tag', description: err.message, variant: 'destructive' }),
    onSettled: () => { setIsRenamingTag(false); setEditingTag(null); setEditingTagValue(''); },
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

  const handleCancelEditTag = useCallback(() => { setEditingTag(null); setEditingTagValue(''); }, []);

  const handleSubmitEditTag = useCallback(() => {
    if (!editingTag || isRenamingTag) return;
    const next = editingTagValue.trim();
    if (!next || next === editingTag) { handleCancelEditTag(); return; }
    const hasDuplicate = availableTags.some(
      (tag) => tag.toLowerCase() === next.toLowerCase() && tag.toLowerCase() !== editingTag.toLowerCase()
    );
    if (hasDuplicate) { toast({ title: 'Tag already exists', description: `"${next}" is already in use.` }); return; }
    setIsRenamingTag(true);
    renameTagMutation.mutate({ from: editingTag, to: next });
  }, [editingTag, editingTagValue, isRenamingTag, availableTags, renameTagMutation, toast, handleCancelEditTag]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({ ...prev, title: value, slug: prev.slug || generateSlug(value) }));
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
    if (!keyword) return { score: null as number | null, badgeClass: 'bg-muted text-muted-foreground' };
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
    if (!formData.content.trim()) { toast({ title: 'Content is required', variant: 'destructive' }); return; }
    const dataToSend = {
      ...formData,
      publishedAt: formData.status === 'published' && formData.publishedAt
        ? new Date(formData.publishedAt).toISOString()
        : formData.status === 'published' ? new Date().toISOString() : null,
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
      if (!token) { toast({ title: 'Authentication required', variant: 'destructive' }); return; }
      const uploadResponse = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadResponse.json();
      await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
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
        : prev.serviceIds.length < 3 ? [...prev.serviceIds, serviceId] : prev.serviceIds,
    }));
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const editorProps = {
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
  };

  if (isCreateOpen || editingPost) {
    const saveLabel = isSaved ? 'Saved' : editingPost ? 'Update Post' : 'Create Post';
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToPosts} data-testid="button-blog-back">
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
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isSaved && <Check className="w-4 h-4 mr-2" />}
              {saveLabel}
            </Button>
            {editingPost && formData.slug && (
              <Button variant="outline" size="sm" onClick={() => window.open(`/blog/${formData.slug}`, '_blank')} className="border-0">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Post
              </Button>
            )}
          </div>
        </div>
        <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
          <BlogPostEditor {...editorProps} />
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
            className={clsx("px-3 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'posts' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            Posts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={clsx("px-3 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'settings' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
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
                        <div key={tag} className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2" onDoubleClick={() => handleStartEditTag(tag)}>
                          {editingTag === tag ? (
                            <Input
                              value={editingTagValue}
                              onChange={(e) => setEditingTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleSubmitEditTag(); }
                                if (e.key === 'Escape') { e.preventDefault(); handleCancelEditTag(); }
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
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleStartEditTag(tag)} disabled={isDeletingTag || isRenamingTag} data-testid={`button-tag-edit-${tag}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setTagToDelete(tag)} disabled={isDeletingTag || editingTag === tag || isRenamingTag} data-testid={`button-tag-delete-${tag}`}>
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
              <Select value={statusFilter} onValueChange={(value: typeof statusFilter) => setStatusFilter(value)} data-testid="select-blog-status-filter">
                <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-blog-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Posts</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                </SelectContent>
              </Select>
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
              <Button className="w-full sm:w-auto" onClick={(e) => { e.preventDefault(); setIsCreateOpen(true); }} data-testid="button-blog-create">
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
                      <div className="flex items-start gap-3">
                        {post.featureImageUrl ? (
                          <img
                            src={post.featureImageUrl}
                            alt={post.title}
                            className="w-[85px] sm:w-[107px] aspect-[4/3] object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity shrink-0 bg-muted"
                            onClick={() => handleEdit(post)}
                            data-testid={`img-blog-${post.id}`}
                          />
                        ) : (
                          <div className="w-[85px] sm:w-[107px] aspect-[4/3] bg-muted rounded-md flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors shrink-0" onClick={() => handleEdit(post)}>
                            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-16 sm:h-20 py-0.5">
                          <div>
                            <h3 className="font-medium text-sm sm:text-base line-clamp-2 leading-tight cursor-pointer hover:text-primary transition-colors" onClick={() => handleEdit(post)} data-testid={`text-blog-title-${post.id}`}>
                              {post.title}
                            </h3>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {post.publishedAt ? format(new Date(post.publishedAt), 'MMM d, yyyy') : 'Not published'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right">
                          <div className={clsx("flex items-center h-6 rounded-full px-2 text-[10px] sm:text-[11px] font-medium shrink-0", seoScore.badgeClass)} data-testid={`badge-blog-seo-${post.id}`}>
                            SEO {seoScore.score === null ? '—' : `${seoScore.score}`}
                          </div>
                          <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="h-6 rounded-full px-2 text-[10px] sm:text-[11px] leading-none flex items-center shrink-0" data-testid={`badge-blog-status-${post.id}`}>
                            {post.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(post)} data-testid={`button-blog-edit-${post.id}`} className="h-8 w-8 hover:bg-muted">
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
                                <AlertDialogAction onClick={() => deleteMutation.mutate(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
                <p className="text-sm text-muted-foreground mb-4">Create your first blog post to engage your audience</p>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-blog-first-post">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <BlogSettings getAccessToken={getAccessToken} />
      )}

      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag</AlertDialogTitle>
            <AlertDialogDescription>
              {tagToDelete ? `Remove "${tagToDelete}" from all posts? This cannot be undone.` : 'Remove this tag from all posts?'}
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
