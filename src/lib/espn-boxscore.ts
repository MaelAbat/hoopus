/**
 * Box score d'un match ESPN, au format de la table `boxscores`.
 *
 * ESPN identifie les joueurs par ses propres numéros ; le site, par ceux de la
 * NBA (fiches, photos, statistiques). Le rapprochement se fait par le nom, avec
 * l'index déjà utilisé pour Basketball Reference. Un joueur introuvable — une
 * recrue arrivée depuis que la NBA nous bloque, typiquement — prend l'opposé de
 * son identifiant ESPN, reçoit une fiche minimale, et sa photo vient d'ESPN.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEspnJson } from "./espn-fetch";
import { nbaTricode } from "./espn-teams";
import { toGameRow, type EspnEvent } from "./espn-schedule";
import { loadPlayerNameIndex } from "./market-sync";
import { normalizeName } from "./br-salaries";

const API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";

interface EspnAthleteLine {
  athlete: {
    id: string;
    displayName: string;
    jersey?: string;
    position?: { abbreviation?: string };
  };
  starter: boolean;
  didNotPlay?: boolean;
  stats: string[];
}

interface EspnSummary {
  header: { competitions: EspnEvent["competitions"]; season?: { year: number; type: number } } & {
    id: string;
  };
  boxscore: {
    players?: {
      team: { abbreviation: string };
      statistics: { keys: string[]; athletes: EspnAthleteLine[] }[];
    }[];
  };
}

/** Ligne de la table `boxscores`. */
export interface BoxscoreRow {
  game_id: string;
  player_id: number;
  player_name: string;
  team: string;
  is_home: boolean;
  starter: boolean;
  position: string | null;
  jersey: string | null;
  minutes: string;
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  plus_minus: number;
  updated_at: string;
}

/**
 * Index nom → identifiant NBA, gardé une heure : le construire lit toute la
 * table des joueurs (six requêtes), et une page de match en direct se
 * régénère chaque minute.
 */
let cachedIndex: { at: number; index: Map<string, number> } | null = null;
const INDEX_TTL_MS = 60 * 60 * 1000;

async function playerNameIndex(supabase: SupabaseClient): Promise<Map<string, number>> {
  if (cachedIndex && Date.now() - cachedIndex.at < INDEX_TTL_MS) return cachedIndex.index;
  const index = await loadPlayerNameIndex(supabase);
  cachedIndex = { at: Date.now(), index };
  return index;
}

const int = (v: string | undefined) => {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : 0;
};

/** « 4-7 » → [4, 7]. */
const madeAttempted = (v: string | undefined): [number, number] => {
  const [m, a] = (v ?? "").split("-");
  return [int(m), int(a)];
};

/**
 * Lit le box score d'un match ESPN. Renvoie aussi la ligne `games` à jour —
 * score et statut —, tirée du même document.
 */
export async function fetchEspnBoxscore(
  supabase: SupabaseClient,
  gameId: string,
  eventId: string
): Promise<{ rows: BoxscoreRow[]; game: ReturnType<typeof toGameRow> }> {
  const summary = await fetchEspnJson<EspnSummary>(`${API}/summary?event=${eventId}`, {
    label: `box score ${eventId}`,
  });
  const now = new Date().toISOString();

  const competition = summary.header.competitions[0];
  const homeAbbr = competition?.competitors.find((c) => c.homeAway === "home")?.team.abbreviation;
  const game = toGameRow(
    { id: eventId, date: competition?.date ?? now, season: summary.header.season, competitions: summary.header.competitions },
    now
  );

  const teams = summary.boxscore.players ?? [];
  if (teams.length === 0) return { rows: [], game };

  const nameIndex = await playerNameIndex(supabase);
  const rows: BoxscoreRow[] = [];

  for (const team of teams) {
    const group = team.statistics[0];
    if (!group) continue;
    const at = (key: string) => group.keys.indexOf(key);
    const iMin = at("minutes");
    const iPts = at("points");
    const iFg = at("fieldGoalsMade-fieldGoalsAttempted");
    const iFg3 = at("threePointFieldGoalsMade-threePointFieldGoalsAttempted");
    const iFt = at("freeThrowsMade-freeThrowsAttempted");
    const iReb = at("rebounds");
    const iOreb = at("offensiveRebounds");
    const iDreb = at("defensiveRebounds");
    const iAst = at("assists");
    const iStl = at("steals");
    const iBlk = at("blocks");
    const iTov = at("turnovers");
    const iPf = at("fouls");
    const iPm = at("plusMinus");

    for (const line of group.athletes) {
      // Comme la NBA : seuls les joueurs entrés en jeu ont une ligne.
      if (line.didNotPlay || line.stats.length === 0) continue;
      const s = line.stats;
      const [fgm, fga] = madeAttempted(s[iFg]);
      const [fg3m, fg3a] = madeAttempted(s[iFg3]);
      const [ftm, fta] = madeAttempted(s[iFt]);
      const espnId = Number(line.athlete.id);

      rows.push({
        game_id: gameId,
        player_id: nameIndex.get(normalizeName(line.athlete.displayName)) ?? -espnId,
        player_name: line.athlete.displayName,
        team: nbaTricode(team.team.abbreviation),
        is_home: team.team.abbreviation === homeAbbr,
        starter: line.starter,
        position: line.athlete.position?.abbreviation || null,
        jersey: line.athlete.jersey || null,
        // ESPN arrondit à la minute ; la colonne garde le format « mm:ss ».
        minutes: `${int(s[iMin])}:00`,
        pts: int(s[iPts]),
        reb: int(s[iReb]),
        oreb: int(s[iOreb]),
        dreb: int(s[iDreb]),
        ast: int(s[iAst]),
        stl: int(s[iStl]),
        blk: int(s[iBlk]),
        tov: int(s[iTov]),
        pf: int(s[iPf]),
        fgm,
        fga,
        fg3m,
        fg3a,
        ftm,
        fta,
        plus_minus: int(s[iPm]),
        updated_at: now,
      });
    }
  }

  // Un joueur sans fiche en reçoit une minimale, que sync-players complétera :
  // le lien de sa ligne mène ainsi toujours quelque part.
  const unknown = rows.filter((r) => r.player_id < 0);
  if (unknown.length > 0) {
    await supabase.from("players").upsert(
      unknown.map((r) => {
        const [first, ...rest] = r.player_name.split(" ");
        return {
          player_id: r.player_id,
          first_name: first,
          last_name: rest.join(" "),
          team_tricode: r.team,
          jersey_number: r.jersey,
          position: r.position,
          is_active: true,
          updated_at: now,
        };
      }),
      { onConflict: "player_id", ignoreDuplicates: true }
    );
  }

  return { rows, game };
}
