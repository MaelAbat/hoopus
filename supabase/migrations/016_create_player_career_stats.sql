-- Player career stats: one row per player per season per team
create table public.player_career_stats (
  id uuid default gen_random_uuid() primary key,
  player_id integer not null,
  season text not null,           -- e.g. "2024-25"
  team text not null,             -- tricode or "TOT"
  gp integer default 0,
  min numeric(5,1) default 0,
  pts numeric(5,1) default 0,
  reb numeric(5,1) default 0,
  ast numeric(5,1) default 0,
  stl numeric(5,1) default 0,
  blk numeric(5,1) default 0,
  fg_pct numeric(5,3) default 0,
  fg3_pct numeric(5,3) default 0,
  ft_pct numeric(5,3) default 0,
  updated_at timestamptz default now(),
  unique(player_id, season, team)
);

create index idx_career_player on public.player_career_stats (player_id);

alter table public.player_career_stats enable row level security;
create policy "Allow public read on player_career_stats" on public.player_career_stats for select using (true);
create policy "Allow public insert on player_career_stats" on public.player_career_stats for insert with check (true);
create policy "Allow public update on player_career_stats" on public.player_career_stats for update using (true);
create policy "Allow public delete on player_career_stats" on public.player_career_stats for delete using (true);
