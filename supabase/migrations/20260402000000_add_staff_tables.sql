-- Migration: add_staff_tables
-- Adds staff members feature: staff_members, staff_service_abilities,
-- staff_availability, staff_google_calendar, and staff_member_id on bookings.

-- Staff members who perform services (barber-shop model)
CREATE TABLE IF NOT EXISTS staff_members (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  profile_image_url TEXT,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Junction: which services each staff member can perform
CREATE TABLE IF NOT EXISTS staff_service_abilities (
  id SERIAL PRIMARY KEY,
  staff_member_id INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE
);

-- Per-staff working hours by day of week (0=Sunday ... 6=Saturday)
CREATE TABLE IF NOT EXISTS staff_availability (
  id SERIAL PRIMARY KEY,
  staff_member_id INTEGER NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true
);

-- Optional Google Calendar OAuth tokens per staff member
CREATE TABLE IF NOT EXISTS staff_google_calendar (
  id SERIAL PRIMARY KEY,
  staff_member_id INTEGER NOT NULL UNIQUE REFERENCES staff_members(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  token_expires_at TIMESTAMP NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add nullable staff assignment to bookings
-- onDelete SET NULL: deleting a staff member preserves booking history
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS staff_member_id INTEGER REFERENCES staff_members(id) ON DELETE SET NULL;
