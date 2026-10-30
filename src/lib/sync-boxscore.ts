import https from "node:https";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { espnEventId } from "./espn-teams";
import { fetchEspnBoxscore } from "./espn-boxscore";
import { changedRows } from "./write-changed";

interface NbaBoxscoreResponse {
  game: {
    gameId: string;
    gameStatus: number;
    gameStatusText: string;
    homeTeam: NbaTeam;
    awayTeam: NbaTeam;
  };
}

interface NbaTeam {
  teamTricode: string;
  teamName: string;
  teamCity: string;
  score: number;
  players: NbaPlayer[];
}

interface NbaPlayer {
  personId: number;
  name: string;
  nameI: string;
  jerseyNum: string;
  position: string;
  starter: string;
  oncourt: string;
  played: string;
  statistics: {
    minutes: string;
    points: number;
    reboundsTotal: number;
    reboundsOffensive: number;
    reboundsDefensive: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    foulsPersonal: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersMade: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    plusMinusPoints: number;
  };
}

function fetchBoxscore(gameId: string): Promise<NbaBoxscoreResponse> {
  const url = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.nba.com/",
        "Accept": "application/json",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA CDN error: ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
        } catch {
          reject(new Error("Failed to parse boxscore response"));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("NBA CDN timeout"));
    });
  });
}

function parseMinutes(iso: string): string {
  const match = iso.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return "0:00";
  const m = match[1];
  const s = Math.floor(parseFloat(match[2]));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildRows(gameId: string, team: NbaTeam, isHome: boolean, now: string) {
  return team.players
    .filter((p) => p.played === "1")
    .map((p) => ({
      game_id: gameId,
      player_id: p.personId,
      player_name: p.name,
      team: team.teamTricode,
      is_home: isHome,
      starter: p.starter === "1",
      position: p.position || null,
      jersey: p.jerseyNum || null,
      minutes: parseMinutes(p.statistics.minutes),
      pts: p.statistics.points,
      reb: p.statistics.reboundsTotal,
      oreb: p.statistics.reboundsOffensive,
      dreb: p.statistics.reboundsDefensive,
      ast: p.statistics.assists,
      stl: p.statistics.steals,
      blk: p.statistics.blocks,
      tov: p.statistics.turnovers,
      pf: p.statistics.foulsPersonal,
      fgm: p.statistics.fieldGoalsMade,
      fga: p.statistics.fieldGoalsAttempted,
      fg3m: p.statistics.threePointersMade,
      fg3a: p.statistics.threePointersAttempted,
      ftm: p.statistics.freeThrowsMade,
      fta: p.statistics.freeThrowsAttempted,
      plus_minus: p.statistics.plusMinusPoints,
      updated_at: now,
    }));
}

/**
 * Sync a single game's boxscore into the database.
 * Returns true if data was synced (or already existed), false on error.
 */
export async function syncBoxscore(gameId: string): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Matchs lus chez ESPN depuis 2026-27 : même table, autre source.
  const eventId = espnEventId(gameId);
  if (eventId) return syncEspnBoxscore(supabase, gameId, eventId);

  // Validate gameId format (10-digit NBA game ID)
  if (!/^\d{10}$/.test(gameId)) return false;

  try {
    // Throttle: if the games row was refreshed very recently (either by a prior
    // syncBoxscore call or by the /api/live-scores poll), skip the CDN fetch —
    // prevents duplicate CDN hits when the match page and ticker poll concurrently.
    const { data: current } = await supabase
      .from("games")
      .select("updated_at")
      .eq("game_id", gameId)
      .single();

    if (current?.updated_at) {
      const ageMs = Date.now() - new Date(current.updated_at).getTime();
      if (ageMs < 15_000) return true;
    }

    const data = await fetchBoxscore(gameId);
    const game = data.game;
    const now = new Date().toISOString();

    const rows = [
      ...buildRows(gameId, game.homeTeam, true, now),
      ...buildRows(gameId, game.awayTeam, false, now),
    ];

    if (rows.length === 0) return false;

    // Delete existing rows first to prevent duplicates
    await supabase.from("boxscores").delete().eq("game_id", gameId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("boxscores").insert(rows as any);
    if (error) {
      console.error("Boxscore insert error:", error);
      return false;
    }

    // Also refresh live score + status on the game itself, so the header stays
    // in sync with the live boxscore (cron only syncs scheduleLeagueV2 once a day).
    await supabase
      .from("games")
      .update({
        home_score: game.homeTeam.score,
        away_score: game.awayTeam.score,
        status: game.gameStatus,
        status_text: game.gameStatusText,
        updated_at: now,
      })
      .eq("game_id", gameId);

    return true;
  } catch {
    // Silently fail — page will show "no data" fallback
    return false;
  }
}

/** Heure de la dernière lecture ESPN, par match (voir syncEspnBoxscore). */
const espnLastChecked = new Map<string, number>();

/** Colonnes d'une ligne de box score comparées pour savoir s'il faut réécrire. */
const BOX_COMPARE = [
  "player_name", "team", "is_home", "starter", "position", "jersey", "minutes", "pts", "reb", "oreb", "dreb",
  "ast", "stl", "blk", "tov", "pf", "fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "plus_minus",
] as const;

/**
 * Box score d'un match ESPN.
 *
 * Rien à relire pour un match terminé dont le box score est en base : ses
 * chiffres ne bougeront plus. Pendant un match, ESPN n'est pas interrogé plus
 * d'une fois toutes les 15 secondes par instance, et rien n'est écrit si rien
 * n'a bougé — la page d'un match en direct se régénère chaque minute.
 */
async function syncEspnBoxscore(supabase: SupabaseClient, gameId: string, eventId: string): Promise<boolean> {
  try {
    const [{ data: current }, { data: stored }] = await Promise.all([
      supabase
        .from("games")
        .select("status, status_text, home_score, away_score, updated_at")
        .eq("game_id", gameId)
        .single(),
      supabase.from("boxscores").select(["player_id", ...BOX_COMPARE].join(", ")).eq("game_id", gameId),
    ]);
    const existing = (stored ?? []) as unknown as Record<string, unknown>[];

    if (current?.status === 3 && existing.length > 0) return true;
    const lastSeen = Math.max(
      current?.updated_at ? new Date(current.updated_at).getTime() : 0,
      espnLastChecked.get(gameId) ?? 0
    );
    if (Date.now() - lastSeen < 15_000 && existing.length > 0) return true;
    espnLastChecked.set(gameId, Date.now());

    const { rows, game } = await fetchEspnBoxscore(supabase, gameId, eventId);

    if (
      game &&
      (game.status !== current?.status ||
        game.status_text !== current?.status_text ||
        game.home_score !== current?.home_score ||
        game.away_score !== current?.away_score)
    ) {
      await supabase
        .from("games")
        .update({
          home_score: game.home_score,
          away_score: game.away_score,
          status: game.status,
          status_text: game.status_text,
          updated_at: game.updated_at,
        })
        .eq("game_id", gameId);
    }

    if (rows.length === 0) return existing.length > 0;

    // Même ensemble de joueurs, mêmes chiffres : rien à réécrire.
    const byPlayer = new Map(existing.map((r) => [String(r.player_id), r]));
    const unchanged =
      existing.length === rows.length && changedRows(rows, byPlayer, ["player_id"], BOX_COMPARE).length === 0;
    if (unchanged) return true;

    await supabase.from("boxscores").delete().eq("game_id", gameId);
    const { error } = await supabase.from("boxscores").insert(rows);
    if (error) {
      console.error("Boxscore insert error:", error);
      return false;
    }
    return true;
  } catch {
    // ESPN muet : la page affiche le repli « aucune donnée ».
    return false;
  }
}
