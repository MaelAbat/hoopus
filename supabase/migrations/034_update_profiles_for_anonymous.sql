-- Adapter le trigger handle_new_user pour les utilisateurs anonymes
-- (pas d'email, display_name passé via raw_user_meta_data)

create or replace function public.handle_new_user()
returns trigger as $$
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
$$ language plpgsql security definer;
