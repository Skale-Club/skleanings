import { LRUCache } from "lru-cache";
import { db } from "../db";
import { domains, tenants, tenantSubscriptions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DatabaseStorage } from "../storage";
import type { Request, Response, NextFunction } from "express";

type CachedTenant = typeof tenants.$inferSelect;

const hostnameCache = new LRUCache<string, CachedTenant>({
  max: 500,
  ttl: 5 * 60 * 1000, // 5-minute TTL in milliseconds
});

export function invalidateTenantCache(hostname: string): void {
  hostnameCache.delete(hostname);
}

export async function resolveTenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.hostname strips port automatically (e.g. localhost:5000 -> localhost)
    // NEVER use req.headers.host — it includes the port
    const hostname = req.hostname;

    let tenant = hostnameCache.get(hostname);

    if (!tenant) {
      // DB lookup: JOIN domains -> tenants on cache miss
      const [row] = await db
        .select({ tenant: tenants })
        .from(domains)
        .innerJoin(tenants, eq(domains.tenantId, tenants.id))
        .where(eq(domains.hostname, hostname))
        .limit(1);

      if (!row) {
        res.status(404).json({ message: "Unknown tenant" });
        return;
      }

      tenant = row.tenant;
      hostnameCache.set(hostname, tenant);
    }

    if (tenant.status === 'inactive') {
      res.status(503).json({ message: 'Tenant temporarily unavailable' });
      return;
    }

    // Subscription enforcement (SB-05)
    const [subRow] = await db
      .select({
        status: tenantSubscriptions.status,
        currentPeriodEnd: tenantSubscriptions.currentPeriodEnd,
      })
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenant.id))
      .limit(1);

    if (subRow) {
      const GRACE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
      const lapsed =
        subRow.status === "canceled" ||
        (subRow.status === "past_due" &&
          subRow.currentPeriodEnd !== null &&
          subRow.currentPeriodEnd.getTime() < Date.now() - GRACE_MS);

      if (lapsed) {
        res.status(402).json({ message: "Subscription required" });
        return;
      }
    }

    res.locals.tenant = tenant;
    res.locals.storage = DatabaseStorage.forTenant(tenant.id);
    next();
  } catch (err) {
    next(err); // Forward to Express error handler — never hang the request
  }
}
