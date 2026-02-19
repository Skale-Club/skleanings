
// Force restart: schema updated
import type { Express } from "express";
import { timingSafeEqual } from "crypto";
import { type Server } from "http";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { seedDatabase, seedFaqs } from "./lib/seeds";
import { systemHeartbeats } from "@shared/schema";

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

function hasValidCronToken(authHeader: string | undefined, secret: string): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice("Bearer ".length).trim();
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(secret);

  if (tokenBuffer.length !== secretBuffer.length) return false;
  return timingSafeEqual(tokenBuffer, secretBuffer);
}

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

  app.get("/api/cron/supabase-keepalive", async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res.status(500).json({
        ok: false,
        message: "CRON_SECRET is not configured",
      });
    }

    if (!hasValidCronToken(req.get("authorization"), cronSecret)) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    try {
      await db.execute(sql`select now()`);

      const [heartbeat] = await db
        .insert(systemHeartbeats)
        .values({
          source: "vercel-cron",
          note: "",
        })
        .returning({
          id: systemHeartbeats.id,
        });

      return res.status(200).json({
        ok: true,
        heartbeatId: heartbeat.id,
      });
    } catch (error) {
      console.error("Supabase keepalive cron failed:", error);
      return res.status(500).json({
        ok: false,
        message: "Failed to execute keepalive",
      });
    }
  });

  // Seed Data
  await seedDatabase();
  await seedFaqs();
}
