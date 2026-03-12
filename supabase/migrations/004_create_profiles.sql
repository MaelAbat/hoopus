-- Table profiles liée à auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Utilisateur',
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
alter table profiles enable row level security;

-- Tout le monde peut lire les profils
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

-- Un utilisateur peut modifier son propre profil
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Insertion automatique du profil à la création d'un user
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger sur la création d'un user auth
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Restreindre les mutations news/articles aux admins
drop policy if exists "allow public insert" on news;
drop policy if exists "allow public update" on news;
drop policy if exists "allow public delete" on news;
drop policy if exists "allow public insert" on articles;
drop policy if exists "allow public update" on articles;
drop policy if exists "allow public delete" on articles;

-- News : lecture publique, écriture admin uniquement
create policy "Admins can insert news"
  on news for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update news"
  on news for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete news"
  on news for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Articles : lecture publique, écriture admin uniquement
create policy "Admins can insert articles"
  on articles for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update articles"
  on articles for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete articles"
  on articles for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
