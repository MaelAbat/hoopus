-- ==========================================
-- Table: league_state (saison courante de la ligue)
-- ==========================================
--
-- La saison ne peut pas être déduite du calendrier. La règle « octobre =
-- nouvelle saison » faisait écrire les mouvements de l'intersaison (trades,
-- signatures, salaires) dans la saison qui venait de se terminer.
--
-- Trois notions distinctes, parce qu'elles ne basculent pas au même moment :
--
--   current_season   La saison dans laquelle la ligue se trouve. Bascule dès
--                    que les Finales sont jouées. C'est la saison des
--                    effectifs, des salaires et des échanges.
--   stats_season     La dernière saison comportant des matchs réellement
--                    joués. Sert de défaut aux pages de statistiques, au
--                    classement et aux mini-jeux, qui seraient vides sinon
--                    entre juin et octobre.
--   schedule_season  La dernière saison comportant des matchs, joués ou non.
--                    Sert de défaut au calendrier, pour afficher le nouveau
--                    programme dès sa publication (mi-août).
--
-- Une seule ligne, garantie par la clé primaire booléenne contrainte à true.

create table if not exists public.league_state (
  id boolean primary key default true,
  current_season text not null,
  stats_season text not null,
  schedule_season text not null,
  -- Dernière saison dont les Finales sont terminées, et son vainqueur.
  last_completed_season text,
  finals_champion text,
  updated_at timestamptz not null default now(),
  constraint league_state_single_row check (id)
);

-- Lecture publique : chaque page lit la saison courante.
-- Écritures réservées au service role, qui contourne RLS — donc aucune policy
-- de mutation, comme pour injuries et player_career_stats (voir 039).
alter table public.league_state enable row level security;

drop policy if exists "Allow public read on league_state" on public.league_state;
create policy "Allow public read on league_state"
  on public.league_state for select using (true);

-- Amorçage depuis les données déjà présentes, pour que le site soit correct
-- immédiatement après la migration sans attendre le prochain cron.
do $$
declare
  v_finals_season text;
  v_champion      text;
  v_stats         text;
  v_schedule      text;
  v_start         int;
  v_current       text;
begin
  -- Dernières Finales décidées (une série se gagne en 4 victoires).
  select season,
         case when wins_top >= 4 then team_top else team_bottom end
    into v_finals_season, v_champion
    from public.playoff_series
   where round = 4
     and greatest(wins_top, wins_bottom) >= 4
   order by left(season, 4)::int desc
   limit 1;

  select season into v_stats
    from public.games
   where status = 3
   order by left(season, 4)::int desc
   limit 1;

  select season into v_schedule
    from public.games
   order by left(season, 4)::int desc
   limit 1;

  if v_finals_season is not null then
    -- Les Finales sont jouées : la ligue est passée à la saison suivante.
    v_start := left(v_finals_season, 4)::int + 1;
    v_current := v_start || '-' || lpad(((v_start + 1) % 100)::text, 2, '0');
  else
    v_current := coalesce(v_stats, v_schedule, '2025-26');
  end if;

  insert into public.league_state (
    id, current_season, stats_season, schedule_season,
    last_completed_season, finals_champion
  )
  values (
    true, v_current,
    coalesce(v_stats, v_current),
    coalesce(v_schedule, v_current),
    v_finals_season, v_champion
  )
  on conflict (id) do nothing;
end $$;
