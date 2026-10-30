-- Instantané de la page /statistiques (voir src/lib/stat-pages.ts).
--
-- La page lisait les ~22 000 lignes d'une saison dans stat_leaders, en vingt-
-- deux requêtes triées, chaque fois que son cache se vidait : c'était la plus
-- grosse lecture restante de la base. sync-stats écrit désormais ici une copie
-- compacte de ces lignes, une par saison et par type, lue en une requête.

create table if not exists public.stat_pages (
  season text not null,
  season_type text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (season, season_type)
);

alter table public.stat_pages enable row level security;

-- Lecture publique ; l'écriture reste réservée à la clé service des syncs.
create policy "Lecture publique" on public.stat_pages for select using (true);
