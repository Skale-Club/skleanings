import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin, supabase } from "../lib/auth";
import { storageService } from "../services/storage";
import { insertCompanySettingsSchema } from "@shared/schema";

const router = Router();

// Upload endpoint using Supabase Storage
router.post("/upload", requireAdmin, async (req, res) => {
    try {
        // Generate a unique filename
        const filename = `uploads/${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Return signed upload URL from Supabase using the correct bucket
        const bucketName = process.env.SUPABASE_BUCKET_NAME || 'uploads';
        const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUploadUrl(filename);

        if (error) {
            console.error("Supabase upload URL error:", error);
            throw error;
        }

        res.json({
            uploadURL: data.signedUrl,
            objectPath: storageService.getPublicUrl(bucketName, filename)
        });
    } catch (error: any) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Failed to generate upload URL", details: error.message });
    }
});

// Company Settings (public GET, admin PUT)
router.get('/api/company-settings', async (req, res) => {
    try {
        const settings = await storage.getCompanySettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put('/api/company-settings', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertCompanySettingsSchema.partial().parse(req.body);
        const settings = await storage.updateCompanySettings(validatedData);
        res.json(settings);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

// Robots.txt endpoint
router.get('/robots.txt', async (req, res) => {
    try {
        const settings = await storage.getCompanySettings();
        const canonicalUrl = settings?.seoCanonicalUrl || `https://${req.get('host')}`;

        const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${canonicalUrl}/sitemap.xml
`;
        res.type('text/plain').send(robotsTxt);
    } catch (err) {
        res.type('text/plain').send('User-agent: *\nAllow: /');
    }
});

// Sitemap.xml endpoint
router.get('/sitemap.xml', async (req, res) => {
    try {
        const settings = await storage.getCompanySettings();
        const categories = await storage.getCategories();
        const blogPostsList = await storage.getPublishedBlogPosts(100, 0);
        // Remove trailing slash from canonical URL to prevent double slashes
        const baseUrl = (settings?.seoCanonicalUrl || `https://${req.get('host')}`).replace(/\/$/, '');
        const lastMod = new Date().toISOString().split('T')[0];

        // Static pages with their priorities and change frequencies
        const staticPages = [
            { url: '/', priority: '1.0', changefreq: 'weekly' },
            { url: '/services', priority: '0.9', changefreq: 'weekly' },
            { url: '/booking', priority: '0.9', changefreq: 'monthly' },
            { url: '/service-areas', priority: '0.8', changefreq: 'monthly' },
            { url: '/about', priority: '0.8', changefreq: 'monthly' },
            { url: '/team', priority: '0.7', changefreq: 'monthly' },
            { url: '/contact', priority: '0.8', changefreq: 'monthly' },
            { url: '/faq', priority: '0.7', changefreq: 'monthly' },
            { url: '/blog', priority: '0.8', changefreq: 'weekly' },
            { url: '/privacy-policy', priority: '0.5', changefreq: 'yearly' },
            { url: '/terms-of-service', priority: '0.5', changefreq: 'yearly' },
        ];

        let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        // Add static pages
        for (const page of staticPages) {
            sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
        }

        // Add category pages
        for (const category of categories) {
            sitemap += `
  <url>
    <loc>${baseUrl}/services/${category.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
        }

        // Add blog posts
        for (const post of blogPostsList) {
            const postDate = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : lastMod;
            sitemap += `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${postDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
        }

        sitemap += `
</urlset>`;

        res.type('application/xml').send(sitemap);
    } catch (err) {
        res.status(500).send('Error generating sitemap');
    }
});

export default router;
