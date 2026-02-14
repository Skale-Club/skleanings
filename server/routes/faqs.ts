
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";
import { insertFaqSchema } from "@shared/schema";
import { invalidateChatCache } from "./chat/tools";

const router = Router();

// FAQs (public GET, admin CRUD)
router.get('/', async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
        const faqList = await storage.getFaqs(includeInactive);
        res.json(faqList);
    } catch (err) {
        res.status(500).json({ message: (err as Error).message });
    }
});

router.post('/', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertFaqSchema.parse(req.body);
        const faq = await storage.createFaq(validatedData);
        invalidateChatCache('faqs');
        res.status(201).json(faq);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const validatedData = insertFaqSchema.partial().parse(req.body);
        const faq = await storage.updateFaq(Number(req.params.id), validatedData);
        invalidateChatCache('faqs');
        res.json(faq);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ message: 'Validation error', errors: err.errors });
        }
        res.status(400).json({ message: (err as Error).message });
    }
});

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await storage.deleteFaq(Number(req.params.id));
        invalidateChatCache('faqs');
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ message: (err as Error).message });
    }
});

export default router;
