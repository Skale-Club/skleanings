
import { Router } from "express";
import { supabase } from "../lib/auth";

const router = Router();

// Check admin session status - uses Supabase Auth
router.get('/admin/session', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.json({ isAdmin: false });
    }

    const token = authHeader.split('Bearer ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.json({ isAdmin: false });
        }

        const adminEmail = process.env.ADMIN_EMAIL || '';
        const isAdmin = user.email === adminEmail;

        res.json({
            isAdmin,
            email: user.email || null,
            firstName: user.user_metadata?.first_name || null,
            lastName: user.user_metadata?.last_name || null
        });
    } catch (error) {
        res.json({ isAdmin: false });
    }
});

export default router;
