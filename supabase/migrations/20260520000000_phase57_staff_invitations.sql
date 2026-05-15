-- Phase 57: Staff Invitations
-- Global registry table (tenant_id FK, no per-tenant scope column needed).
-- Raw token never stored — only SHA-256 hash is persisted.

CREATE TABLE IF NOT EXISTS staff_invitations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sinv_token_hash ON staff_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_sinv_tenant_id ON staff_invitations(tenant_id);
