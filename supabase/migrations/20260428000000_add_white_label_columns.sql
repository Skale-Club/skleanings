-- Migration: add_white_label_columns
-- Phase 15: Schema Foundation & Detokenization
-- Adds three white-label fields to company_settings:
--   service_delivery_model — operational mode for the tenant ('at-customer', 'customer-comes-in', 'both')
--   privacy_policy_content — DB-backed legal copy (Phase 17 admin UI consumes this)
--   terms_of_service_content — DB-backed legal copy

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS service_delivery_model TEXT DEFAULT 'at-customer',
  ADD COLUMN IF NOT EXISTS privacy_policy_content TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_of_service_content TEXT DEFAULT '';
