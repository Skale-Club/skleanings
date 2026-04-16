-- Create contacts table (deduplicated customer records)
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  ghl_contact_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add contact_id FK to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- Backfill: Step 1 — insert contacts for customers with email (deduplicated by email)
INSERT INTO contacts (name, email, phone, address, ghl_contact_id)
SELECT DISTINCT ON (customer_email)
  customer_name,
  customer_email,
  customer_phone,
  customer_address,
  ghl_contact_id
FROM bookings
WHERE customer_email IS NOT NULL AND customer_email <> ''
ORDER BY customer_email, created_at ASC
ON CONFLICT (email) DO NOTHING;

-- Backfill: Step 2 — insert contacts for customers with no email, deduplicated by phone
INSERT INTO contacts (name, phone, address)
SELECT DISTINCT ON (customer_phone)
  customer_name,
  customer_phone,
  customer_address
FROM bookings
WHERE (customer_email IS NULL OR customer_email = '')
  AND customer_phone IS NOT NULL AND customer_phone <> ''
ORDER BY customer_phone, created_at ASC;

-- Backfill: Step 3 — link bookings to contacts by email
UPDATE bookings b
SET contact_id = c.id
FROM contacts c
WHERE b.customer_email IS NOT NULL
  AND b.customer_email <> ''
  AND b.customer_email = c.email
  AND b.contact_id IS NULL;

-- Backfill: Step 4 — link remaining bookings to contacts by phone (no email match)
UPDATE bookings b
SET contact_id = c.id
FROM contacts c
WHERE (b.customer_email IS NULL OR b.customer_email = '')
  AND b.customer_phone = c.phone
  AND b.contact_id IS NULL;
