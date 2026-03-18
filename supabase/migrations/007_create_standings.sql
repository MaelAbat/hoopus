create table if not exists standings (
  id uuid default gen_random_uuid() primary key,
  conference text not null,
  team_tricode text not null,
  team_name text not null,
  team_city text not null,
  wins integer not null default 0,
  losses integer not null default 0,
  win_pct numeric not null default 0,
  home_record text not null default '0-0',
  road_record text not null default '0-0',
  last_10 text not null default '0-0',
  streak text not null default '',
  conference_rank integer not null default 0,
  season text not null default '2025-26',
  updated_at timestamptz not null default now(),
  unique(team_tricode, season)
);

alter table standings enable row level security;

create policy "Allow public read on standings"
  on standings for select using (true);

create policy "Allow public insert on standings"
  on standings for insert with check (true);

create policy "Allow public update on standings"
  on standings for update using (true);

create policy "Allow public delete on standings"
  on standings for delete using (true);

create index if not exists idx_standings_season on standings(season);
create index if not exists idx_standings_conference on standings(conference, season);
