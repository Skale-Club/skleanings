alter table public.bookings
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_status text;
