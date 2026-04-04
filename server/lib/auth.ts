
import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import { storage } from "../storage";

// Supabase client for auth verification
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

let supabaseJwks:
  | ReturnType<typeof createRemoteJWKSet>
  | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    // Fall back to JWKS verification below.
  }

  return verifySupabaseJwtLocally(token);
}

/**
 * Validate Bearer token and look up the DB user with role.
 * Returns the DB user or null. Attaches user to req if valid.
 */
export async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const rawToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : queryToken || null;

  if (!rawToken) return null;
  const token = rawToken.trim();
  try {
    const supabaseUser = await getSupabaseUserFromToken(token);
    if (!supabaseUser?.email) return null;

    const email = supabaseUser.email;
    let dbUser = await storage.getUser(supabaseUser.id);
    if (!dbUser) {
      dbUser = await storage.getUserByEmail(email);
    }

    if (!dbUser) {
      // Auto-provision: Supabase validated the token, but no DB user exists.
      // Create one — admin if email matches ADMIN_EMAIL, otherwise default 'user' role.
      const adminEmail = process.env.ADMIN_EMAIL;
      const isAdmin = !!(adminEmail && email.toLowerCase() === adminEmail.toLowerCase());
      try {
        dbUser = await storage.createUser({
          id: supabaseUser.id,
          email,
          role: isAdmin ? 'admin' : 'user',
          isAdmin,
        });
        console.log(`[Auth] Auto-provisioned ${isAdmin ? 'admin' : 'user'}: ${email}`);
      } catch (err) {
        console.error('[Auth] Failed to auto-provision user:', err);
        return null;
      }
    } else if (dbUser.id !== supabaseUser.id) {
      console.warn(
        `[Auth] User id mismatch for ${email}. DB=${dbUser.id}, Supabase=${supabaseUser.id}`
      );
    }

    (req as any).user = dbUser;
    (req as any).supabaseUser = supabaseUser;
    return dbUser;
  } catch {
    return null;
  }
}

/** Any authenticated user (admin, user, or staff) */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: 'Authentication required' });
  next();
}

/** Admin or User role (not staff) */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: 'Authentication required' });
  if (user.role !== 'admin' && user.role !== 'user') {
    return res.status(403).json({ message: 'Insufficient permissions' });
  }
  next();
}

/** Admin role only */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: 'Authentication required' });
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

/** GET /api/auth/me — returns current user's profile with role */
export async function getAuthMe(req: Request, res: Response) {
  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ message: 'Not authenticated' });
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
