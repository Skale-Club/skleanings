-- Migration: add_utm_tracking
-- Phase 10: Schema, Capture & Classification
-- Adds visitor_sessions and conversion_events tables for first-party UTM attribution.
-- Adds utm_session_id nullable FK to bookings for direct attribution join.

-- ============================================================
-- TABLE: visitor_sessions
-- One row per anonymous visitor (identified by client-generated UUID).
-- first_* columns: written once on INSERT, NEVER updated (CAPTURE-05).
-- last_* columns: updated on each visit with UTM signal or external referrer (CAPTURE-06).
-- ============================================================
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id UUID PRIMARY KEY,

  -- First-touch attribution (immutable after INSERT)
  first_utm_source      TEXT,
  first_utm_medium      TEXT,
  first_utm_campaign    TEXT,
  first_utm_term        TEXT,
  first_utm_content     TEXT,
  first_utm_id          TEXT,
  first_landing_page    TEXT,
  first_referrer        TEXT,
  first_traffic_source  TEXT NOT NULL DEFAULT 'unknown',
  first_seen_at         TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Last-touch attribution (updated on meaningful re-engagement)
  last_utm_source       TEXT,
  last_utm_medium       TEXT,
  last_utm_campaign     TEXT,
  last_utm_term         TEXT,
  last_utm_content      TEXT,
  last_utm_id           TEXT,
  last_landing_page     TEXT,
  last_referrer         TEXT,
  last_traffic_source   TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at          TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Aggregate counters
  visit_count           INTEGER NOT NULL DEFAULT 1,
  total_bookings        INTEGER NOT NULL DEFAULT 0,
  converted_at          TIMESTAMP
);

-- Indexes for dashboard queries (BTREE — appropriate at this data volume)
CREATE INDEX IF NOT EXISTS visitor_sessions_first_utm_source_idx
  ON visitor_sessions(first_utm_source);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_traffic_source_idx
  ON visitor_sessions(first_traffic_source);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_seen_at_idx
  ON visitor_sessions(first_seen_at);
CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_at_idx
  ON visitor_sessions(last_seen_at);
CREATE INDEX IF NOT EXISTS visitor_sessions_first_campaign_idx
  ON visitor_sessions(first_utm_campaign);

-- ============================================================
-- MODIFY: bookings table — add nullable FK to visitor_sessions
-- Must be added BEFORE conversion_events (which references bookings).
-- ============================================================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS utm_session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: conversion_events
-- One row per tracked action. Denormalized attribution snapshot at event time.
-- ============================================================
CREATE TABLE IF NOT EXISTS conversion_events (
  id               SERIAL PRIMARY KEY,
  visitor_id       UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  booking_id       INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  booking_value    NUMERIC(10, 2),

  -- Attribution snapshot (no JOIN to visitor_sessions needed for reports)
  attributed_source       TEXT,
  attributed_medium       TEXT,
  attributed_campaign     TEXT,
  attributed_landing_page TEXT,
  attribution_model       TEXT NOT NULL DEFAULT 'last_touch',

  occurred_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  page_url       TEXT,
  metadata       JSONB DEFAULT '{}'
);

-- Indexes for reporting (Phase 12 dashboard queries)
CREATE INDEX IF NOT EXISTS conversion_events_occurred_at_idx
  ON conversion_events(occurred_at);
CREATE INDEX IF NOT EXISTS conversion_events_event_type_idx
  ON conversion_events(event_type);
CREATE INDEX IF NOT EXISTS conversion_events_attributed_source_idx
  ON conversion_events(attributed_source);
CREATE INDEX IF NOT EXISTS conversion_events_attributed_campaign_idx
  ON conversion_events(attributed_campaign);
CREATE INDEX IF NOT EXISTS conversion_events_visitor_id_idx
  ON conversion_events(visitor_id);
CREATE INDEX IF NOT EXISTS conversion_events_booking_id_idx
  ON conversion_events(booking_id);

-- ATTR-03: Partial unique index — prevents duplicate booking conversion rows.
-- WHERE booking_id IS NOT NULL — non-booking events (e.g. chat_initiated rows
-- with NULL booking_id) are NOT subject to this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS conversion_events_booking_event_model_unique_idx
  ON conversion_events (booking_id, event_type, attribution_model)
  WHERE booking_id IS NOT NULL;
