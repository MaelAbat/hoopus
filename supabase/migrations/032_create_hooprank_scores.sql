-- Daily HoopRank scores: one row per user per day
create table if not exists hooprank_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  display_name text not null default '',
  game_date text not null,
  score integer not null,             -- 0-500
  time_seconds integer not null,
  created_at timestamptz not null default now(),
  unique(user_id, game_date)
);

create index if not exists idx_hooprank_scores_date on hooprank_scores(game_date);

alter table hooprank_scores enable row level security;
create policy "Allow public read on hooprank_scores" on hooprank_scores for select using (true);
create policy "Allow authenticated insert on hooprank_scores" on hooprank_scores for insert with check (auth.uid() = user_id);
create policy "Allow user update own scores" on hooprank_scores for update using (auth.uid() = user_id);
