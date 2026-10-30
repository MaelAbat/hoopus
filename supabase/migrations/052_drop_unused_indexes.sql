-- Index jamais lus, ou en double, d'après pg_stat_user_indexes entre le
-- 13 et le 30 octobre 2026 : dix-sept jours de trafic et de syncs.
--
-- Un index inutilisé ne coûte rien en lecture, mais chaque écriture dans sa
-- table doit le tenir à jour : c'est du budget d'accès disque consommé pour
-- rien. Ne sont gardés que les index qui servent, ceux qui portent une
-- contrainte (clé primaire, unicité utilisée par les upserts), et
-- idx_league_events_players, qui ne servait pas parce que la section
-- « Parcours sur le marché » des fiches joueurs était cassée — elle en a
-- besoin maintenant qu'elle est réparée.
--
-- Avant chaque suppression, le code a été vérifié : aucune requête du site ne
-- filtre sur ces colonnes de façon à en avoir besoin.

-- stat_leaders : 2,9 Mo, 0 lecture. Les lectures passent par
-- idx_stat_leaders_page_order et par la contrainte unique.
drop index if exists public.idx_stat_leaders_category_season;

-- league_events : aucune requête ne filtre sur les équipes.
drop index if exists public.idx_league_events_teams;

-- draft_picks : ni par joueur, ni par équipe.
drop index if exists public.idx_draft_picks_player;
drop index if exists public.idx_draft_picks_team;

-- injuries : 97 lignes, jamais lues par index.
drop index if exists public.idx_injuries_season;
drop index if exists public.idx_injuries_team;

-- player_contracts : la contrainte unique (season, normalized_name,
-- team_tricode) couvre les lectures par saison et par nom.
drop index if exists public.idx_player_contracts_name;
drop index if exists public.idx_player_contracts_player;

-- Petites tables : index jamais lus, ou couverts par une contrainte unique.
drop index if exists public.idx_standings_conference;
drop index if exists public.idx_team_payrolls_season;
drop index if exists public.idx_team_stats_season;
drop index if exists public.idx_playin_games_season;
drop index if exists public.idx_season_phases_dates;

-- players : players_player_id_key double exactement la clé primaire
-- (player_id). Aucune clé étrangère ne s'appuie dessus ; si c'était le cas,
-- la suppression échouerait sans rien casser, d'où le bloc protégé.
do $$
begin
  alter table public.players drop constraint if exists players_player_id_key;
exception when dependent_objects_still_exist then
  raise notice 'players_player_id_key conservé : un objet en dépend';
end $$;
