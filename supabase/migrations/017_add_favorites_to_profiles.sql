-- Add favorites columns to profiles
alter table public.profiles
  add column if not exists favorite_teams text[] not null default '{}',
  add column if not exists followed_players int[] not null default '{}';
