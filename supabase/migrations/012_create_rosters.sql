create table if not exists rosters (
  id uuid default gen_random_uuid() primary key,
  season text not null,
  player_id integer not null,
  first_name text not null,
  last_name text not null,
  team_tricode text not null,
  team_name text not null,
  team_city text not null,
  jersey_number text not null default '',
  position text not null default '',
  height text not null default '',
  weight text not null default '',
  age integer,
  college text not null default '',
  country text not null default '',
  draft_year integer,
  draft_round integer,
  draft_number integer,
  pts numeric,
  reb numeric,
  ast numeric,
  updated_at timestamptz not null default now(),
  unique(season, player_id)
);

alter table rosters enable row level security;

create policy "Allow public read on rosters"
  on rosters for select using (true);

create policy "Allow public insert on rosters"
  on rosters for insert with check (true);

create policy "Allow public update on rosters"
  on rosters for update using (true);

create policy "Allow public delete on rosters"
  on rosters for delete using (true);

create index if not exists idx_rosters_season on rosters(season);
create index if not exists idx_rosters_team on rosters(team_tricode, season);
