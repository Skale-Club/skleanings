
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { insertServiceAreaSchema } from "@shared/schema";

const router = Router();

// Service Areas (public GET, admin CRUD)
router.get('/', async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
        const areas = await storage.getServiceAreas(includeInactive);
        res.json(areas);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertServiceAreaSchema.parse(req.body);
        const area = await storage.createServiceArea(validatedData);
        res.status(201).json(area);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertServiceAreaSchema.partial().parse(req.body);
        const area = await storage.updateServiceArea(Number(req.params.id), validatedData);
        res.json(area);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteServiceArea(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

router.post('/reorder', requireAdmin, async (req, res) => {
    try {
        const updates = req.body as { id: number; order: number }[];
        await storage.reorderServiceAreas(updates);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// === Service Area Groups (Hierarchical) ===
router.get('/groups', async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
        const groups = await storage.getServiceAreaGroups(includeInactive);
        res.json(groups);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/groups', requireAdmin, async (req, res) => {
    try {
        const validatedData = z.object({
            name: z.string().min(1),
            slug: z.string().min(1),
            description: z.string().optional(),
            order: z.number().default(0),
            isActive: z.boolean().default(true),
        }).parse(req.body);
        const group = await storage.createServiceAreaGroup(validatedData);
        res.status(201).json(group);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/groups/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = z.object({
            name: z.string().min(1).optional(),
            slug: z.string().min(1).optional(),
            description: z.string().optional(),
            order: z.number().optional(),
            isActive: z.boolean().optional(),
        }).parse(req.body);
        const group = await storage.updateServiceAreaGroup(Number(req.params.id), validatedData);
        res.json(group);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/groups/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteServiceAreaGroup(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

router.post('/groups/reorder', requireAdmin, async (req, res) => {
    try {
        const updates = req.body as { id: number; order: number }[];
        await storage.reorderServiceAreaGroups(updates);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

// === Service Area Cities (Hierarchical) ===
router.get('/cities', async (req, res) => {
    try {
        const groupId = req.query.groupId ? Number(req.query.groupId) : undefined;
        const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
        const cities = await storage.getServiceAreaCities(groupId, includeInactive);
        res.json(cities);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/cities', requireAdmin, async (req, res) => {
    try {
        const validatedData = z.object({
            areaGroupId: z.number(),
            name: z.string().min(1),
            zipcode: z.string().optional(),
            order: z.number().default(0),
            isActive: z.boolean().default(true),
        }).parse(req.body);
        const city = await storage.createServiceAreaCity(validatedData);
        res.status(201).json(city);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/cities/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = z.object({
            areaGroupId: z.number().optional(),
            name: z.string().min(1).optional(),
            zipcode: z.string().optional(),
            order: z.number().optional(),
            isActive: z.boolean().optional(),
        }).parse(req.body);
        const city = await storage.updateServiceAreaCity(Number(req.params.id), validatedData);
        res.json(city);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/cities/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteServiceAreaCity(Number(req.params.id));
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

router.post('/cities/reorder', requireAdmin, async (req, res) => {
    try {
        const updates = req.body as { id: number; order: number }[];
        await storage.reorderServiceAreaCities(updates);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

export default router;
