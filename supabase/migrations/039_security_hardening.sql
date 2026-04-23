-- Supabase security advisor remediation:
--   1. Remove overly permissive USING (true) policies on server-only tables.
--      injuries and player_career_stats are written exclusively by sync-*
--      routes running with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--      Public read stays; mutations fall back to service-role-only access.
--   2. Pin search_path on handle_new_user (SECURITY DEFINER). Without this,
--      a compromised role-local search_path could hijack unqualified names.
--   3. Drop the broad "Public read" policy on the media bucket. Public URLs
--      from getPublicUrl() continue to work via the bucket's public flag;
--      dropping the policy prevents anon clients from listing all objects.

-- 1a. injuries — keep public read, drop service mutation policies
drop policy if exists "Allow service insert on injuries" on public.injuries;
drop policy if exists "Allow service update on injuries" on public.injuries;
drop policy if exists "Allow service delete on injuries" on public.injuries;

-- 1b. player_career_stats — keep public read, drop public mutation policies
drop policy if exists "Allow public insert on player_career_stats" on public.player_career_stats;
drop policy if exists "Allow public update on player_career_stats" on public.player_career_stats;
drop policy if exists "Allow public delete on player_career_stats" on public.player_career_stats;

-- 2. handle_new_user — pin search_path
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Joueur anonyme'
    )
  );
  return new;
end;
$$;

-- 3. media bucket — drop broad SELECT policy (public URLs still work)
drop policy if exists "Public read" on storage.objects;
