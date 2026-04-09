import { Router } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.post("/register", async (req, res) => {
    // ... validation ...
    const newUser = await storage.createUser({ ...req.body, isAdmin: false });
    res.status(201).json(newUser);
});

// GET /api/me — returns current user's role and linked staffMemberId
router.get("/me", requireAdmin, async (req, res) => {
  try {
    const supabaseUser = (req as any).user;
    if (!supabaseUser?.email) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const dbUser = await storage.getUserByEmail(supabaseUser.email);
    if (!dbUser) {
      return res.json({
        id: supabaseUser.id,
        email: supabaseUser.email,
        role: "viewer",
        staffMemberId: null,
      });
    }

    const allStaff = await storage.getStaffMembers(true);
    const linked = allStaff.find(s => s.userId === dbUser.id);

    return res.json({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role ?? "viewer",
      staffMemberId: linked?.id ?? null,
    });
  } catch (error) {
    console.error("Error fetching /api/me:", error);
    return res.status(500).json({ message: "Failed to fetch user profile" });
  }
});

export default router;
