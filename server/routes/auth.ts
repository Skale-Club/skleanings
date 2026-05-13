
import { Router } from "express";
import { getAuthenticatedUser } from "../lib/auth";

const router = Router();

// Check admin session status - uses Supabase Auth
router.get('/admin/session', async (req, res) => {
    const storage = res.locals.storage!;
    try {
        const user = await getAuthenticatedUser(req, storage);
        if (!user) {
            return res.json({ isAdmin: false });
        }

        const isAdmin = user.role === "admin";

        res.json({
            isAdmin,
            email: user.email || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null
        });
    } catch (error) {
        res.json({ isAdmin: false });
    }
});

export default router;
