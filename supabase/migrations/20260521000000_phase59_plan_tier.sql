-- Phase 59: Plan Tier Foundation
-- Adds plan_tier column to tenant_subscriptions so each tenant can be
-- assigned a Basic / Pro / Enterprise tier. Default 'basic' for all
-- existing rows. CHECK constraint enforces the 3 allowed values.

ALTER TABLE tenant_subscriptions
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'basic';

-- Enforce the 3-value enum at the DB layer. IF NOT EXISTS guard so the
-- migration is idempotent across re-runs (Phase 38-01 pattern).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_subscriptions_plan_tier_check'
  ) THEN
    ALTER TABLE tenant_subscriptions
      ADD CONSTRAINT tenant_subscriptions_plan_tier_check
      CHECK (plan_tier IN ('basic', 'pro', 'enterprise'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_plan_tier
  ON tenant_subscriptions(plan_tier);
