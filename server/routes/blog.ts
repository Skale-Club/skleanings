
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { insertBlogPostSchema, insertBlogSettingsSchema } from "@shared/schema";
import { BlogGenerator } from "../services/blog-generator";

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

// Blog Posts (public GET, admin CRUD)
router.get('/', async (req, res) => {
    try {
        const status = req.query.status as string | undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const offset = req.query.offset ? Number(req.query.offset) : 0;

        if (status === 'published' && limit) {
            const posts = await storage.getPublishedBlogPosts(limit, offset);
            res.json(posts);
        } else if (status) {
            const posts = await storage.getBlogPosts(status);
            res.json(posts);
        } else {
            const posts = await storage.getBlogPosts();
            res.json(posts);
        }
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.get('/count', async (req, res) => {
    try {
        const count = await storage.countPublishedBlogPosts();
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
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

router.get('/:idOrSlug', async (req, res) => {
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
        res.json(post);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.get('/:id/services', async (req, res) => {
    try {
        const services = await storage.getBlogPostServices(Number(req.params.id));
        res.json(services);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.get('/:id/related', async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : 4;
        const posts = await storage.getRelatedBlogPosts(Number(req.params.id), limit);
        res.json(posts);
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
