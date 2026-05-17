
import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { getAuthenticatedUser } from "../lib/auth";
import { buildPasswordResetEmail, buildVerificationEmail, sendResendEmail } from "../lib/email-resend";
import { db } from "../db";
import { users, userTenants, domains, companySettings } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

// GET /api/auth/admin-me — returns current session state including emailVerifiedAt
router.get('/auth/admin-me', async (req, res) => {
  if (!req.session.adminUser) {
    return res.status(401).json({ authenticated: false });
  }

  const storage = res.locals.storage!;
  try {
    const user = await storage.getUser(req.session.adminUser.id);
    return res.json({
      authenticated: true,
      ...req.session.adminUser,
      emailVerifiedAt: user?.emailVerifiedAt ?? null,
    });
  } catch (err) {
    console.error('[auth/admin-me] DB lookup failed:', err);
    // Fall back to session data only — do not expose emailVerifiedAt
    return res.json({
      authenticated: true,
      ...req.session.adminUser,
      emailVerifiedAt: null,
    });
  }
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

// GET /api/auth/verify-email — public, no session required
// Hashes the raw token, looks up in email_verification_tokens, marks used + sets emailVerifiedAt.
// On success: redirect to /admin
// On failure: redirect to /verify-email?error=invalid (frontend renders error message)
router.get('/auth/verify-email', async (req, res) => {
  const rawToken = req.query.token as string | undefined;
  if (!rawToken) {
    return res.redirect('/verify-email?error=invalid');
  }

  // Note: auth.ts routes are mounted under a tenant — res.locals.storage is available.
  const storage = res.locals.storage!;

  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await storage.findEmailVerificationToken(tokenHash);

    if (!record) {
      return res.redirect('/verify-email?error=invalid');
    }

    await storage.markEmailVerificationTokenUsed(record.id);
    await storage.setEmailVerified(record.userId);

    return res.redirect('/admin');
  } catch (err) {
    console.error('[auth/verify-email] Error:', err);
    return res.redirect('/verify-email?error=invalid');
  }
});

// POST /api/auth/resend-verification — requires active admin session
// Creates a new token and resends the verification email.
// Always returns 200 regardless of outcome (no enumeration / fail-safe).
router.post('/auth/resend-verification', async (req, res) => {
  if (!req.session.adminUser) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const storage = res.locals.storage!;

  try {
    const userId = req.session.adminUser.id;
    const email = req.session.adminUser.email;

    const siteUrl = process.env.SITE_URL || `${req.protocol}://${req.hostname}`;
    const rawToken = await storage.createEmailVerificationToken(userId);
    const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${rawToken}`;

    const settings = await storage.getCompanySettings();
    const companyName = settings?.companyName || 'Admin';

    const { subject, html, text } = buildVerificationEmail(verifyUrl, companyName);
    await sendResendEmail(storage, email, subject, html, text, undefined, 'email_verification');
  } catch (err) {
    console.error('[auth/resend-verification] Error:', err);
    // Intentionally swallowed — always returns 200
  }

  return res.json({ ok: true });
});

// GET /api/auth/validate-invite?token=
// Public — no session required. Returns invitation metadata for the accept-invite form.
// Returns 410 Gone if token is expired, already accepted, or not found.
router.get('/auth/validate-invite', async (req, res) => {
  const rawToken = req.query.token;
  if (!rawToken || typeof rawToken !== 'string') {
    return res.status(400).json({ message: "Token required" });
  }

  const storage = res.locals.storage!;

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const invitation = await storage.findStaffInvitation(tokenHash);

  if (!invitation) {
    return res.status(410).json({ message: "Invitation expired or already used" });
  }

  // Resolve company name for the invitation's tenant.
  // validate-invite may be hit on the platform domain (not the invitation's tenant subdomain),
  // so res.locals.storage may be scoped to a different tenant. Fall back to a direct db lookup
  // when the storage-scoped lookup doesn't match the invitation's tenant.
  let companyName = "Your Company";
  try {
    const settings = await storage.getCompanySettings();
    if (settings?.companyName) {
      companyName = settings.companyName;
    } else {
      const [row] = await db.select({ companyName: companySettings.companyName })
        .from(companySettings)
        .where(eq(companySettings.tenantId, invitation.tenantId))
        .limit(1);
      if (row?.companyName) companyName = row.companyName;
    }
  } catch {
    // Non-fatal — fallback to "Your Company"
  }

  return res.json({
    email: invitation.email,
    role: invitation.role,
    companyName,
    tenantId: invitation.tenantId,
  });
});

// POST /api/auth/accept-invite
// Public — no session required. Atomically creates user + user_tenants, marks invitation accepted,
// establishes session, returns { adminUrl } for client redirect.
// Returns 410 Gone if token is invalid/expired/already used.
router.post('/auth/accept-invite', async (req, res) => {
  const { token, name, password } = req.body as { token?: string; name?: string; password?: string };

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: "Token required" });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const storage = res.locals.storage!;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invitation = await storage.findStaffInvitation(tokenHash);

  if (!invitation) {
    return res.status(410).json({ message: "Invitation expired or already used" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Split name into firstName/lastName (best-effort — lastName may be empty)
  const nameParts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  // Atomic transaction: insert user + user_tenants + resolve primary domain
  let newUserId: string;
  let adminHostname: string | null = null;

  try {
    const result = await db.transaction(async (tx) => {
      // Insert user — let DB generate UUID via gen_random_uuid() default
      const [newUser] = await tx.insert(users).values({
        tenantId: invitation.tenantId,
        email: invitation.email,
        password: hashedPassword,
        role: invitation.role,
        firstName,
        lastName,
      }).returning({ id: users.id });

      // Insert user_tenants join row
      await tx.insert(userTenants).values({
        userId: newUser.id,
        tenantId: invitation.tenantId,
        role: invitation.role,
      });

      // Resolve primary domain for this tenant (for adminUrl)
      const [domain] = await tx.select({ hostname: domains.hostname })
        .from(domains)
        .where(and(
          eq(domains.tenantId, invitation.tenantId),
          eq(domains.isPrimary, true)
        ))
        .limit(1);

      return { userId: newUser.id, hostname: domain?.hostname ?? null };
    });

    newUserId = result.userId;
    adminHostname = result.hostname;
  } catch (err) {
    console.error('[auth/accept-invite] Transaction failed:', err);
    return res.status(500).json({ message: "Failed to create account. Please try again." });
  }

  // Mark invitation accepted AFTER transaction succeeds
  await storage.markInvitationAccepted(invitation.id);

  // Establish session
  req.session.adminUser = {
    id: newUserId,
    email: invitation.email,
    role: invitation.role,
    tenantId: invitation.tenantId,
  };

  // Build admin redirect URL
  const adminUrl = adminHostname
    ? `https://${adminHostname}/admin`
    : `${req.protocol}://${req.hostname}/admin`;

  return res.status(201).json({ adminUrl });
});

export default router;
