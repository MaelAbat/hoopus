/**
 * Effectifs des trente équipes, lus chez ESPN.
 *
 * Remplace l'index des joueurs de stats.nba.com (`playerindex`), qui ne nous
 * répond plus. Les joueurs sont rapprochés de leur fiche NBA par le nom ; un
 * joueur inconnu de la base — recrue, signature récente — prend l'opposé de
 * son identifiant ESPN, la convention déjà suivie par les box scores (voir
 * lib/espn-boxscore).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEspnJson } from "./espn-fetch";
import { nbaTricode } from "./espn-teams";
import { loadPlayerNameIndex } from "./market-sync";
import { normalizeName } from "./br-salaries";

const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

interface EspnAthlete {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jersey?: string;
  position?: { abbreviation?: string };
  height?: number;
  weight?: number;
  age?: number;
  college?: { name?: string };
  birthPlace?: { country?: string };
}

interface EspnRoster {
  team: { abbreviation: string; location: string; name: string };
  athletes: EspnAthlete[];
}

export interface RosterPlayer {
  /** Identifiant NBA, ou opposé de l'identifiant ESPN pour un joueur sans fiche. */
  playerId: number;
  /** Vrai si le joueur n'était pas encore en base. */
  isNew: boolean;
  firstName: string;
  lastName: string;
  teamTricode: string;
  teamName: string;
  teamCity: string;
  jersey: string | null;
  position: string | null;
  /** Au format de la NBA : « 6-8 », « 230 ». */
  height: string | null;
  weight: string | null;
  age: number | null;
  college: string | null;
  country: string | null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 80 pouces → « 6-8 ». */
function heightLabel(inches: number | undefined): string | null {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}-${inches % 12}`;
}

/**
 * Tous les joueurs sous contrat, équipe par équipe. `complete` est faux si un
 * effectif n'a pas pu être lu : l'appelant ne doit alors pas en déduire qu'un
 * joueur absent a quitté la ligue.
 */
export async function fetchEspnRosters(
  supabase: SupabaseClient
): Promise<{ players: RosterPlayer[]; complete: boolean }> {
  const teams = await fetchEspnJson<{
    sports: { leagues: { teams: { team: { id: string } }[] }[] }[];
  }>(`${API}/teams`, { label: "équipes" });
  const teamIds = teams.sports[0].leagues[0].teams.map((t) => t.team.id);

  const index = await loadPlayerNameIndex(supabase);
  const players: RosterPlayer[] = [];
  let read = 0;

  for (const id of teamIds) {
    let roster: EspnRoster;
    try {
      roster = await fetchEspnJson<EspnRoster>(`${API}/teams/${id}/roster`, { label: `effectif ${id}` });
    } catch {
      continue;
    }
    read++;
    const tricode = nbaTricode(roster.team.abbreviation);

    for (const a of roster.athletes) {
      const known = index.get(normalizeName(a.displayName));
      players.push({
        playerId: known ?? -Number(a.id),
        isNew: known === undefined,
        firstName: a.firstName,
        lastName: a.lastName,
        teamTricode: tricode,
        teamName: roster.team.name,
        teamCity: roster.team.location,
        jersey: a.jersey ?? null,
        position: a.position?.abbreviation ?? null,
        height: heightLabel(a.height),
        weight: a.weight ? String(a.weight) : null,
        age: a.age ?? null,
        college: a.college?.name ?? null,
        country: a.birthPlace?.country ?? null,
      });
    }
    await delay(200);
  }

  return { players, complete: read === teamIds.length };
}
