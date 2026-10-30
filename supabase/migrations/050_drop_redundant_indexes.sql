-- Index entièrement couverts par un autre, plus large, qui commence par les
-- mêmes colonnes : Postgres sait se servir des premières colonnes d'un index
-- composite. Ils ne servaient donc à aucune lecture, mais chaque écriture dans
-- ces tables devait les tenir à jour — sur stat_leaders, réécrite chaque jour,
-- c'était autant de budget d'accès disque consommé pour rien.

-- (season) et (season, season_type) : couverts par idx_stat_leaders_page_order
-- (season, season_type, rank, category, player_name).
drop index if exists public.idx_stat_leaders_season;
drop index if exists public.idx_stat_leaders_season_type;

-- (season) : couvert par idx_games_season_type (season, game_type).
drop index if exists public.idx_games_season;

-- (player_id) : couvert par la contrainte unique (player_id, season, team).
drop index if exists public.idx_career_player;

-- (season) : couvert par la contrainte unique (season, player_id).
drop index if exists public.idx_rosters_season;

-- (season) : couvert par idx_player_contracts_name (season, normalized_name).
drop index if exists public.idx_player_contracts_season;
