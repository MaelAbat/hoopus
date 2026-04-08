-- NBA injury report (synced from ESPN API)
create table if not exists injuries (
  id bigint generated always as identity primary key,
  player_name text not null,
  player_position text,
  team text not null,
  status text not null,             -- 'Out', 'Day-To-Day'
  injury_type text,                 -- body part: 'Ankle', 'Knee', etc.
  injury_detail text,               -- 'Sprain', 'Soreness', etc.
  injury_side text,                 -- 'Left', 'Right'
  return_date date,
  short_comment text,
  season text not null,
  updated_at timestamptz not null default now(),
  unique(player_name, team, season)
);

alter table injuries enable row level security;

create policy "Allow public read on injuries"
  on injuries for select using (true);
create policy "Allow service insert on injuries"
  on injuries for insert with check (true);
create policy "Allow service update on injuries"
  on injuries for update using (true);
create policy "Allow service delete on injuries"
  on injuries for delete using (true);

create index if not exists idx_injuries_season on injuries(season);
create index if not exists idx_injuries_team on injuries(team, season);
