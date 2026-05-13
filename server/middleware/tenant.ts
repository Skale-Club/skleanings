import { LRUCache } from "lru-cache";
import { db } from "../db";
import { domains, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { DatabaseStorage } from "../storage";
import type { Request, Response, NextFunction } from "express";

type CachedTenant = typeof tenants.$inferSelect;

const hostnameCache = new LRUCache<string, CachedTenant>({
  max: 500,
  ttl: 5 * 60 * 1000, // 5-minute TTL in milliseconds
});

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

    res.locals.tenant = tenant;
    res.locals.storage = DatabaseStorage.forTenant(tenant.id);
    next();
  } catch (err) {
    next(err); // Forward to Express error handler — never hang the request
  }
}
