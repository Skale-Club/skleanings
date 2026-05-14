
import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { getAuthenticatedUser } from "../lib/auth";
import { buildPasswordResetEmail, sendResendEmail } from "../lib/email-resend";

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

// POST /api/auth/forgot-password
// Always returns 200 to prevent email enumeration.
// Generates a 64-char hex raw token, stores SHA-256 hash, sends Resend email.
router.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) return res.status(400).json({ message: "Email required" });

  const storage = res.locals.storage!;

  // Fire-and-forget: any error is swallowed to prevent enumeration
  try {
    const user = await storage.getUserByEmail(email);
    if (user && user.id) {
      // Generate raw token — never stored, sent in link
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);

      const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.hostname}`;
      const resetUrl = `${siteUrl}/reset-password?token=${rawToken}`;

      const settings = await storage.getCompanySettings();
      const companyName = settings?.companyName || 'Admin';

      const { subject, html, text } = buildPasswordResetEmail(resetUrl, companyName);
      await sendResendEmail(storage, email, subject, html, text, undefined, 'password_reset');
    }
  } catch (err) {
    console.error('[auth/forgot-password] Error:', err);
    // Intentionally swallowed — same 200 regardless
  }

  return res.json({ ok: true });
});

// POST /api/auth/reset-password
// Validates raw token (hash lookup), checks expiry and used_at, updates password, marks token used.
router.post('/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token || !newPassword) {
    return res.status(400).json({ message: "Token and new password are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const storage = res.locals.storage!;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await storage.findPasswordResetToken(tokenHash);

  if (!record) {
    return res.status(400).json({ message: "Invalid or expired reset link" });
  }
  if (record.usedAt) {
    return res.status(400).json({ message: "This reset link has already been used" });
  }
  if (new Date() > record.expiresAt) {
    return res.status(400).json({ message: "This reset link has expired" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await storage.updateUserPassword(record.userId, hashedPassword);
  await storage.markPasswordResetTokenUsed(record.id);

  return res.json({ ok: true });
});

// POST /api/auth/change-password
// Requires an active admin session. Verifies current password before updating.
router.post('/auth/change-password', async (req, res) => {
  if (!req.session.adminUser) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }

  const storage = res.locals.storage!;
  const userId = req.session.adminUser.id;

  const user = await storage.getUser(userId);
  if (!user || !user.password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ message: "Current password is incorrect" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await storage.updateUserPassword(userId, hashedPassword);

  return res.json({ ok: true });
});

export default router;
