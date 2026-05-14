
// Force restart: schema updated
import type { Express } from "express";
import { type Server } from "http";

// Import routers
import chatRouter from "./routes/chat";
import authRouter from "./routes/auth";
import catalogRouter from "./routes/catalog";
import availabilityRouter from "./routes/availability";
import bookingsRouter from "./routes/bookings";
import contactsRouter from "./routes/contacts";
import companyRouter from "./routes/company";
import blogRouter from "./routes/blog";
import faqsRouter from "./routes/faqs";
import serviceAreasRouter from "./routes/service-areas";
import integrationRouter from "./routes/integrations";
import userRoutes from "./routes/user-routes";
import authRoutes from "./routes/auth-routes";
import staffRouter from "./routes/staff";
import paymentsRouter from "./routes/payments";
import analyticsRouter from "./routes/analytics";
import clientRouter from "./routes/client";
import notificationLogsRouter from "./routes/notification-logs";
import recurringBookingsRouter, { adminRecurringRouter, publicRecurringRouter } from "./routes/recurring-bookings";
import { superAdminRouter } from "./routes/super-admin";
import { calendarSyncRouter } from "./routes/calendar-sync";
import { billingRouter } from "./routes/billing";
import { resolveTenantMiddleware } from "./middleware/tenant";

export async function registerRoutes(server: Server, app: Express) {
  // 1. Super-admin — bypasses tenant resolution (MT-13)
  app.use("/api/super-admin", superAdminRouter);

  // 2. Tenant resolution — applies to all routes below
  app.use(resolveTenantMiddleware);

  // 3. Business routers
  // Auth routes (e.g. /api/admin/session) - mounted at /api to match client expectations
  app.use("/api", authRouter);
  app.use("/api", authRoutes);
  app.use("/api/users", userRoutes);

  // Chat routes (e.g. /api/chat, /api/conversations)
  app.use("/api", chatRouter);

  // Integration routes (e.g. /api/integrations/openai, /api/integrations/ghl)
  app.use("/api/integrations", integrationRouter);

  // Catalog routes (e.g. /api/categories, /api/services) - mounted at root because they use full paths
  app.use("/", catalogRouter);

  // Availability routes (e.g. /api/availability, /api/availability/month)
  app.use("/", availabilityRouter);

  // Company routes (e.g. /api/company-settings, /robots.txt, /sitemap.xml) - mounted at root because they use full paths
  app.use("/", companyRouter);

  // Bookings routes (mounted at /api/bookings)
  app.use("/api/bookings", bookingsRouter);

  // Contacts routes (mounted at /api/contacts)
  app.use("/api/contacts", contactsRouter);

  // Blog routes (mounted at /api/blog)
  app.use("/api/blog", blogRouter);

  // FAQ routes (mounted at /api/faqs)
  app.use("/api/faqs", faqsRouter);

  // Service Area routes (mounted at /api/service-areas)
  app.use("/api/service-areas", serviceAreasRouter);

  // Staff routes (mounted at /api/staff)
  app.use("/api/staff", staffRouter);

  // Payment routes (mounted at /api/payments)
  app.use("/api/payments", paymentsRouter);

  // Analytics routes (public POST /api/analytics/session)
  app.use("/api/analytics", analyticsRouter);

  // Client portal routes (mounted at /api/client)
  app.use("/api/client", clientRouter);

  // Notification log routes (/api/conversations/:id/notifications + /api/admin/notification-logs)
  app.use("/api", notificationLogsRouter);

  // Calendar sync routes (cron/run, health, retry) — Phase 32
  app.use("/api/integrations/calendar-sync", calendarSyncRouter);

  // Recurring bookings routes (/api/recurring-bookings/cron/generate + future customer/admin routes)
  app.use("/api/recurring-bookings", recurringBookingsRouter);
  // Phase 29: admin and public recurring subscription routes
  app.use("/api/admin/recurring-bookings", adminRecurringRouter);
  app.use("/api/subscriptions/manage", publicRecurringRouter);

  // Billing routes (GET /api/billing/status, POST /api/billing/portal)
  // guarded by requireAdmin inside the router — per SB-07, SB-08
  app.use("/api/billing", billingRouter);

}
