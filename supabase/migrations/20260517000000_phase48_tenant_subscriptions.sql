-- Phase 48: Tenant Subscriptions
-- Global registry table — one row per tenant, no tenant_id self-reference.
-- Tracks Stripe customer and subscription state per tenant.

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id                    serial PRIMARY KEY,
  tenant_id             integer NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id    text NOT NULL,
  stripe_subscription_id text,
  status                text NOT NULL DEFAULT 'none',
  plan_id               text,
  current_period_end    timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id
  ON tenant_subscriptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_customer_id
  ON tenant_subscriptions(stripe_customer_id);
