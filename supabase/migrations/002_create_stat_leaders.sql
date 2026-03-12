-- ==========================================
-- Table: stat_leaders (cache des stats NBA)
-- ==========================================
create table public.stat_leaders (
  id uuid default gen_random_uuid() primary key,
  category text not null,       -- PTS, REB, AST, BLK, STL, FG3_PCT
  rank integer not null,
  player_name text not null,
  team text not null,
  value numeric not null,
  season text not null default '2025-26',
  updated_at timestamptz default now(),
  unique(category, rank, season)
);

alter table public.stat_leaders enable row level security;
create policy "Allow public read on stat_leaders" on public.stat_leaders for select using (true);
create policy "Allow public insert on stat_leaders" on public.stat_leaders for insert with check (true);
create policy "Allow public update on stat_leaders" on public.stat_leaders for update using (true);
create policy "Allow public delete on stat_leaders" on public.stat_leaders for delete using (true);
