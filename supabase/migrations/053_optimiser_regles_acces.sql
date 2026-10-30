-- Dernières alertes des Advisors de Supabase, côté performance.
--
-- 1. Règles d'accès qui recalculaient l'utilisateur à chaque ligne.
--    Écrit `auth.uid()`, l'appel est réévalué pour chaque ligne lue ; écrit
--    `(select auth.uid())`, Postgres l'évalue une fois par requête. Les règles
--    sont relues telles qu'elles existent en base — pas recopiées des
--    anciennes migrations, au cas où l'une aurait été retouchée depuis le
--    dashboard — et seule cette expression change.
--
-- 2. Deux règles de lecture sur quizzes (publiés pour tous, tous pour les
--    admins) : Postgres évaluait les deux à chaque lecture. Fusionnées en une.
--
-- 3. Clés étrangères sans index : quizzes.created_by et
--    user_achievements.achievement_id (user_id est déjà couvert par la
--    contrainte unique (user_id, achievement_id)).

-- 2. quizzes : une seule règle de lecture.
drop policy if exists "Allow public read published quizzes" on public.quizzes;
drop policy if exists "Allow admin read all quizzes" on public.quizzes;
create policy "Lecture des quiz publiés, ou de tous pour un admin" on public.quizzes
  for select using (
    published = true
    or exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
  );

-- 1. auth.uid(), auth.jwt() et auth.role() évalués une fois par requête.
do $$
declare
  p record;
  pattern constant text := '(?<!select )auth\.(uid|jwt|role)\(\)';
  new_qual text;
  new_check text;
  roles text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~* pattern or coalesce(with_check, '') ~* pattern)
  loop
    new_qual := regexp_replace(p.qual, pattern, '(select auth.\1())', 'gi');
    new_check := regexp_replace(p.with_check, pattern, '(select auth.\1())', 'gi');
    select string_agg(case when r = 'public' then 'public' else quote_ident(r) end, ', ')
      into roles from unnest(p.roles) as r;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format(
      'create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, p.permissive, p.cmd, roles,
      case when new_qual is not null then ' using (' || new_qual || ')' else '' end,
      case when new_check is not null then ' with check (' || new_check || ')' else '' end
    );
    raise notice 'règle optimisée : %.%', p.tablename, p.policyname;
  end loop;
end $$;

-- 3. Index des clés étrangères.
create index if not exists idx_quizzes_created_by on public.quizzes (created_by);
create index if not exists idx_user_achievements_achievement on public.user_achievements (achievement_id);
