-- Add userId FK to bookings for client portal ownership
alter table public.bookings
  add column if not exists user_id text references public.users(id);
