import { useState } from 'react';
import type { Category } from '@shared/schema';
import { authenticatedRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

export function CategoryForm({ category, onSubmit, isLoading, getAccessToken }: {
  category: Category | null;
  onSubmit: (data: { name: string; slug: string; description: string; imageUrl: string }) => void;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || '');

  const generateSlug = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const token = await getAccessToken();
      if (!token) { console.error('Authentication required'); return; }
      const uploadRes = await authenticatedRequest('POST', '/api/upload', token);
      const { uploadURL, objectPath } = await uploadRes.json() as { uploadURL: string; objectPath: string };
      const uploadFetchRes = await fetch(uploadURL, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!uploadFetchRes.ok) throw new Error('Upload to storage failed');
      setImageUrl(objectPath);
    } catch (err) {
      console.error('Upload failed', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, slug: generateSlug(name), description, imageUrl });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{category ? 'Edit Category' : 'Add Category'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-category-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="input-category-description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Category Image</Label>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Or URL:</span>
              <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="h-8 text-xs" data-testid="input-category-image" />
            </div>
            {imageUrl && (
              <div className="relative w-48 aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-border cursor-pointer group" onClick={() => document.getElementById('categoryImageUpload')?.click()}>
                <img src={imageUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-white mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-white text-xs font-medium">Click to upload</p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">4:3 Preview</div>
              </div>
            )}
            <Input id="categoryImageUpload" type="file" accept="image/*" onChange={handleImageUpload} data-testid="input-category-image-upload" className="hidden" />
          </div>
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" type="button" className="border-0">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading} data-testid="button-save-category" className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {category ? 'Update' : 'Create'}
        </Button>
      </DialogFooter>
    </form>
  );
}
