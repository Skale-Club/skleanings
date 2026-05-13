-- supabase/migrations/20260515000000_phase38_multi_tenant_foundation.sql
-- Phase 38: Multi-Tenant Foundation -- DDL (Step A)
-- Idempotent: uses IF NOT EXISTS throughout.
-- Sessions table is intentionally excluded (infra, not tenant data).

BEGIN;

-- 1. Global registry: tenants
CREATE TABLE IF NOT EXISTS tenants (
  id         serial PRIMARY KEY,
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- 2. Global registry: domains
CREATE TABLE IF NOT EXISTS domains (
  id         serial PRIMARY KEY,
  tenant_id  integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hostname   text NOT NULL UNIQUE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domains_tenant_id_idx ON domains (tenant_id);

-- 3. Global registry: user_tenants
-- users.id is text (UUID string) -- FK must be text, not integer.
CREATE TABLE IF NOT EXISTS user_tenants (
  user_id    text    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text    NOT NULL DEFAULT 'viewer',
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS user_tenants_tenant_id_idx ON user_tenants (tenant_id);
CREATE INDEX IF NOT EXISTS user_tenants_user_id_idx   ON user_tenants (user_id);

-- 4. Add tenant_id to all 40 business tables (idempotent via ADD COLUMN IF NOT EXISTS).
-- tenants table must already exist (created above) so FK references are valid.
-- The DO $$ block checks table existence before ALTER to tolerate schema drift.
-- NOT NULL DEFAULT 1 fills all existing rows atomically -- no separate UPDATE needed.
DO $$
DECLARE
  t text;
  scoped_tables text[] := ARRAY[
    'users',
    'categories',
    'subcategories',
    'services',
    'service_addons',
    'service_options',
    'service_frequencies',
    'service_durations',
    'service_booking_questions',
    'contacts',
    'visitor_sessions',
    'recurring_bookings',
    'bookings',
    'conversion_events',
    'integration_settings',
    'chat_settings',
    'chat_integrations',
    'twilio_settings',
    'email_settings',
    'telegram_settings',
    'conversations',
    'conversation_messages',
    'booking_items',
    'company_settings',
    'faqs',
    'service_area_groups',
    'service_area_cities',
    'service_areas',
    'blog_posts',
    'blog_post_services',
    'blog_settings',
    'blog_generation_jobs',
    'time_slot_locks',
    'staff_members',
    'staff_service_abilities',
    'staff_availability',
    'staff_google_calendar',
    'staff_availability_overrides',
    'notification_logs',
    'calendar_sync_queue'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id integer NOT NULL DEFAULT 1 REFERENCES tenants(id)',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)',
        t || '_tenant_id_idx', t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
