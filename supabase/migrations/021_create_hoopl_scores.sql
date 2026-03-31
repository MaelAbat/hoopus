-- Daily Hoopl scores: one row per user per day
create table if not exists hoopl_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  display_name text not null default '',
  game_date text not null,          -- "2026-03-31"
  guesses integer not null,         -- number of attempts (1-10)
  time_seconds integer not null,    -- time taken in seconds
  won boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id, game_date)
);

create index if not exists idx_hoopl_scores_date on hoopl_scores(game_date);

alter table hoopl_scores enable row level security;
create policy "Allow public read on hoopl_scores" on hoopl_scores for select using (true);
create policy "Allow authenticated insert on hoopl_scores" on hoopl_scores for insert with check (auth.uid() = user_id);
create policy "Allow user update own scores" on hoopl_scores for update using (auth.uid() = user_id);
