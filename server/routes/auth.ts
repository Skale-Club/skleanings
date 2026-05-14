
import { Router } from "express";
import bcrypt from "bcrypt";
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

// Dummy bcrypt hash for timing-safe comparison when user not found or has no password
const DUMMY_HASH = "$2b$12$invalidhashfortimingneedstobe60charslong1234567890AB";

// POST /api/auth/tenant-login — tenant-scoped credential check
router.post('/auth/tenant-login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  const tenant = res.locals.tenant;
  const storage = res.locals.storage!;

  if (!tenant) {
    return res.status(503).json({ message: "Tenant not resolved" });
  }

  // Look up user scoped to this tenant (storage is already tenant-scoped via res.locals.storage)
  const user = await storage.getUserByEmail(email);

  // Timing-safe: bcrypt.compare ALWAYS runs — use dummy hash if user not found or has no password
  const hashToCompare = user?.password ?? DUMMY_HASH;
  const passwordMatch = await bcrypt.compare(password, hashToCompare);

  if (!user || !user.password || !passwordMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Set session
  req.session.adminUser = {
    id: user.id,
    email: user.email!,
    role: user.role ?? "admin",
    tenantId: tenant.id,
  };

  return res.json({
    ok: true,
    tenantId: tenant.id,
    email: user.email,
    role: user.role,
  });
});

// GET /api/auth/admin-me — returns current session state (used by frontend to check login status)
router.get('/auth/admin-me', (req, res) => {
  if (req.session.adminUser) {
    return res.json({
      authenticated: true,
      ...req.session.adminUser,
    });
  }
  return res.status(401).json({ authenticated: false });
});

// POST /api/auth/logout — destroy session and return ok
router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
