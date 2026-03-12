-- ==========================================
-- Table: games (calendrier NBA)
-- ==========================================
create table public.games (
  id uuid default gen_random_uuid() primary key,
  game_id text unique not null,
  game_date date not null,
  game_time text,              -- ex: "8:30 pm ET"
  status integer not null,     -- 1=scheduled, 2=live, 3=final
  status_text text,            -- ex: "Final", "8:30 pm ET", "Q3 5:22"
  home_team text not null,     -- tricode ex: "LAL"
  home_team_name text,
  home_score integer default 0,
  away_team text not null,
  away_team_name text,
  away_score integer default 0,
  arena text,
  arena_city text,
  season text not null default '2025-26',
  updated_at timestamptz default now()
);

create index idx_games_date on public.games (game_date);
create index idx_games_season on public.games (season);

alter table public.games enable row level security;
create policy "Allow public read on games" on public.games for select using (true);
create policy "Allow public insert on games" on public.games for insert with check (true);
create policy "Allow public update on games" on public.games for update using (true);
create policy "Allow public delete on games" on public.games for delete using (true);
