-- Daily HoopMore scores: one row per user per day
create table if not exists hoopmore_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  display_name text not null default '',
  game_date text not null,
  streak integer not null,
  category text not null,
  time_seconds integer not null,
  created_at timestamptz not null default now(),
  unique(user_id, game_date)
);

create index if not exists idx_hoopmore_scores_date on hoopmore_scores(game_date);

alter table hoopmore_scores enable row level security;
create policy "Allow public read on hoopmore_scores" on hoopmore_scores for select using (true);
create policy "Allow authenticated insert on hoopmore_scores" on hoopmore_scores for insert with check (auth.uid() = user_id);
create policy "Allow user update own scores" on hoopmore_scores for update using (auth.uid() = user_id);
