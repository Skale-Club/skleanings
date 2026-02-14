-- Heartbeat keep-alive table and cron job
create extension if not exists pg_cron with schema extensions;

create table if not exists public.heartbeat (
  id integer primary key default 1,
  last_seen timestamptz not null default now()
);

insert into public.heartbeat (id)
values (1)
on conflict (id) do nothing;

-- Recreate the daily job at 00:00 UTC
select cron.unschedule('heartbeat-daily');
select cron.schedule(
  'heartbeat-daily',
  '0 0 * * *',
  $$ update public.heartbeat set last_seen = now() where id = 1; $$
);
