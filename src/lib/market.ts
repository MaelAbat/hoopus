/**
 * Modèle et vocabulaire du marché NBA.
 *
 * Ce module ne lit rien et ne récupère rien : il définit la forme d'un mouvement
 * et sait le dire en français. Les phrases ne sont donc jamais stockées en base —
 * reformuler ne demande aucune resynchronisation, et les noms restent des liens
 * plutôt que du texte figé (voir la migration 043).
 *
 * Il est volontairement isomorphe : aucune dépendance à Node, pour pouvoir servir
 * aussi bien au rendu serveur qu'aux filtres côté client.
 */

import type { PhaseKey } from "./season-phases";

export type EventKind =
  | "trade"
  | "signature"
  | "waiver"
  | "claim"
  | "conversion"
  | "option"
  | "assignment"
  | "recall"
  | "retirement"
  | "suspension"
  | "coaching"
  | "other";

export interface EventPlayer {
  name: string;
  br_slug: string | null;
  /** Identifiant NBA, nul quand le rapprochement de noms n'aboutit pas. */
  player_id: number | null;
  /** Équipe quittée, nulle pour une arrivée depuis l'extérieur de la ligue. */
  from: string | null;
  /** Équipe rejointe, nulle pour un joueur coupé. */
  to: string | null;
  /**
   * Un mouvement de banc concerne un entraîneur ou un dirigeant, qui n'a pas
   * de fiche joueur : le rôle évite de le présenter comme un joueur.
   */
  role?: "player" | "coach";
}

export interface EventAsset {
  type: "pick" | "cash" | "exception" | "swap" | "rights";
  year: number | null;
  round: number | null;
  from: string | null;
  to: string | null;
  /** Précision d'origine de BR (« 2032 2nd-rd pick is GSW own »). */
  detail: string | null;
}

export interface EventContract {
  type: "two_way" | "multi_year" | "ten_day" | "rest_of_season" | "exhibit_10" | "standard";
  detail: string | null;
}

/** Un mouvement, tel que stocké dans `league_events` et lu par les pages. */
export interface MarketEvent {
  id?: number;
  event_key: string;
  season: string;
  event_date: string;
  phase: PhaseKey | null;
  kind: EventKind;
  teams: string[];
  from_team: string | null;
  to_team: string | null;
  players: EventPlayer[];
  assets: EventAsset[];
  contract: EventContract | null;
  /** Précision libre : durée d'une suspension, poste d'un entraîneur. */
  detail: string | null;
  raw: string;
}

/* ─── Vocabulaire ─── */

export const KIND_LABELS: Record<EventKind, string> = {
  trade: "Échange",
  signature: "Signature",
  waiver: "Coupe",
  claim: "Ballottage",
  conversion: "Conversion",
  option: "Option",
  assignment: "G League",
  recall: "Rappel",
  retirement: "Retraite",
  suspension: "Suspension",
  coaching: "Encadrement",
  other: "Autre",
};

/**
 * Ordre d'importance, qui pilote l'affichage par défaut.
 *
 * Les allers-retours en G League sont conservés — ils font partie de la vie d'un
 * effectif — mais rangés en fin de liste et masqués par défaut : une saison en
 * compte plusieurs centaines, qui noieraient les échanges et les signatures.
 */
export const KIND_ORDER: EventKind[] = [
  "trade",
  "signature",
  "waiver",
  "claim",
  "conversion",
  "option",
  "coaching",
  "suspension",
  "retirement",
  "other",
  "assignment",
  "recall",
];

/** Types masqués par défaut dans le flux, activables par filtre. */
export const MINOR_KINDS: EventKind[] = ["assignment", "recall"];

export const CONTRACT_LABELS: Record<EventContract["type"], string> = {
  two_way: "two-way",
  multi_year: "pluriannuel",
  ten_day: "10 jours",
  rest_of_season: "fin de saison",
  exhibit_10: "Exhibit 10",
  standard: "standard",
};

/* ─── Mise en français ─── */

/** « 2e tour 2032 », « compensation financière », « trade exception ». */
export function assetLabel(asset: EventAsset): string {
  switch (asset.type) {
    case "pick": {
      const round = asset.round === 1 ? "1er tour" : asset.round === 2 ? "2e tour" : "choix de draft";
      return asset.year ? `${round} ${asset.year}` : round;
    }
    case "swap":
      return asset.year ? `échange de choix ${asset.year}` : "échange de choix";
    case "cash":
      return "compensation financière";
    case "exception":
      return "trade exception";
    case "rights":
      return asset.detail || "droits de draft";
  }
}

function playerNames(players: EventPlayer[]): string {
  const names = players.map((p) => p.name);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function join(parts: string[]): string {
  const kept = parts.filter(Boolean);
  if (kept.length <= 1) return kept[0] || "";
  return `${kept.slice(0, -1).join(", ")} et ${kept[kept.length - 1]}`;
}

/**
 * Le mouvement dit en français, sans le nom de l'équipe sujet — les tableaux
 * l'affichent déjà dans leur colonne d'équipe. La phrase commence donc par le
 * verbe, comme une dépêche.
 */
export function eventAction(event: MarketEvent): string {
  const contract = event.contract ? ` (${CONTRACT_LABELS[event.contract.type]})` : "";

  switch (event.kind) {
    case "trade": {
      const subject = event.from_team;
      const sent = event.players.filter((p) => p.from === subject);
      const received = event.players.filter((p) => p.to === subject);
      const sentAssets = event.assets.filter((a) => a.from === subject).map(assetLabel);
      const receivedAssets = event.assets.filter((a) => a.to === subject).map(assetLabel);

      // Une seule énumération par sens : joueurs puis actifs, sinon deux « et »
      // se suivent (« Jessup et Mashack et 2e tour 2032 »).
      const outgoing = join([...sent.map((p) => p.name), ...sentAssets]);
      const incoming = join([...received.map((p) => p.name), ...receivedAssets]);
      const counterparts = event.teams.filter((t) => t !== subject);
      const other = counterparts.join(", ");

      if (outgoing && incoming) {
        return other
          ? `envoie ${outgoing} à ${other} contre ${incoming}`
          : `envoie ${outgoing} contre ${incoming}`;
      }
      if (outgoing) return other ? `envoie ${outgoing} à ${other}` : `envoie ${outgoing}`;
      if (incoming) return other ? `reçoit ${incoming} de ${other}` : `reçoit ${incoming}`;
      return other ? `participe à un échange avec ${other}` : "participe à un échange";
    }
    case "signature":
      return `signe ${playerNames(event.players)}${contract}`;
    case "waiver":
      return `coupe ${playerNames(event.players)}`;
    case "claim":
      return `récupère ${playerNames(event.players)} au ballottage${
        event.from_team ? ` (depuis ${event.from_team})` : ""
      }`;
    case "conversion":
      return `convertit le contrat de ${playerNames(event.players)}${contract}`;
    case "option":
      return `active une option sur ${playerNames(event.players)}`;
    case "assignment":
      return `envoie ${playerNames(event.players)} en G League`;
    case "recall":
      return `rappelle ${playerNames(event.players)} de G League`;
    case "retirement":
      return `${playerNames(event.players)} met un terme à sa carrière`;
    case "suspension":
      return `${playerNames(event.players)} suspendu par la ligue${
        event.detail ? ` (${event.detail})` : ""
      }`;
    case "coaching": {
      // `detail` porte déjà la phrase — « limoge son entraîneur principal » —
      // construite au moment de la lecture, avec le poste concerné.
      const who = playerNames(event.players);
      const action = event.detail || "modifie son encadrement";
      return who ? `${action} ${who}` : action;
    }
    case "other":
      return event.raw;
  }
}

/** Phrase complète, équipe comprise — fiche joueur, référencement, partage. */
export function eventSentence(event: MarketEvent, teamLabel: (t: string) => string): string {
  const subject = event.from_team || event.to_team || event.teams[0];
  if (event.kind === "retirement" || !subject) return eventAction(event);
  return `${teamLabel(subject)} — ${eventAction(event)}`;
}

/** « 2 juillet 2025 ». */
export function formatEventDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** « 2 juil. » — pour les colonnes serrées. */
export function formatEventDateShort(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/* ─── Récapitulatifs ─── */

export interface TeamBalance {
  team: string;
  arrivals: number;
  departures: number;
  trades: number;
  signatures: number;
  waivers: number;
  /** Choix de draft reçus moins choix cédés. */
  pickBalance: number;
  total: number;
}

/**
 * Bilan par équipe : qui a bougé, dans quel sens, et avec quel solde de choix.
 *
 * Les allers-retours en G League sont exclus : une équipe qui navette son
 * deux-way vingt fois n'est pas la plus active du marché.
 */
export function teamBalances(events: MarketEvent[]): TeamBalance[] {
  const map = new Map<string, TeamBalance>();
  const of = (team: string): TeamBalance => {
    let row = map.get(team);
    if (!row) {
      row = {
        team,
        arrivals: 0,
        departures: 0,
        trades: 0,
        signatures: 0,
        waivers: 0,
        pickBalance: 0,
        total: 0,
      };
      map.set(team, row);
    }
    return row;
  };

  for (const event of events) {
    if (MINOR_KINDS.includes(event.kind)) continue;

    for (const team of event.teams) {
      const row = of(team);
      row.total++;
      if (event.kind === "trade") row.trades++;
      else if (event.kind === "signature") row.signatures++;
      else if (event.kind === "waiver") row.waivers++;
    }

    for (const player of event.players) {
      if (player.to) of(player.to).arrivals++;
      if (player.from) of(player.from).departures++;
    }

    for (const asset of event.assets) {
      if (asset.type !== "pick") continue;
      if (asset.to) of(asset.to).pickBalance++;
      if (asset.from) of(asset.from).pickBalance--;
    }
  }

  return [...map.values()].sort((a, b) => b.total - a.total || a.team.localeCompare(b.team));
}

/** Volume par type de mouvement, dans l'ordre d'importance. */
export function countByKind(events: MarketEvent[]): { kind: EventKind; count: number }[] {
  const counts = new Map<EventKind, number>();
  for (const event of events) counts.set(event.kind, (counts.get(event.kind) || 0) + 1);
  return KIND_ORDER.filter((k) => counts.has(k)).map((kind) => ({
    kind,
    count: counts.get(kind)!,
  }));
}

/** Volume par période de la saison. */
export function countByPhase(events: MarketEvent[]): { phase: PhaseKey | null; count: number }[] {
  const counts = new Map<PhaseKey | null, number>();
  for (const event of events) {
    if (MINOR_KINDS.includes(event.kind)) continue;
    counts.set(event.phase, (counts.get(event.phase) || 0) + 1);
  }
  return [...counts.entries()].map(([phase, count]) => ({ phase, count }));
}

/** Journées les plus chargées — la deadline et le 1er juillet ressortent seuls. */
export function busiestDays(
  events: MarketEvent[],
  limit = 5
): { date: string; count: number; phase: PhaseKey | null }[] {
  const counts = new Map<string, { count: number; phase: PhaseKey | null }>();
  for (const event of events) {
    if (MINOR_KINDS.includes(event.kind)) continue;
    const row = counts.get(event.event_date) || { count: 0, phase: event.phase };
    row.count++;
    counts.set(event.event_date, row);
  }
  return [...counts.entries()]
    .map(([date, row]) => ({ date, ...row }))
    .sort((a, b) => b.count - a.count || b.date.localeCompare(a.date))
    .slice(0, limit);
}

/** Joueurs les plus déplacés sur la période retenue. */
export function mostMovedPlayers(
  events: MarketEvent[],
  limit = 10
): { name: string; player_id: number | null; moves: number; teams: string[] }[] {
  const map = new Map<string, { name: string; player_id: number | null; moves: number; teams: Set<string> }>();

  for (const event of events) {
    if (MINOR_KINDS.includes(event.kind)) continue;
    for (const player of event.players) {
      const key = player.player_id ? `id:${player.player_id}` : `name:${player.name}`;
      const row = map.get(key) || {
        name: player.name,
        player_id: player.player_id,
        moves: 0,
        teams: new Set<string>(),
      };
      row.moves++;
      if (player.from) row.teams.add(player.from);
      if (player.to) row.teams.add(player.to);
      map.set(key, row);
    }
  }

  return [...map.values()]
    .map((r) => ({ name: r.name, player_id: r.player_id, moves: r.moves, teams: [...r.teams] }))
    .sort((a, b) => b.moves - a.moves || a.name.localeCompare(b.name))
    .slice(0, limit);
}
