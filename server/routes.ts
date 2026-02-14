
// Force restart: schema updated
import type { Express } from "express";
import { type Server } from "http";
import { seedDatabase, seedFaqs } from "./lib/seeds";

// Import routers
import chatRouter from "./routes/chat";
import authRouter from "./routes/auth";
import catalogRouter from "./routes/catalog";
import bookingsRouter from "./routes/bookings";
import companyRouter from "./routes/company";
import blogRouter from "./routes/blog";
import faqsRouter from "./routes/faqs";
import serviceAreasRouter from "./routes/service-areas";
import integrationRouter from "./routes/integrations";
import userRoutes from "./routes/user-routes";
import authRoutes from "./routes/auth-routes";

export async function registerRoutes(server: Server, app: Express) {
  // Mount routers
  // Mount routers
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

  // Company routes (e.g. /api/company-settings, /robots.txt, /sitemap.xml) - mounted at root because they use full paths
  app.use("/", companyRouter);

  // Bookings routes (mounted at /api/bookings)
  app.use("/api/bookings", bookingsRouter);

  // Blog routes (mounted at /api/blog)
  app.use("/api/blog", blogRouter);

  // FAQ routes (mounted at /api/faqs)
  app.use("/api/faqs", faqsRouter);

  // Service Area routes (mounted at /api/service-areas)
  app.use("/api/service-areas", serviceAreasRouter);

  // Seed Data
  await seedDatabase();
  await seedFaqs();
}
