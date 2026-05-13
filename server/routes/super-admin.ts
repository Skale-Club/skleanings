import bcrypt from "bcrypt";
import { Router, type Request, type Response, type NextFunction } from "express";
import fs from "fs";
import path from "path";
import { count, eq } from "drizzle-orm";
import { db, ensureDatabaseReady } from "../db";
import { bookings, contacts, services, staffMembers } from "@shared/schema";
import { collectRuntimeEnvDiagnostics } from "../lib/runtime-env";
import { getRecentErrors } from "../lib/error-log";
import { storage } from "../storage";

const router = Router();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session.superAdmin?.authenticated === true) {
    next();
    return;
  }
  res.status(403).json({ message: "Super-admin access required" });
}

// ---------------------------------------------------------------------------
// POST /login  — timing-safe credential check
// ---------------------------------------------------------------------------

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  const expectedEmail = process.env.SUPER_ADMIN_EMAIL;
  const expectedHash = process.env.SUPER_ADMIN_PASSWORD_HASH;

  if (!email || !password || !expectedEmail || !expectedHash) {
    res.status(403).json({ message: "Invalid credentials" });
    return;
  }

  // Timing-safe: bcrypt.compare ALWAYS runs regardless of email match
  const [emailMatch, hashMatch] = await Promise.all([
    Promise.resolve(email.toLowerCase() === expectedEmail.toLowerCase()),
    bcrypt.compare(password, expectedHash),
  ]);

  if (!emailMatch || !hashMatch) {
    res.status(403).json({ message: "Invalid credentials" });
    return;
  }

  req.session.superAdmin = { authenticated: true };
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

router.post("/logout", (req: Request, res: Response): void => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---------------------------------------------------------------------------
// GET /me  — public session check (no requireSuperAdmin)
// ---------------------------------------------------------------------------

router.get("/me", (req: Request, res: Response): void => {
  if (req.session.superAdmin?.authenticated === true) {
    res.json({ authenticated: true });
  } else {
    res.status(403).json({ authenticated: false });
  }
});

// ---------------------------------------------------------------------------
// GET /stats  — aggregate platform metrics
// ---------------------------------------------------------------------------

router.get("/stats", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      [bookingsRow],
      [contactsRow],
      [servicesRow],
      [staffRow],
    ] = await Promise.all([
      db.select({ count: count() }).from(bookings),
      db.select({ count: count() }).from(contacts),
      db.select({ count: count() }).from(services).where(eq(services.isArchived, false)),
      db.select({ count: count() }).from(staffMembers).where(eq(staffMembers.isActive, true)),
    ]);

    res.json({
      totalBookings: Number(bookingsRow?.count ?? 0),
      totalContacts: Number(contactsRow?.count ?? 0),
      totalServices: Number(servicesRow?.count ?? 0),
      totalStaff: Number(staffRow?.count ?? 0),
      serverUptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (err) {
    console.error("[super-admin] /stats error:", err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ---------------------------------------------------------------------------
// GET /health  — database + env diagnostics
// ---------------------------------------------------------------------------

router.get("/health", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  let dbConnected = false;
  try {
    await ensureDatabaseReady();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  let migrationCount = 0;
  try {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    migrationCount = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).length;
  } catch {
    migrationCount = 0;
  }

  const { errors, warnings } = collectRuntimeEnvDiagnostics();

  res.json({
    dbConnected,
    migrationCount,
    envErrors: errors,
    envWarnings: warnings,
  });
});

// ---------------------------------------------------------------------------
// GET /company-settings
// ---------------------------------------------------------------------------

router.get("/company-settings", requireSuperAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const settings = await storage.getCompanySettings();
    res.json(settings);
  } catch (err) {
    console.error("[super-admin] /company-settings GET error:", err);
    res.status(500).json({ message: "Failed to fetch company settings" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /company-settings
// ---------------------------------------------------------------------------

router.patch("/company-settings", requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await storage.updateCompanySettings(req.body);
    res.json(updated);
  } catch (err) {
    console.error("[super-admin] /company-settings PATCH error:", err);
    res.status(500).json({ message: "Failed to update company settings" });
  }
});

// ---------------------------------------------------------------------------
// GET /error-logs  — recent captured console.error entries
// ---------------------------------------------------------------------------

router.get("/error-logs", requireSuperAdmin, (_req: Request, res: Response): void => {
  res.json(getRecentErrors());
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { router as superAdminRouter };
