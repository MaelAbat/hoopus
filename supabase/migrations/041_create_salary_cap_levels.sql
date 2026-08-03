-- ==========================================
-- Table: salary_cap_levels (seuils de masse salariale par saison)
-- ==========================================
--
-- Les quatre seuils de la convention collective — plafond, luxury tax, premier
-- et second apron — étaient codés en dur. Une saison absente recevait
-- silencieusement les montants de la précédente, ce qui faussait les verdicts
-- de la trade machine sans que rien ne l'indique, et imposait une modification
-- du code chaque été.
--
-- Ils vivent désormais ici :
--   * une saison inconnue est projetée automatiquement par /api/sync-season, au
--     taux maximal prévu par la convention (+10 % par an), avec is_estimated à
--     true — le site reste donc juste-ish et fonctionnel sans intervention ;
--   * corriger un montant réel se fait par un UPDATE d'une ligne, sans toucher
--     au code ni redéployer.
--
-- La ligue publie ses seuils début juillet. La fenêtre d'estimation va donc de
-- la fin des Finales à cette annonce.

create table if not exists public.salary_cap_levels (
  season text primary key,
  salary_cap bigint not null,
  luxury_tax bigint not null,
  first_apron bigint not null,
  second_apron bigint not null,
  -- Montants projetés plutôt qu'annoncés. L'interface le signale.
  is_estimated boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Lecture publique : /equipes et /trades en ont besoin au rendu.
-- Écritures réservées au service role, qui contourne RLS (voir 039).
alter table public.salary_cap_levels enable row level security;

drop policy if exists "Allow public read on salary_cap_levels" on public.salary_cap_levels;
create policy "Allow public read on salary_cap_levels"
  on public.salary_cap_levels for select using (true);

-- Montants officiels connus, annonces de la ligue.
insert into public.salary_cap_levels
  (season, salary_cap, luxury_tax, first_apron, second_apron, is_estimated)
values
  ('2024-25', 140588000, 170814000, 178132000, 188931000, false),
  ('2025-26', 154647000, 187895000, 195945000, 207824000, false)
on conflict (season) do nothing;
