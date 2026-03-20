create table if not exists playin_games (
  id uuid default gen_random_uuid() primary key,
  season text not null,
  conference text not null,              -- 'East', 'West'
  matchup_type text not null,            -- 'seven_eight', 'nine_ten', 'final'
  home_team text not null,
  away_team text not null,
  home_seed integer not null,
  away_seed integer not null,
  home_score integer not null default 0,
  away_score integer not null default 0,
  status integer not null default 1,     -- 1=scheduled, 2=in progress, 3=final
  game_date text not null default '',
  winner text,                           -- tricode of winner, null if not finished
  updated_at timestamptz not null default now(),
  unique(season, conference, matchup_type)
);

alter table playin_games enable row level security;

create policy "Allow public read on playin_games"
  on playin_games for select using (true);

create policy "Allow public insert on playin_games"
  on playin_games for insert with check (true);

create policy "Allow public update on playin_games"
  on playin_games for update using (true);

create policy "Allow public delete on playin_games"
  on playin_games for delete using (true);

create index if not exists idx_playin_games_season on playin_games(season);
