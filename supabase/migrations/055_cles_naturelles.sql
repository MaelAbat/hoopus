-- Clés primaires naturelles sur quatre tables très lues.
--
-- Chacune avait une colonne `id` (uuid ou entier) et sa clé primaire, que rien
-- ne lisait — 0 lecture en dix-sept jours, d'après pg_stat_user_indexes —, à
-- côté de la vraie clé, unique, que les upserts et les pages utilisent. Chaque
-- écriture tenait les deux index à jour, et l'index inutile occupait la mémoire
-- d'une petite instance (8,6 Mo pour stat_leaders seule). La clé naturelle
-- devient la clé primaire, et `id` disparaît.
--
-- Le code a été vérifié : aucune requête ne lit ni ne filtre `id` sur ces
-- tables. Les upserts désignent leurs colonnes (`onConflict: "game_id"`…), ils
-- s'appuient indifféremment sur une contrainte unique ou une clé primaire.
--
-- Chaque clé est reconstruite une fois : à exécuter quand le budget d'accès
-- disque de Supabase est rechargé.

-- stat_leaders : (category, player_name, season, season_type)
alter table public.stat_leaders drop constraint if exists stat_leaders_pkey;
alter table public.stat_leaders drop column if exists id;
alter table public.stat_leaders drop constraint if exists stat_leaders_cat_name_season_type_key;
alter table public.stat_leaders add constraint stat_leaders_pkey
  primary key (category, player_name, season, season_type);

-- games : (game_id)
alter table public.games drop constraint if exists games_pkey;
alter table public.games drop column if exists id;
alter table public.games drop constraint if exists games_game_id_key;
alter table public.games add constraint games_pkey primary key (game_id);

-- player_career_stats : (player_id, season, team)
alter table public.player_career_stats drop constraint if exists player_career_stats_pkey;
alter table public.player_career_stats drop column if exists id;
alter table public.player_career_stats drop constraint if exists player_career_stats_player_id_season_team_key;
alter table public.player_career_stats add constraint player_career_stats_pkey
  primary key (player_id, season, team);

-- rosters : (season, player_id)
alter table public.rosters drop constraint if exists rosters_pkey;
alter table public.rosters drop column if exists id;
alter table public.rosters drop constraint if exists rosters_season_player_id_key;
alter table public.rosters add constraint rosters_pkey primary key (season, player_id);
