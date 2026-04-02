
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
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];
  try {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    if (error || !supabaseUser || !supabaseUser.email) return null;

    const dbUser = await storage.getUserByEmail(supabaseUser.email);
    if (!dbUser) return null;

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
