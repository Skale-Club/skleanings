
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { api } from "@shared/routes";
import {
    insertCategorySchema,
    insertSubcategorySchema,
    insertServiceSchema
} from "@shared/schema";
import { invalidateChatCache } from "./chat/tools";

const router = Router();

// Categories
router.get(api.categories.list.path, async (req, res) => {
    const categories = await storage.getCategories();
    res.json(categories);
});

router.get(api.categories.get.path, async (req, res) => {
    const category = await storage.getCategoryBySlug(req.params.slug);
    if (!category) return res.status(404).json({ message: "Category not found" });
    res.json(category);
});

// Admin Category CRUD (protected routes)
router.post('/api/categories', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertCategorySchema.parse(req.body);
        const category = await storage.createCategory(validatedData);
        res.status(201).json(category);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/api/categories/reorder', requireAdmin, async (req, res) => {
    try {
        const orderData = z.array(z.object({
            id: z.number(),
            order: z.number()
        })).parse(req.body.order);

        for (const item of orderData) {
            await storage.updateCategory(item.id, { order: item.order });
        }

        res.json({ success: true });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/api/categories/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertCategorySchema.partial().parse(req.body);
        const category = await storage.updateCategory(Number(req.params.id), validatedData);
        res.json(category);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/api/categories/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteCategory(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Subcategories
router.get('/api/subcategories', async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const subcategories = await storage.getSubcategories(categoryId);
    res.json(subcategories);
});

router.post('/api/subcategories', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertSubcategorySchema.parse(req.body);
        const subcategory = await storage.createSubcategory(validatedData);
        res.status(201).json(subcategory);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/api/subcategories/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertSubcategorySchema.partial().parse(req.body);
        const subcategory = await storage.updateSubcategory(Number(req.params.id), validatedData);
        res.json(subcategory);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/api/subcategories/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteSubcategory(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Services
router.get(api.services.list.path, async (req, res) => {
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const subcategoryId = req.query.subcategoryId ? Number(req.query.subcategoryId) : undefined;
    const includeHidden = req.query.includeHidden === 'true';
    // When not including hidden (admin view), only show services that should appear on landing page
    const showOnLanding = includeHidden ? undefined : true;
    const services = await storage.getServices(categoryId, subcategoryId, includeHidden, showOnLanding);
    res.json(services);
});

// Admin Service CRUD (protected routes)
router.post('/api/services', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertServiceSchema.parse(req.body);
        const service = await storage.createService(validatedData);
        invalidateChatCache('services');
        res.status(201).json(service);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/api/services/reorder', requireAdmin, async (req, res) => {
    try {
        const orderData = z.array(z.object({
            id: z.number(),
            order: z.number()
        })).parse(req.body.order);

        await storage.reorderServices(orderData);
        invalidateChatCache('services');
        const updated = await storage.getServices(undefined, undefined, true);
        res.json(updated);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.get('/api/services/:id', async (req, res) => {
    try {
        const service = await storage.getService(Number(req.params.id));
        if (!service) return res.status(404).json({ message: "Service not found" });
        res.json(service);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put('/api/services/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertServiceSchema.partial().parse(req.body);
        const service = await storage.updateService(Number(req.params.id), validatedData);
        invalidateChatCache('services');
        res.json(service);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/api/services/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteService(Number(req.params.id));
        invalidateChatCache('services');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// Service Addons
router.get('/api/services/:id/addons', async (req, res) => {
    const addons = await storage.getServiceAddons(Number(req.params.id));
    res.json(addons);
});

router.put('/api/services/:id/addons', requireAdmin, async (req, res) => {
    try {
        const addonIds = z.array(z.number()).parse(req.body.addonIds);
        await storage.setServiceAddons(Number(req.params.id), addonIds);
        res.json({ success: true });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid addon IDs' });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.get('/api/service-addons', requireAdmin, async (req, res) => {
    const relationships = await storage.getAddonRelationships();
    res.json(relationships);
});

// Service Options (for base_plus_addons pricing)
router.get('/api/services/:id/options', async (req, res) => {
    try {
        const options = await storage.getServiceOptions(Number(req.params.id));
        res.json(options);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put('/api/services/:id/options', requireAdmin, async (req, res) => {
    try {
        const optionsSchema = z.array(z.object({
            name: z.string().min(1),
            price: z.string(),
            maxQuantity: z.number().optional(),
            order: z.number().optional(),
        }));
        const options = optionsSchema.parse(req.body.options || []);
        const result = await storage.setServiceOptions(Number(req.params.id), options);
        res.json(result);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

// Service Frequencies (for base_plus_addons pricing)
router.get('/api/services/:id/frequencies', async (req, res) => {
    try {
        const frequencies = await storage.getServiceFrequencies(Number(req.params.id));
        res.json(frequencies);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.put('/api/services/:id/frequencies', requireAdmin, async (req, res) => {
    try {
        const frequenciesSchema = z.array(z.object({
            name: z.string().min(1),
            discountPercent: z.string().optional(),
            order: z.number().optional(),
        }));
        const frequencies = frequenciesSchema.parse(req.body.frequencies || []);
        const result = await storage.setServiceFrequencies(Number(req.params.id), frequencies);
        res.json(result);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

export default router;
