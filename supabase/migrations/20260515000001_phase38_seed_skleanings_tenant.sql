-- supabase/migrations/20260515000001_phase38_seed_skleanings_tenant.sql
-- Phase 38: Multi-Tenant Foundation -- Seed (Step B)
-- Idempotent: ON CONFLICT DO NOTHING on all inserts.
-- Depends on: 20260515000000 (tenants/domains tables must exist).

BEGIN;

-- Insert Skleanings as the canonical tenant (id=1).
-- ON CONFLICT (id) DO NOTHING ensures re-runs are safe.
INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
VALUES (1, 'skleanings', 'Skleanings', 'active', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Advance the serial sequence past id=1.
-- Without this, the next INSERT without an explicit id would try id=1 and fail
-- with a unique constraint violation.
SELECT setval(
  pg_get_serial_sequence('tenants', 'id'),
  GREATEST((SELECT MAX(id) FROM tenants), 1),
  true
);

-- Insert localhost as the primary domain for Skleanings tenant.
-- ON CONFLICT (hostname) DO NOTHING ensures re-runs are safe.
INSERT INTO domains (tenant_id, hostname, is_primary, created_at, updated_at)
VALUES (1, 'localhost', true, now(), now())
ON CONFLICT (hostname) DO NOTHING;

COMMIT;
