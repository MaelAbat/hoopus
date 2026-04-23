-- league_averages is written by sync-stats and read by sync-career, both
-- running server-side with the service role key (which bypasses RLS).
-- No client ever accesses this table, so enabling RLS with no policies
-- locks it down completely for anon/authenticated roles.
alter table public.league_averages enable row level security;
