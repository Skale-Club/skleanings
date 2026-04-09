-- Add role column to users table (default 'viewer' for all existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';

-- Add user_id FK to staff_members (nullable — not all staff are linked to user accounts)
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
