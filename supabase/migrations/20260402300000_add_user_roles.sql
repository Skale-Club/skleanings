-- Add role and phone columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;

-- Add userId FK to staff_members (nullable for backward compat)
ALTER TABLE staff_members ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);
