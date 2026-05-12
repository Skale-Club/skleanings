-- Phase 31: Add email_settings table for Resend transactional email configuration
CREATE TABLE IF NOT EXISTS email_settings (
  id         SERIAL PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  resend_api_key TEXT,
  from_address   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
