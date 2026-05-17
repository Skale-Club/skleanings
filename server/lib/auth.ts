import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import { ensureDatabaseReady } from "../db";
import type { IStorage } from "../storage";
import {
  createFallbackUser,
  getFallbackUserByEmail,
  getFallbackUserById,
} from "./public-data-fallback";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";
const supabasePublicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

export const supabase = createClient(supabaseUrl, supabasePublicKey);

type SupabaseJwtPayload = {
  sub?: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type MinimalSupabaseUser = {
  id: string;
  email: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type AuthenticatedAppUser = Awaited<ReturnType<IStorage["getUser"]>>;

let supabaseJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown> | undefined, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildFallbackProfile(supabaseUser: MinimalSupabaseUser) {
  const fullName = readString(supabaseUser.user_metadata, "name");

  return {
    firstName:
      readString(supabaseUser.user_metadata, "first_name") ||
      readString(supabaseUser.user_metadata, "given_name") ||
      fullName?.split(" ")[0] ||
      null,
    lastName:
      readString(supabaseUser.user_metadata, "last_name") ||
      readString(supabaseUser.user_metadata, "family_name") ||
      fullName?.split(" ").slice(1).join(" ") ||
      null,
    phone: readString(supabaseUser.user_metadata, "phone"),
    profileImageUrl:
      readString(supabaseUser.user_metadata, "avatar_url") ||
      readString(supabaseUser.user_metadata, "picture"),
  };
}

function getSupabaseJwks() {
  if (!supabaseUrl) return null;
  if (!supabaseJwks) {
    supabaseJwks = createRemoteJWKSet(
      new URL(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`)
    );
  }
  return supabaseJwks;
}

async function verifySupabaseJwtLocally(token: string): Promise<MinimalSupabaseUser | null> {
  const jwks = getSupabaseJwks();
  if (!jwks) return null;

  try {
    const header = decodeProtectedHeader(token);
    if (!header.alg || !/^(ES|RS)/.test(header.alg)) {
      return null;
    }

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl.replace(/\/$/, "")}/auth/v1`,
      audience: "authenticated",
    });

    const jwtPayload = payload as SupabaseJwtPayload;
    if (!jwtPayload.sub || !jwtPayload.email) {
      return null;
    }

    return {
      id: jwtPayload.sub,
      email: jwtPayload.email,
      app_metadata: isRecord(jwtPayload.app_metadata) ? jwtPayload.app_metadata : {},
      user_metadata: isRecord(jwtPayload.user_metadata) ? jwtPayload.user_metadata : {},
    };
  } catch {
    return null;
  }
}

async function getSupabaseUserFromToken(token: string): Promise<MinimalSupabaseUser | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (!error && user?.id && user.email) {
      return {
        id: user.id,
        email: user.email,
        app_metadata: user.app_metadata ?? {},
        user_metadata: user.user_metadata ?? {},
      };
    }
  } catch {
    // Fall through to JWKS verification below.
  }

  return verifySupabaseJwtLocally(token);
}

async function findAppUser(supabaseUser: MinimalSupabaseUser, storage: IStorage) {
  try {
    let dbUser = await storage.getUser(supabaseUser.id);
    if (!dbUser) {
      dbUser = await storage.getUserByEmail(supabaseUser.email);
    }
    if (dbUser) {
      return dbUser;
    }
  } catch (error) {
    console.warn("[Auth] Primary DB lookup failed, trying Supabase REST fallback:", error);
  }

  try {
    let fallbackUser = await getFallbackUserById(supabaseUser.id);
    if (!fallbackUser) {
      fallbackUser = await getFallbackUserByEmail(supabaseUser.email);
    }
    if (fallbackUser) {
      return fallbackUser;
    }
  } catch (error) {
    console.warn("[Auth] Fallback user lookup failed:", error);
  }

  return null;
}

async function provisionAppUser(supabaseUser: MinimalSupabaseUser, storage: IStorage) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const isAdmin = !!(adminEmail && supabaseUser.email.toLowerCase() === adminEmail.toLowerCase());
  const profile = buildFallbackProfile(supabaseUser);
  const payload = {
    id: supabaseUser.id,
    email: supabaseUser.email,
    role: isAdmin ? "admin" : "user",
    isAdmin,
    ...profile,
  };

  try {
    return await storage.createUser(payload);
  } catch (error) {
    console.warn("[Auth] Primary DB auto-provision failed, trying Supabase REST fallback:", error);
  }

  try {
    return await createFallbackUser(payload);
  } catch (error) {
    console.error("[Auth] Fallback auto-provision failed:", error);
  }

  return {
    ...payload,
    createdAt: null,
    updatedAt: null,
  } as NonNullable<AuthenticatedAppUser>;
}

export async function getAuthenticatedUser(req: Request, storage: IStorage) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split("Bearer ")[1]
    : queryToken || null;

  if (!rawToken) return null;
  const token = rawToken.trim();

  const supabaseUser = await getSupabaseUserFromToken(token);
  if (!supabaseUser?.email) return null;

  try {
    await ensureDatabaseReady();
  } catch (error) {
    console.error("[Auth] Database bootstrap failed during authentication:", error);
    throw error;
  }

  const email = supabaseUser.email;
  let dbUser = await findAppUser(supabaseUser, storage);

  if (!dbUser) {
    dbUser = await provisionAppUser(supabaseUser, storage);
    console.log(`[Auth] Auto-provisioned user profile for ${email}`);
  } else if (dbUser.id !== supabaseUser.id) {
    console.warn(
      `[Auth] User id mismatch for ${email}. DB=${dbUser.id}, Supabase=${supabaseUser.id}`
    );
  }

  (req as any).user = dbUser;
  (req as any).supabaseUser = supabaseUser;
  return dbUser;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const storage = res.locals.storage!;
  const user = await getAuthenticatedUser(req, storage);
  if (!user) return res.status(401).json({ message: "Authentication required" });
  next();
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const storage = res.locals.storage!;
  const user = await getAuthenticatedUser(req, storage);
  if (!user) return res.status(401).json({ message: "Authentication required" });
  if (user.role !== "admin" && user.role !== "user") {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // --- Session-based fast-path (tenant-scoped login) ---
  if (req.session.adminUser) {
    const sessionUser = req.session.adminUser;
    // Cross-tenant guard: if session carries a tenantId, it must match the resolved tenant
    if (
      sessionUser.tenantId !== undefined &&
      res.locals.tenant !== undefined &&
      sessionUser.tenantId !== res.locals.tenant.id
    ) {
      return res.status(403).json({ message: "Cross-tenant access denied" });
    }
    // Session valid — attach to req for downstream use
    (req as any).sessionUser = sessionUser;
    return next();
  }

  // --- Existing Supabase JWT path (unchanged) ---
  const storage = res.locals.storage!;
  const user = await getAuthenticatedUser(req, storage);
  if (!user) return res.status(401).json({ message: "Authentication required" });
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function requireClient(req: Request, res: Response, next: NextFunction) {
  const storage = res.locals.storage!;
  const user = await getAuthenticatedUser(req, storage);
  if (!user) return res.status(401).json({ message: "Authentication required" });
  if (user.role !== "client") {
    return res.status(403).json({ message: "Client access required" });
  }
  next();
}

export async function getAuthMe(req: Request, res: Response) {
  const storage = res.locals.storage!;
  const user = await getAuthenticatedUser(req, storage);
  if (!user) return res.status(401).json({ message: "Not authenticated" });
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    profileImageUrl: user.profileImageUrl,
  });
}

// Staff authentication middleware - validates token and checks DB role (admin|staff)
export async function requireStaff(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        const storage = res.locals.storage!;
        const dbUser = await storage.getUserByEmail(user.email!);
        if (!dbUser || !['admin', 'staff'].includes(dbUser.role)) {
            return res.status(403).json({ message: 'Staff access required' });
        }
        (req as any).user = user;
        (req as any).dbUser = dbUser;
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Failed to verify staff status' });
    }
}
