-- Les API de la NBA (CDN et stats.nba.com) refusent désormais nos accès : le
-- calendrier et les scores viennent d'ESPN à partir de la saison 2026-27.
--
-- Jusqu'ici, la saison, le type de match et le tour de playoffs se lisaient dans
-- la structure de l'identifiant NBA (« 0042500405 » : playoffs, 2025-26, finale).
-- Un match ESPN n'a pas d'identifiant NBA : ces informations deviennent des
-- colonnes, remplies ici pour les matchs déjà en base.
--
--   source         'nba' ou 'espn'
--   game_type      'preseason', 'regular', 'allstar', 'playoffs', 'playin'
--   playoff_round  1 à 4 pour les playoffs, null sinon

alter table public.games
  add column if not exists source text not null default 'nba',
  add column if not exists game_type text,
  add column if not exists playoff_round smallint;

update public.games
set game_type = case substr(game_id, 1, 3)
      when '001' then 'preseason'
      when '002' then 'regular'
      when '003' then 'allstar'
      when '004' then 'playoffs'
      when '005' then 'playin'
    end,
    playoff_round = case
      when game_id like '004%' then nullif(substr(game_id, 7, 2), '')::smallint
    end
where source = 'nba' and game_id ~ '^\d{10}$';

create index if not exists idx_games_season_type on public.games (season, game_type);
