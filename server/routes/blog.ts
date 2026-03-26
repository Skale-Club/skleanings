
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { insertBlogPostSchema, insertBlogSettingsSchema } from "@shared/schema";
import { BlogGenerator } from "../services/blog-generator";
import {
    getFallbackBlogPost,
    getFallbackBlogPostServices,
    getFallbackPublishedBlogPosts,
    getFallbackRelatedBlogPosts,
} from "../lib/public-data-fallback";

const router = Router();

// Blog Settings Routes
router.get('/settings', requireAdmin, async (_req, res) => {
    try {
        const settings = await storage.getBlogSettings();
        res.json(settings || {
            enabled: false,
            postsPerDay: 1,
            seoKeywords: "",
            promptStyle: "",
            enableTrendAnalysis: true
        });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put('/settings', requireAdmin, async (req, res) => {
    try {
        const payload = insertBlogSettingsSchema.parse(req.body);
        const settings = await storage.upsertBlogSettings(payload);
        res.json(settings);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: err.errors });
        }
        res.status(500).json({ message: (err as Error).message });
    }
});

// Blog Posts (public GET returns only published, admin can see all)
router.get('/', async (req, res) => {
    if (process.env.VERCEL) {
        try {
            const status = req.query.status as string | undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const offset = req.query.offset ? Number(req.query.offset) : 0;

            if (!status) {
                return res.json(await getFallbackPublishedBlogPosts(limit ?? 100, offset));
            }

            if (status === 'published') {
                return res.json(await getFallbackPublishedBlogPosts(limit ?? 10, offset));
            }

            return res.json([]);
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for posts.", fallbackErr);
            return res.json([]);
        }
    }

    try {
        const status = req.query.status as string | undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const offset = req.query.offset ? Number(req.query.offset) : 0;

        // Public requests default to published only
        // If no status specified, return only published posts (prevent draft leakage)
        if (!status) {
            const posts = await storage.getBlogPosts('published');
            res.json(posts);
        } else if (status === 'published' && limit) {
            const posts = await storage.getPublishedBlogPosts(limit, offset);
            res.json(posts);
        } else {
            // Non-published status requests should require admin (handled by storage layer or add middleware)
            const posts = await storage.getBlogPosts(status);
            res.json(posts);
        }
    } catch (err) {
        console.error("[blog] Failed to load posts. Check DB schema/migrations.", err);
        try {
            const status = req.query.status as string | undefined;
            const limit = req.query.limit ? Number(req.query.limit) : undefined;
            const offset = req.query.offset ? Number(req.query.offset) : 0;

            if (!status) {
                return res.json(await getFallbackPublishedBlogPosts(limit ?? 100, offset));
            }

            if (status === 'published') {
                return res.json(await getFallbackPublishedBlogPosts(limit ?? 10, offset));
            }

            res.json([]);
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for posts.", fallbackErr);
            res.json([]);
        }
    }
});

router.get('/count', async (req, res) => {
    if (process.env.VERCEL) {
        try {
            const posts = await getFallbackPublishedBlogPosts(1000, 0);
            return res.json({ count: posts.length });
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for post count.", fallbackErr);
            return res.json({ count: 0 });
        }
    }

    try {
        const count = await storage.countPublishedBlogPosts();
        res.json({ count });
    } catch (err) {
        console.error("[blog] Failed to count posts. Check DB schema/migrations.", err);
        try {
            const posts = await getFallbackPublishedBlogPosts(1000, 0);
            res.json({ count: posts.length });
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for post count.", fallbackErr);
            res.json({ count: 0 });
        }
    }
});

router.delete('/tags/:tag', requireAdmin, async (req, res) => {
    try {
        const rawTag = decodeURIComponent(req.params.tag || '').trim();
        if (!rawTag) {
            return res.status(400).json({ message: 'Tag is required' });
        }
        const posts = await storage.getBlogPosts();
        const target = rawTag.toLowerCase();
        let updatedCount = 0;
        for (const post of posts) {
            const tags = (post.tags || '')
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
            if (!tags.length) continue;
            const filtered = tags.filter(tag => tag.toLowerCase() !== target);
            if (filtered.length !== tags.length) {
                await storage.updateBlogPost(post.id, { tags: filtered.join(',') });
                updatedCount += 1;
            }
        }
        res.json({ success: true, tag: rawTag, updatedCount });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/tags/:tag', requireAdmin, async (req, res) => {
    try {
        const rawTag = decodeURIComponent(req.params.tag || '').trim();
        const nextTag = String(req.body?.name || '').trim();
        if (!rawTag || !nextTag) {
            return res.status(400).json({ message: 'Tag and new name are required' });
        }
        const fromLower = rawTag.toLowerCase();
        const toLower = nextTag.toLowerCase();
        const posts = await storage.getBlogPosts();
        let updatedCount = 0;

        for (const post of posts) {
            const tags = (post.tags || '')
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
            if (!tags.length) continue;

            const seen = new Set<string>();
            let changed = false;
            const nextTags: string[] = [];

            for (const tag of tags) {
                const lower = tag.toLowerCase();
                if (lower === fromLower) {
                    changed = true;
                    if (!seen.has(toLower)) {
                        seen.add(toLower);
                        nextTags.push(nextTag);
                    }
                    continue;
                }
                if (!seen.has(lower)) {
                    seen.add(lower);
                    nextTags.push(tag);
                }
            }

            if (changed) {
                await storage.updateBlogPost(post.id, { tags: nextTags.join(',') });
                updatedCount += 1;
            }
        }

        res.json({ success: true, tag: rawTag, renamedTo: nextTag, updatedCount });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Get single post by ID or slug - public only sees published posts
router.get('/:idOrSlug', async (req, res) => {
    if (process.env.VERCEL) {
        try {
            const param = req.params.idOrSlug;
            const post = /^\d+$/.test(param)
                ? await getFallbackBlogPost(Number(param))
                : await getFallbackBlogPost(param);

            if (!post || post.status !== 'published') {
                return res.status(404).json({ message: 'Blog post not found' });
            }

            return res.json(post);
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for single post.", fallbackErr);
            return res.status(500).json({ message: 'Failed to load blog post' });
        }
    }

    try {
        const param = req.params.idOrSlug;
        let post;

        if (/^\d+$/.test(param)) {
            post = await storage.getBlogPost(Number(param));
        } else {
            post = await storage.getBlogPostBySlug(param);
        }

        if (!post) {
            return res.status(404).json({ message: 'Blog post not found' });
        }

        // Prevent draft leakage: only return published posts for public access
        // Admin users can access drafts via the admin API endpoints
        if (post.status !== 'published') {
            return res.status(404).json({ message: 'Blog post not found' });
        }

        res.json(post);
    } catch (err) {
        try {
            const param = req.params.idOrSlug;
            const post = /^\d+$/.test(param)
                ? await getFallbackBlogPost(Number(param))
                : await getFallbackBlogPost(param);

            if (!post || post.status !== 'published') {
                return res.status(404).json({ message: 'Blog post not found' });
            }

            res.json(post);
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for single post.", fallbackErr);
            res.status(500).json({ message: (err as Error).message });
        }
    }
});

router.get('/:id/services', async (req, res) => {
    if (process.env.VERCEL) {
        try {
            return res.json(await getFallbackBlogPostServices(Number(req.params.id)));
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for related services.", fallbackErr);
            return res.json([]);
        }
    }

    try {
        const services = await storage.getBlogPostServices(Number(req.params.id));
        res.json(services);
    } catch (err) {
        console.error("[blog] Failed to load related services. Check DB schema/migrations.", err);
        try {
            res.json(await getFallbackBlogPostServices(Number(req.params.id)));
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for related services.", fallbackErr);
            res.json([]);
        }
    }
});

// Get related posts - only published posts
router.get('/:id/related', async (req, res) => {
    if (process.env.VERCEL) {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 4;
            return res.json(await getFallbackRelatedBlogPosts(Number(req.params.id), limit));
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for related posts.", fallbackErr);
            return res.json([]);
        }
    }

    try {
        const limit = req.query.limit ? Number(req.query.limit) : 4;
        const posts = await storage.getRelatedBlogPosts(Number(req.params.id), limit);
        res.json(posts);
    } catch (err) {
        console.error("[blog] Failed to load related posts. Check DB schema/migrations.", err);
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 4;
            res.json(await getFallbackRelatedBlogPosts(Number(req.params.id), limit));
        } catch (fallbackErr) {
            console.error("[blog] Supabase fallback failed for related posts.", fallbackErr);
            res.json([]);
        }
    }
});

// Admin endpoint to get any post by ID (including drafts) for editing
router.get('/admin/:id', requireAdmin, async (req, res) => {
    try {
        const post = await storage.getBlogPost(Number(req.params.id));
        if (!post) {
            return res.status(404).json({ message: 'Blog post not found' });
        }
        res.json(post);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertBlogPostSchema.parse(req.body);
        const post = await storage.createBlogPost(validatedData);
        res.status(201).json(post);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertBlogPostSchema.partial().parse(req.body);
        const post = await storage.updateBlogPost(Number(req.params.id), validatedData);
        res.json(post);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteBlogPost(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Manual trigger for blog generation (Admin only)
router.post('/generate', requireAdmin, async (req, res) => {
    try {
        const manual = req.body.manual === true;
        const result = await BlogGenerator.startDailyPostGeneration({ manual });
        res.json({ success: true, post: result });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

export default router;
