-- ==========================================
-- Table: draft_picks (résultats de draft)
-- ==========================================
--
-- Table distincte du journal des mouvements : une draft a sa propre forme (tour,
-- rang, université) et se consulte autrement — on lit « la draft 2003 » en
-- entier, pas un événement isolé.
--
-- `draft_year` est l'année civile de la draft, celle de Basketball Reference :
-- la draft de juin 2025 porte 2025. `season` est la saison qu'elle ouvre,
-- 2025-26, pour que les sélecteurs de saison du site restent cohérents.
--
-- `player_id` est l'identifiant NBA, quand le rapprochement de noms aboutit. Il
-- reste nul sinon : le pick s'affiche alors sans lien vers la fiche joueur.

create table if not exists public.draft_picks (
  draft_year integer not null,
  pick_overall integer not null,
  season text not null,
  round integer not null,
  pick_in_round integer,
  team_tricode text not null,
  -- Nul pour un choix non exercé : la ligue retire parfois un choix à une
  -- équipe, et le rang existe alors sans joueur (le 60e choix 2025 de New York).
  player_name text,
  player_id integer,
  br_slug text,
  college text,
  updated_at timestamptz not null default now(),
  primary key (draft_year, pick_overall)
);

create index if not exists idx_draft_picks_season on public.draft_picks (season);
create index if not exists idx_draft_picks_team on public.draft_picks (team_tricode, draft_year);
create index if not exists idx_draft_picks_player on public.draft_picks (player_id);

alter table public.draft_picks enable row level security;

drop policy if exists "Allow public read on draft_picks" on public.draft_picks;
create policy "Allow public read on draft_picks"
  on public.draft_picks for select using (true);
