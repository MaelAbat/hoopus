/**
 * Matchs du bandeau des scores : résultats de la nuit et matchs à venir.
 *
 * Le bandeau était rendu côté serveur dans le gabarit racine, donc figé dans le
 * HTML de chaque page avec son cache ISR : une fiche joueur gardée vingt-quatre
 * heures montrait toute la soirée les matchs « à venir » du matin. Il est
 * désormais lu par /api/ticker, que le CDN met en cache pour tous les visiteurs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStatsSeason } from "./league-season";
import { decidedSeriesKeysFromSeries, filterScheduledByDecidedSeries, isPlayoffGame } from "./playoff-utils";
import { easternNow, shiftDate } from "./live-refresh";

export interface TickerGame {
  game_id: string;
  game_type: string | null;
  playoff_round: number | null;
  game_date: string;
  status: number;
  status_text: string;
  home_team: string;
  home_team_name: string;
  home_score: number;
  away_team: string;
  away_team_name: string;
  away_score: number;
  game_time: string | null;
}

export interface TickerData {
  /** Matchs en cours ou terminés d'hier et d'aujourd'hui. */
  results: TickerGame[];
  /** Matchs programmés de la prochaine journée qui en compte. */
  upcoming: TickerGame[];
}

const SELECT =
  "game_id, game_type, playoff_round, game_date, status, status_text, home_team, home_team_name, home_score, away_team, away_team_name, away_score, game_time";

export async function loadTicker(supabase: SupabaseClient): Promise<TickerData> {
  // Matchs à venir d'une série de playoffs déjà jouée (4-0, 4-1, 4-2) : ils ne
  // se joueront jamais. Les séries ne sont lues que si la liste en contient.
  let decidedKeys: Set<string> | null = null;
  async function dropSettledPlayoffGames(list: TickerGame[]): Promise<TickerGame[]> {
    if (list.length === 0 || !list.some(isPlayoffGame)) return list;
    if (!decidedKeys) {
      const { data } = await supabase
        .from("playoff_series")
        .select("round, team_top, team_bottom, wins_top, wins_bottom, status")
        .eq("season", await getStatsSeason())
        .eq("status", "completed");
      decidedKeys = decidedSeriesKeysFromSeries(data || []);
    }
    return filterScheduledByDecidedSeries(list, decidedKeys);
  }

  // Les matchs sont rangés à la date de New York.
  const today = easternNow().date;
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);

  const [{ data: resultsRaw }, { data: upcomingRaw }] = await Promise.all([
    supabase
      .from("games")
      .select(SELECT)
      .in("game_date", [yesterday, today])
      .in("status", [2, 3])
      .order("game_date", { ascending: false })
      .order("status", { ascending: false }),
    supabase
      .from("games")
      .select(SELECT)
      .in("game_date", [today, tomorrow])
      .eq("status", 1)
      .order("game_date", { ascending: true })
      .order("game_time", { ascending: true })
      .limit(50),
  ]);

  const results = (resultsRaw ?? []) as TickerGame[];
  const firstDay = (list: TickerGame[]) => list.filter((g) => g.game_date === list[0]?.game_date);

  let upcoming = firstDay(await dropSettledPlayoffGames((upcomingRaw ?? []) as TickerGame[]));

  // Ni résultat ni match aujourd'hui ou demain : la prochaine journée de matchs.
  if (results.length === 0 && upcoming.length === 0) {
    const { data: futureRaw } = await supabase
      .from("games")
      .select(SELECT)
      .gt("game_date", tomorrow)
      .eq("status", 1)
      .order("game_date", { ascending: true })
      .order("game_time", { ascending: true })
      .limit(50);
    upcoming = firstDay(await dropSettledPlayoffGames((futureRaw ?? []) as TickerGame[]));
  }

  return { results, upcoming };
}
