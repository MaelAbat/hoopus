/**
 * Picks de draft échangeables.
 *
 * Un échange NBA se joue au moins autant sur les picks que sur les joueurs : la
 * trade machine en a donc besoin comme actifs de plein droit.
 *
 * On dit « pick », et non « choix » : c'est le mot qu'emploient les suiveurs
 * francophones de la ligue, et traduire un terme de métier le rend plus obscur,
 * pas plus clair. Le tour, lui, se dit bien en français.
 *
 * Ce que ce module sait, et ce qu'il ne sait pas
 * ─────────────────────────────────────────────
 * Aucune source automatisable ne publie la propriété réelle des picks futurs.
 * Basketball Reference recense les drafts passées (table `draft_picks`), pas le
 * stock à venir, ses protections, ses droits de swap ni les picks déjà cédés.
 * RealGM et Spotrac tiennent ces tableaux à la main.
 *
 * Le stock de départ est donc **reconstitué** : chaque franchise possède ses
 * deux picks, premier et second tour, sur les sept drafts échangeables. C'est
 * faux pour toute équipe ayant déjà cédé un pick — et l'interface le dit. Ce
 * que ce module apporte malgré cette limite, c'est la mécanique : la règle
 * Stepien, la règle des sept ans et le gel du pick au second apron s'appliquent
 * exactement, sur un stock hypothétique plutôt que réel.
 *
 * Le jour où un tableau de propriété entre en base, seul `buildPickInventory`
 * change : le moteur d'échange lit déjà une liste d'actifs, pas une convention.
 */

import { seasonStartYear } from "./season";

/**
 * Horizon de la règle des sept ans : une équipe ne peut pas échanger un pick
 * au-delà de sept drafts à venir.
 */
export const DRAFT_HORIZON = 7;

export type DraftRound = 1 | 2;

export interface DraftPickAsset {
  /** `BOS-2029-1` — franchise d'origine, année, tour. */
  id: string;
  /** Franchise dont le pick émane : c'est elle qui en fixe le rang. */
  originalTeam: string;
  /** Détenteur actuel du pick, avant l'échange en cours. */
  owner: string;
  /** Année civile de la draft. */
  year: number;
  round: DraftRound;
}

export function pickId(originalTeam: string, year: number, round: DraftRound): string {
  return `${originalTeam}-${year}-${round}`;
}

/**
 * Première draft encore échangeable pendant une saison.
 *
 * La draft qui clôt la saison 2026-27 a lieu en juin 2027 : pendant toute la
 * saison, elle reste devant nous. La fenêtre court donc de l'année de fin de
 * saison aux sept drafts suivants — 2027 à 2033 pour 2026-27, ce qui reproduit
 * les fenêtres annoncées chaque année par la ligue.
 */
export function firstTradeableDraftYear(season: string): number {
  return seasonStartYear(season) + 1;
}

/** Dernière draft échangeable — borne de la règle des sept ans. */
export function lastTradeableDraftYear(season: string): number {
  return seasonStartYear(season) + DRAFT_HORIZON;
}

/** Les sept années de draft ouvertes à l'échange pendant une saison. */
export function tradeableDraftYears(season: string): number[] {
  const first = firstTradeableDraftYear(season);
  return Array.from({ length: DRAFT_HORIZON }, (_, i) => first + i);
}

/**
 * Année du pick gelé par le second apron.
 *
 * Une équipe qui termine une saison au-dessus du second apron perd le droit
 * d'échanger son premier tour situé sept ans plus loin. C'est le dernier de la
 * fenêtre : le pick est verrouillé à l'instant même où il devient échangeable.
 *
 * Approximation assumée : la convention regarde la masse salariale de fin de
 * saison, on regarde celle d'aujourd'hui. Sur une saison en cours, c'est le
 * meilleur indicateur disponible.
 */
export function frozenPickYear(season: string): number {
  return lastTradeableDraftYear(season);
}

/**
 * Stock de picks reconstitué : chaque franchise détient les siens.
 *
 * Voir l'en-tête du module : c'est une convention de départ, pas un relevé.
 */
export function buildPickInventory(teams: string[], season: string): DraftPickAsset[] {
  const picks: DraftPickAsset[] = [];
  for (const team of teams) {
    for (const year of tradeableDraftYears(season)) {
      for (const round of [1, 2] as DraftRound[]) {
        picks.push({ id: pickId(team, year, round), originalTeam: team, owner: team, year, round });
      }
    }
  }
  return picks;
}

/** Le tour d'un pick, dit en français — « 1er tour », « 2e tour ». */
export function roundLabel(round: number): string {
  return round === 1 ? "1er tour" : round === 2 ? "2e tour" : `tour ${round}`;
}

/** « 1er tour 2029 » — le tour d'abord, c'est ce qui porte la valeur. */
export function pickLabel(pick: Pick<DraftPickAsset, "year" | "round">): string {
  return `${roundLabel(pick.round)} ${pick.year}`;
}

/**
 * Picks de premier tour détenus par une équipe, année par année.
 *
 * Base du contrôle Stepien : ce n'est pas « son » pick qui compte mais le fait
 * d'avoir un premier tour cette année-là. Une équipe qui a cédé le sien peut
 * régulariser en acquérant celui d'une autre.
 */
export function firstRoundersByYear(
  picks: DraftPickAsset[],
  team: string
): Map<number, DraftPickAsset[]> {
  const byYear = new Map<number, DraftPickAsset[]>();
  for (const p of picks) {
    if (p.round !== 1 || p.owner !== team) continue;
    const list = byYear.get(p.year);
    if (list) list.push(p);
    else byYear.set(p.year, [p]);
  }
  return byYear;
}
