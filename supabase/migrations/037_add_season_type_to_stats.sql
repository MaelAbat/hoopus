-- ==========================================
-- Add season_type to stat_leaders and team_stats
-- so Regular Season and Playoffs data can coexist.
-- Default keeps existing rows tagged as "regular".
-- ==========================================

alter table public.stat_leaders
  add column if not exists season_type text not null default 'regular';

-- Postgres auto-named the original unique (category, player_name, season) key,
-- so drop it dynamically instead of guessing the name.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'stat_leaders'
      and con.contype = 'u'
      and con.conname <> 'stat_leaders_cat_name_season_type_key'
  loop
    execute format('alter table public.stat_leaders drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.stat_leaders
  drop constraint if exists stat_leaders_cat_name_season_type_key;

alter table public.stat_leaders
  add constraint stat_leaders_cat_name_season_type_key
  unique (category, player_name, season, season_type);

create index if not exists idx_stat_leaders_season_type
  on public.stat_leaders (season, season_type);

alter table public.team_stats
  add column if not exists season_type text not null default 'regular';

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'team_stats'
      and con.contype = 'u'
      and con.conname <> 'team_stats_team_id_season_type_key'
  loop
    execute format('alter table public.team_stats drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.team_stats
  drop constraint if exists team_stats_team_id_season_type_key;

alter table public.team_stats
  add constraint team_stats_team_id_season_type_key
  unique (team_id, season, season_type);

create index if not exists idx_team_stats_season_type
  on public.team_stats (season, season_type);
