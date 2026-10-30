-- Nettoyage des comptes anonymes abandonnés.
--
-- Chaque visiteur qui ouvre un mini-jeu reçoit un compte anonyme, et rien ne
-- les supprimait : la table des comptes ne fait que grossir avec le trafic.
-- Sont supprimés les comptes anonymes sans activité depuis `inactive_days`
-- jours ET sans le moindre score ni quiz : un joueur anonyme qui a un score
-- figure dans les classements, il est gardé. Son profil et ses succès partent
-- avec lui (suppression en cascade).
--
-- Appelée chaque jour par la route /api/sync-cleanup, avec la clé service.

create or replace function public.purge_stale_anonymous_users(inactive_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  removed integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => inactive_days)
    and not exists (select 1 from public.hoopgrid_scores s where s.user_id = u.id)
    and not exists (select 1 from public.hoopixl_scores s where s.user_id = u.id)
    and not exists (select 1 from public.hoopl_scores s where s.user_id = u.id)
    and not exists (select 1 from public.hooplink_scores s where s.user_id = u.id)
    and not exists (select 1 from public.hoopmore_scores s where s.user_id = u.id)
    and not exists (select 1 from public.hooprank_scores s where s.user_id = u.id)
    and not exists (select 1 from public.quiz_scores s where s.user_id = u.id)
    and not exists (select 1 from public.quizzes q where q.created_by = u.id);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Réservée à la clé service : un visiteur n'a pas à pouvoir la déclencher.
revoke execute on function public.purge_stale_anonymous_users(integer) from public, anon, authenticated;
grant execute on function public.purge_stale_anonymous_users(integer) to service_role;
