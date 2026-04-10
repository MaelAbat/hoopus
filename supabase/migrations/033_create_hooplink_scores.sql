-- Daily HoopLink scores: one row per user per day
create table if not exists hooplink_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  display_name text not null default '',
  game_date text not null,
  chain_length integer not null,
  time_seconds integer not null,
  won boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, game_date)
);

create index if not exists idx_hooplink_scores_date on hooplink_scores(game_date);

alter table hooplink_scores enable row level security;
create policy "Allow public read on hooplink_scores" on hooplink_scores for select using (true);
create policy "Allow authenticated insert on hooplink_scores" on hooplink_scores for insert with check (auth.uid() = user_id);
create policy "Allow user update own scores" on hooplink_scores for update using (auth.uid() = user_id);
