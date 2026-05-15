-- Phase 63: Tenant Stripe Accounts (Stripe Connect onboarding)
-- Global registry table — one row per tenant, no tenant_id self-reference column.
-- Tracks each tenant's Stripe Express Account ID and capability flags.

CREATE TABLE IF NOT EXISTS tenant_stripe_accounts (
  id                  serial PRIMARY KEY,
  tenant_id           integer NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_account_id   text NOT NULL UNIQUE,
  charges_enabled     boolean NOT NULL DEFAULT false,
  payouts_enabled     boolean NOT NULL DEFAULT false,
  details_submitted   boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_stripe_accounts_account_id
  ON tenant_stripe_accounts(stripe_account_id);
