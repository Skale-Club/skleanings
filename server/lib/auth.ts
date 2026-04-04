
import { Request, Response, NextFunction } from "express";
import { createClient } from '@supabase/supabase-js';
import { storage } from "../storage";

// Supabase client for auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Retry a DB operation once on pgBouncer SCRAM handshake failure */
async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() || '';
    if (msg.includes('scram-server-final-message') || msg.includes('server signature is missing')) {
      console.warn('[Auth] SCRAM error on DB query, retrying once...');
      await new Promise(r => setTimeout(r, 200));
      return fn();
    }
    throw err;
  }
}

/**
 * Validate Bearer token and look up the DB user with role.
 * Returns the DB user or null. Attaches user to req if valid.
 */
async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const rawToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : queryToken || null;

  if (!rawToken) return null;
  const token = rawToken;
  try {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    if (error || !supabaseUser || !supabaseUser.email) return null;

    const email = supabaseUser.email!;
    let dbUser = await withDbRetry(() => storage.getUserByEmail(email));
    if (!dbUser) {
      // Auto-provision: if this is the admin email, create the DB record now.
      // Handles the case where ensureAdminUser() failed on cold start (SCRAM/timeout).
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && supabaseUser.email.toLowerCase() === adminEmail.toLowerCase()) {
        try {
          dbUser = await withDbRetry(() => storage.createUser({ email, role: 'admin', isAdmin: true }));
          console.log(`[Auth] Auto-provisioned admin user: ${supabaseUser.email}`);
        } catch (err) {
          console.error('[Auth] Failed to auto-provision admin user:', err);
          return null;
        }
      } else {
        return null;
      }
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
