-- ==========================================
-- Table: season_phases (périodes d'une saison NBA)
-- ==========================================
--
-- Une saison NBA ne se résume pas à ses matchs. Loterie, draft, ouverture de la
-- free agency, date limite des échanges, marché des rachats de contrat : autant
-- de rendez-vous qui structurent l'année et donnent son sens à un mouvement.
-- Un même « waiver » ne raconte pas la même chose en octobre et en mars.
--
-- Aucune source ne publie ces dates de façon exploitable. Elles vivent donc
-- ici, sur le modèle de salary_cap_levels (041) :
--
--   * une saison inconnue reçoit des dates estimées par /api/sync-transactions,
--     à partir des règles habituelles de la ligue, avec is_estimated à true ;
--   * corriger une date réelle se fait par un UPDATE, sans toucher au code.
--
-- Les repères ponctuels (draft, loterie, date limite) ont ends_on = starts_on.
-- Les fenêtres (free agency, marché des rachats) ont une fin distincte.

create table if not exists public.season_phases (
  season text not null,
  -- Clés attendues : 'lottery', 'draft', 'free_agency', 'regular_season',
  -- 'trade_deadline', 'buyout_market', 'playoffs'. Volontairement du texte
  -- libre : ajouter un repère ne doit pas demander de migration.
  phase text not null,
  starts_on date not null,
  ends_on date,
  -- Dates déduites des usages de la ligue plutôt qu'annoncées. L'interface le
  -- signale, comme pour les seuils de masse salariale estimés.
  is_estimated boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (season, phase)
);

create index if not exists idx_season_phases_dates
  on public.season_phases (starts_on, ends_on);

-- Lecture publique : /marche et l'accueil situent la ligue dans son année.
-- Écritures réservées au service role, qui contourne RLS (voir 039).
alter table public.season_phases enable row level security;

drop policy if exists "Allow public read on season_phases" on public.season_phases;
create policy "Allow public read on season_phases"
  on public.season_phases for select using (true);
