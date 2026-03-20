create table if not exists playoff_series (
  id uuid default gen_random_uuid() primary key,
  season text not null,
  round integer not null,           -- 1=first round, 2=conf semis, 3=conf finals, 4=finals
  conference text,                   -- 'East', 'West', null for Finals
  seed_top integer not null,         -- higher seed number (e.g. 1)
  seed_bottom integer not null,      -- lower seed number (e.g. 8)
  team_top text not null,            -- tricode of higher seed
  team_bottom text not null,         -- tricode of lower seed
  wins_top integer not null default 0,
  wins_bottom integer not null default 0,
  status text not null default 'upcoming',  -- upcoming, active, completed
  games jsonb not null default '[]',        -- [{game_number, home_team, away_team, home_score, away_score, status, game_date}]
  updated_at timestamptz not null default now(),
  unique(season, round, team_top, team_bottom)
);

alter table playoff_series enable row level security;

create policy "Allow public read on playoff_series"
  on playoff_series for select using (true);

create policy "Allow public insert on playoff_series"
  on playoff_series for insert with check (true);

create policy "Allow public update on playoff_series"
  on playoff_series for update using (true);

create policy "Allow public delete on playoff_series"
  on playoff_series for delete using (true);

create index if not exists idx_playoff_series_season on playoff_series(season);
