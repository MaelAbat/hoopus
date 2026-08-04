-- ==========================================
-- Table: player_contracts (termes des contrats en cours)
-- ==========================================
--
-- Aucune source de transactions ne chiffre ses lignes : ni Basketball Reference,
-- ni ESPN, dont aucune des 268 entrées de 2026 ne mentionne le moindre montant.
-- Répondre à « combien » demande donc une lecture à part, celle des pages
-- `/contracts/{TRI}.html`, qui publient le dû saison par saison et le total
-- garanti restant.
--
-- Ce que cette table est, et ce qu'elle n'est pas :
--
--   * Elle décrit les contrats **en cours**. Pour une signature de cette
--     intersaison, c'est exactement le contrat signé — d'où son intérêt sur la
--     rubrique Marché.
--   * Elle ne dira jamais ce qu'un joueur avait signé en 2017 : la source ne
--     garde pas l'historique. Les mouvements anciens resteront donc sans montant,
--     et l'interface s'abstient plutôt que d'afficher un chiffre d'aujourd'hui à
--     côté d'une signature d'hier.
--
-- `years` porte les montants annuels, dans l'ordre : [{ season, amount }].

create table if not exists public.player_contracts (
  id bigserial primary key,
  -- Saison de référence : celle de la première année due (colonne y1 de BR).
  season text not null,
  team_tricode text not null,
  player_name text not null,
  -- Nom normalisé, seule clé de rapprochement avec les mouvements : la page de
  -- contrats ne porte aucun identifiant NBA.
  normalized_name text not null,
  player_id integer,
  br_slug text,
  years jsonb not null default '[]',
  guaranteed bigint,
  updated_at timestamptz not null default now(),
  unique (season, normalized_name, team_tricode)
);

create index if not exists idx_player_contracts_season on public.player_contracts (season);
create index if not exists idx_player_contracts_name on public.player_contracts (season, normalized_name);
create index if not exists idx_player_contracts_player on public.player_contracts (player_id);

alter table public.player_contracts enable row level security;

drop policy if exists "Allow public read on player_contracts" on public.player_contracts;
create policy "Allow public read on player_contracts"
  on public.player_contracts for select using (true);
