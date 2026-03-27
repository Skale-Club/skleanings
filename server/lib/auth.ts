
import { Request, Response, NextFunction } from "express";
import { createClient } from '@supabase/supabase-js';

// Supabase client for auth verification
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin authentication middleware - uses Supabase Auth
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    // console.log('Auth header:', authHeader);
    // console.log('Request URL:', req.url);

    if (!authHeader?.startsWith('Bearer ')) {
        console.log('Missing or invalid Bearer token');
        return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    // console.log('Token received:', token.substring(0, 20) + '...');

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.log('Token validation failed:', error);
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Check if user email matches admin email
        const adminEmail = process.env.ADMIN_EMAIL || '';
        if (adminEmail && user.email !== adminEmail) {
          console.log(`Admin access denied. User: ${user.email}, Expected: ${adminEmail}`);
          return res.status(403).json({ message: 'Admin access required' });
        }

        // If ADMIN_EMAIL is not set, allow any authenticated user (development mode)
        if (!adminEmail) {
          console.warn(`ADMIN_EMAIL not set. Allowing authenticated user ${user.email} as admin. Set ADMIN_EMAIL in production.`);
        }

        (req as any).user = user;
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Failed to verify admin status' });
    }
}
