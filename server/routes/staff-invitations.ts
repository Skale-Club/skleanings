/**
 * Staff Invitation admin routes — Phase 57
 * Mounted at /api/admin (inside resolveTenantMiddleware scope).
 * All routes guarded by requireAdmin.
 */
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import { and, eq, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { buildInviteEmail, sendResendEmail } from "../lib/email-resend";
import { db } from "../db";
import { staffInvitations, type StaffInvitation } from "@shared/schema";

export const staffInvitationRouter = Router();

const inviteBodySchema = z.object({
  email: z.string().email({ message: "Valid email required" }),
  role: z.enum(["staff", "admin"]).default("staff"),
});

// POST /api/admin/staff/invite — send invitation email
staffInvitationRouter.post("/staff/invite", requireAdmin, async (req: Request, res: Response) => {
  const parsed = inviteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid request" });
  }

  const { email, role } = parsed.data;
  const tenant = res.locals.tenant;
  const storage = res.locals.storage;

  if (!tenant || !storage) {
    return res.status(503).json({ message: "Tenant not resolved" });
  }

  const rawToken = await storage.createStaffInvitation(tenant.id, email, role);

  const baseUrl = process.env.SITE_URL ?? `${req.protocol}://${req.hostname}`;
  const inviteUrl = `${baseUrl}/accept-invite?token=${rawToken}`;

  // Fire-and-forget — email failure must not block the 201 response
  void (async () => {
    try {
      const settings = await storage.getCompanySettings();
      const companyName = settings?.companyName ?? "Your Company";
      const { subject, html, text } = buildInviteEmail(inviteUrl, companyName, email);
      await sendResendEmail(storage, email, subject, html, text, undefined, "staff_invite");
    } catch (err) {
      console.error("[staff/invite] Email send failed:", err);
    }
  })();

  return res.status(201).json({ message: "Invitation sent" });
});

// DELETE /api/admin/staff/invite/:id — revoke a pending invitation
staffInvitationRouter.delete("/staff/invite/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid invitation ID" });
  }

  const storage = res.locals.storage;
  const tenant = res.locals.tenant;

  if (!tenant || !storage) {
    return res.status(503).json({ message: "Tenant not resolved" });
  }

  // Fetch all pending invitations for this tenant — scoped lookup
  const pending = await storage.getPendingInvitations(tenant.id);
  const found = pending.find((inv: StaffInvitation) => inv.id === id);

  if (!found) {
    // Check if the invitation exists but was already accepted (409 vs 404)
    const [accepted] = await db
      .select({ id: staffInvitations.id })
      .from(staffInvitations)
      .where(
        and(
          eq(staffInvitations.id, id),
          eq(staffInvitations.tenantId, tenant.id),
          isNotNull(staffInvitations.acceptedAt)
        )
      )
      .limit(1);

    if (accepted) {
      return res.status(409).json({ message: "Invitation already accepted" });
    }
    return res.status(404).json({ message: "Invitation not found" });
  }

  await storage.revokeStaffInvitation(id);
  return res.json({ message: "Invitation revoked" });
});

// GET /api/admin/staff/invitations — list pending invitations for this tenant
staffInvitationRouter.get("/staff/invitations", requireAdmin, async (req: Request, res: Response) => {
  const storage = res.locals.storage;
  const tenant = res.locals.tenant;

  if (!tenant || !storage) {
    return res.status(503).json({ message: "Tenant not resolved" });
  }

  const invitations = await storage.getPendingInvitations(tenant.id);
  return res.json({ invitations });
});
