-- Les tables de données sportives autorisaient tout le monde à écrire.
--
-- Plusieurs migrations leur avaient donné des règles « Allow public insert /
-- update / delete … using (true) ». Or la clé publique (anon) de Supabase est
-- livrée au navigateur de chaque visiteur : n'importe qui pouvait modifier ou
-- vider les statistiques, les matchs ou les blessures, sans passer par le site.
--
-- Ces tables ne sont écrites que par les routes de sync et les scripts, qui
-- utilisent la clé service — laquelle ignore les règles RLS. Les règles
-- d'écriture publiques ne servaient donc qu'à ouvrir la porte : elles sont
-- toutes retirées, quel que soit leur nom. La lecture publique est conservée,
-- et recréée si elle passait par une règle « ALL ».
--
-- La migration 039 l'avait déjà fait pour injuries et player_career_stats ;
-- celle-ci étend la règle à toutes les tables sportives.
--
-- Les tables écrites par les visiteurs eux-mêmes (scores des mini-jeux, quiz,
-- profils, succès, actualités, articles) ne sont pas concernées.

do $$
declare
  t text;
  p record;
  data_tables text[] := array[
    'stat_leaders', 'games', 'standings', 'playoff_series', 'playin_games',
    'players', 'rosters', 'player_career_stats', 'team_stats', 'boxscores',
    'injuries', 'league_events', 'league_state', 'draft_picks', 'draft_lottery',
    'player_contracts', 'team_payrolls', 'season_phases', 'salary_cap_levels',
    'league_averages'
  ];
begin
  foreach t in array data_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    for p in
      select policyname, cmd from pg_policies
      where schemaname = 'public' and tablename = t
        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
      raise notice 'règle retirée : %.% (%)', t, p.policyname, p.cmd;
    end loop;

    -- league_averages n'est lue que par la clé service : pas de lecture publique.
    if t <> 'league_averages' and not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and cmd = 'SELECT'
    ) then
      execute format('create policy "Lecture publique" on public.%I for select using (true)', t);
      raise notice 'lecture publique recréée : %', t;
    end if;
  end loop;
end $$;

-- Fonction déclenchée à la création d'un compte. Elle s'exécute avec les droits
-- de son propriétaire (SECURITY DEFINER) : l'appeler directement depuis l'API
-- n'a aucune raison d'être. Le déclencheur, lui, n'a pas besoin de ce droit.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
