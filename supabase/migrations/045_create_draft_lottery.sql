-- ==========================================
-- Table: draft_lottery (grille de la loterie)
-- ==========================================
--
-- Aucune source exploitable ne publie le résultat d'une loterie : Basketball
-- Reference n'a pas de page dédiée (404) et la NBA ne l'expose pas. La grille se
-- reconstruit donc à partir de ce que le site possède déjà — le classement de la
-- saison précédente — et des probabilités officielles de l'époque.
--
-- Ce qui est stocké est ce qui se démontre :
--
--   pre_lottery_rank  Rang à l'envers du classement, 1 pour le pire bilan. Les
--                     égalités sont signalées par `tied`, la ligue les tranchant
--                     par tirage au sort que nous ne connaissons pas.
--   odds_top1         Probabilité d'obtenir le premier choix, selon la grille en
--                     vigueur cette année-là (plate à 14 % depuis 2019).
--
-- Ce qui n'est PAS stocké, faute de source : le mouvement réel de chaque équipe
-- à l'issue du tirage. L'ordre des picks 1 à 14 est connu, mais un pick peut
-- avoir été échangé, et rien n'indique son propriétaire d'origine. L'interface
-- affiche donc la grille des probabilités à côté de l'ordre réel de la draft,
-- sans prétendre relier les deux.

create table if not exists public.draft_lottery (
  draft_year integer not null,
  team_tricode text not null,
  -- Saison dont le classement détermine la loterie (celle qui vient de finir).
  from_season text not null,
  pre_lottery_rank integer not null,
  wins integer,
  losses integer,
  odds_top1 numeric(5, 2),
  -- Bilan à égalité avec une autre équipe : la ligue tranche par tirage au sort.
  tied boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (draft_year, team_tricode)
);

create index if not exists idx_draft_lottery_year on public.draft_lottery (draft_year, pre_lottery_rank);

alter table public.draft_lottery enable row level security;

drop policy if exists "Allow public read on draft_lottery" on public.draft_lottery;
create policy "Allow public read on draft_lottery"
  on public.draft_lottery for select using (true);
