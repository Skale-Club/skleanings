import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Use ANON_KEY for auth verification (works with user tokens)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Check if session exists and has userId
  const sess = req.session as any;
  if (!sess || !sess.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Verify admin status in DB
  const [dbUser] = await db.select().from(users).where(eq(users.id, sess.userId));
  if (!dbUser || !dbUser.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}