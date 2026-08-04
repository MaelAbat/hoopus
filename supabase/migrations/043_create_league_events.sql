-- ==========================================
-- Table: league_events (journal des mouvements de la ligue)
-- ==========================================
--
-- Un seul journal pour tout ce qui bouge hors des parquets : échanges,
-- signatures, joueurs coupés, réclamations au ballottage, conversions de
-- contrat, retraites. Les périodes de l'année (draft, free agency, date limite)
-- ne sont pas des types d'événements mais des moments : elles sont dérivées de
-- la date et rangées dans `phase`, ce qui laisse un seul modèle à interroger.
--
-- La source est le journal de transactions de Basketball Reference, une page par
-- saison. Deux conséquences assumées :
--
--   * Aucun identifiant de transaction n'existe côté source. `event_key` est une
--     empreinte de la date et du texte brut normalisé : elle rend le sync
--     idempotent. Elle n'inclut pas `season`, dont la règle de rattachement peut
--     évoluer sans provoquer de doublons.
--   * `raw` conserve la phrase d'origine. BR produit des lignes incomplètes
--     (« The traded FROM_TRADE to the Minnesota Timberwolves ») : mieux vaut un
--     événement affiché sobrement qu'un événement perdu.
--
-- Le texte affiché n'est pas stocké : l'interface écrit la phrase en français
-- depuis les champs structurés (src/lib/market.ts). Reformuler ne demande donc
-- aucune resynchronisation.

create table if not exists public.league_events (
  id bigserial primary key,
  -- Empreinte déterministe (date + texte normalisé) — voir eventKey().
  event_key text not null unique,

  -- Saison de rattachement, déduite de la date : un mouvement de juillet
  -- appartient à la saison qui s'ouvre, pas à celle qui vient de finir.
  season text not null,
  event_date date not null,
  -- Période de la saison au moment du mouvement, quand elle est identifiable.
  phase text,

  -- 'trade' | 'signature' | 'waiver' | 'claim' | 'conversion' | 'option'
  -- | 'retirement' | 'other'
  kind text not null,

  -- Toutes les équipes concernées, pour filtrer sans se soucier du sens.
  teams text[] not null default '{}',
  -- Sens du mouvement quand il en a un : d'où part le joueur, où il arrive.
  from_team text,
  to_team text,

  -- [{ name, player_id, br_slug, from, to, role: 'player' | 'coach' }]
  -- Le sens est porté par joueur, et non par l'événement : un échange fait
  -- circuler des joueurs dans les deux directions, parfois entre trois équipes.
  -- player_id reste nul quand le rapprochement de noms échoue, et pour tout
  -- l'encadrement : l'événement s'affiche alors sans lien plutôt que de
  -- disparaître.
  players jsonb not null default '[]',
  -- [{ type: 'pick' | 'cash' | 'exception' | 'swap' | 'rights',
  --    year, round, from_team, to_team, detail }]
  assets jsonb not null default '[]',
  -- { type: 'two_way' | 'multi_year' | 'ten_day' | 'rest_of_season'
  --        | 'exhibit_10' | 'standard', years, detail }
  contract jsonb,
  -- Précision libre selon le type : durée d'une suspension, poste concerné par
  -- un mouvement d'encadrement.
  detail text,

  raw text not null,
  source text not null default 'basketball-reference',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La page Marché lit une saison entière, triée du plus récent au plus ancien.
create index if not exists idx_league_events_season_date
  on public.league_events (season, event_date desc);
-- Fiche joueur et fiche équipe.
create index if not exists idx_league_events_teams
  on public.league_events using gin (teams);
create index if not exists idx_league_events_players
  on public.league_events using gin (players);
-- Filtres par type et par période.
create index if not exists idx_league_events_kind
  on public.league_events (season, kind);

-- Lecture publique : la rubrique Marché est ouverte à tous.
-- Écritures réservées au service role, qui contourne RLS (voir 039).
alter table public.league_events enable row level security;

drop policy if exists "Allow public read on league_events" on public.league_events;
create policy "Allow public read on league_events"
  on public.league_events for select using (true);
