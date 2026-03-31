-- Daily Hoopixl scores: one row per user per day
create table if not exists hoopixl_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  display_name text not null default '',
  game_date text not null,
  guesses integer not null,
  time_seconds integer not null,
  won boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, game_date)
);

create index if not exists idx_hoopixl_scores_date on hoopixl_scores(game_date);

alter table hoopixl_scores enable row level security;
create policy "Allow public read on hoopixl_scores" on hoopixl_scores for select using (true);
create policy "Allow authenticated insert on hoopixl_scores" on hoopixl_scores for insert with check (auth.uid() = user_id);
create policy "Allow user update own hoopixl scores" on hoopixl_scores for update using (auth.uid() = user_id);
