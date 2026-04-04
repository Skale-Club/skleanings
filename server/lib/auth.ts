
import { Request, Response, NextFunction } from "express";
import { createClient } from '@supabase/supabase-js';
import { storage } from "../storage";

// Supabase client for auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

  if (!rawToken) { console.log('[Auth] No token found'); return null; }
  const token = rawToken;
  try {
    console.log(`[Auth] Validating token (${token.substring(0, 20)}...) supabaseUrl=${supabaseUrl ? 'SET' : 'EMPTY'} anonKey=${supabaseAnonKey ? 'SET' : 'EMPTY'}`);
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    if (error) { console.log(`[Auth] Supabase error: ${error.message}`); return null; }
    if (!supabaseUser || !supabaseUser.email) { console.log('[Auth] No supabase user or email'); return null; }
    console.log(`[Auth] Supabase validated: ${supabaseUser.email}`);

    let dbUser = await storage.getUserByEmail(supabaseUser.email);
    if (!dbUser) {
      // Auto-provision: if this is the admin email, create the DB record now.
      // Handles the case where ensureAdminUser() failed on cold start (SCRAM/timeout).
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && supabaseUser.email.toLowerCase() === adminEmail.toLowerCase()) {
        try {
          dbUser = await storage.createUser({ email: supabaseUser.email, role: 'admin', isAdmin: true });
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
  // Temporary: inline diagnostic to pinpoint 401 cause
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token as string | undefined;
  const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : queryToken || null;

  if (!rawToken) return res.status(401).json({ message: 'Not authenticated', debug: 'no_token' });

  try {
    const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(rawToken);
    if (sbError) return res.status(401).json({ message: 'Not authenticated', debug: 'supabase_error', detail: sbError.message });
    if (!sbUser?.email) return res.status(401).json({ message: 'Not authenticated', debug: 'no_supabase_email' });

    let dbUser = await storage.getUserByEmail(sbUser.email);
    if (!dbUser) {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail && sbUser.email.toLowerCase() === adminEmail.toLowerCase()) {
        try {
          dbUser = await storage.createUser({ email: sbUser.email, role: 'admin', isAdmin: true });
        } catch (createErr: any) {
          return res.status(401).json({ message: 'Not authenticated', debug: 'create_failed', detail: createErr.message });
        }
      } else {
        return res.status(401).json({ message: 'Not authenticated', debug: 'no_db_user', email: sbUser.email, adminEmail: adminEmail || 'NOT_SET' });
      }
    }

    (req as any).user = dbUser;
    res.json({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      phone: dbUser.phone,
      profileImageUrl: dbUser.profileImageUrl,
    });
  } catch (err: any) {
    return res.status(401).json({ message: 'Not authenticated', debug: 'exception', detail: err.message });
  }
}
