/**
 * Séries de playoffs et matchs de play-in, reconstruits à partir des matchs.
 *
 * Le calendrier de la NBA donnait directement, pour chaque match de playoffs,
 * les têtes de série et le numéro du match dans la série. ESPN ne les donne pas
 * dans ses calendriers : ils se déduisent ici des matchs en base (lus chez ESPN
 * par sync-games) et du classement final de la saison régulière.
 *
 *   Têtes de série   rang de conférence ; pour les places 7 et 8, issues du
 *                    play-in : vainqueur de 7-8 septième, vainqueur du dernier
 *                    match huitième.
 *   Numéro de match  ordre chronologique des matchs de la série.
 *
 * Module pur — ni réseau ni base — pour pouvoir le vérifier sur une saison
 * passée dont on connaît les séries.
 */

export interface PlayoffGameInput {
  game_id: string;
  game_type: string | null;
  playoff_round: number | null;
  game_date: string;
  game_time: string | null;
  status: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
}

export interface TeamSeed {
  conference: string;
  seed: number;
}

export interface PlayinRow {
  conference: string;
  matchup_type: "seven_eight" | "nine_ten" | "final";
  home_team: string;
  away_team: string;
  home_seed: number;
  away_seed: number;
  home_score: number;
  away_score: number;
  status: number;
  game_date: string;
  winner: string | null;
}

export interface SeriesRow {
  round: number;
  conference: string | null;
  seed_top: number;
  seed_bottom: number;
  team_top: string;
  team_bottom: string;
  wins_top: number;
  wins_bottom: number;
  status: "upcoming" | "active" | "completed";
  games: {
    game_number: number;
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    status: number;
    game_date: string;
  }[];
}

function playInMatchupType(seedA: number, seedB: number): PlayinRow["matchup_type"] | null {
  const [low, high] = [seedA, seedB].sort((a, b) => a - b);
  if (low === 7 && high === 8) return "seven_eight";
  if (low === 9 && high === 10) return "nine_ten";
  // Dernier match : perdant de 7-8 contre vainqueur de 9-10.
  if (low >= 7 && low <= 8 && high >= 9 && high <= 10) return "final";
  return null;
}

const chronological = (a: PlayoffGameInput, b: PlayoffGameInput) =>
  a.game_date.localeCompare(b.game_date) || (a.game_time ?? "").localeCompare(b.game_time ?? "");

function winnerOf(g: PlayoffGameInput): string | null {
  if (g.status !== 3) return null;
  return g.home_score > g.away_score ? g.home_team : g.away_score > g.home_score ? g.away_team : null;
}

export function buildPlayIn(games: PlayoffGameInput[], seeds: Map<string, TeamSeed>): PlayinRow[] {
  const rows: PlayinRow[] = [];
  for (const g of games.filter((x) => x.game_type === "playin").sort(chronological)) {
    const home = seeds.get(g.home_team);
    const away = seeds.get(g.away_team);
    if (!home || !away || home.conference !== away.conference) continue;
    const matchup = playInMatchupType(home.seed, away.seed);
    if (!matchup) continue;
    rows.push({
      conference: home.conference,
      matchup_type: matchup,
      home_team: g.home_team,
      away_team: g.away_team,
      home_seed: home.seed,
      away_seed: away.seed,
      home_score: g.home_score,
      away_score: g.away_score,
      status: g.status,
      game_date: g.game_date,
      winner: winnerOf(g),
    });
  }
  return rows;
}

/** Têtes de série des playoffs : le classement, corrigé par le play-in pour les places 7 et 8. */
export function playoffSeeds(seeds: Map<string, TeamSeed>, playIn: PlayinRow[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const [team, s] of seeds) if (s.seed <= 6) result.set(team, s.seed);
  for (const p of playIn) {
    if (!p.winner) continue;
    if (p.matchup_type === "seven_eight") result.set(p.winner, 7);
    if (p.matchup_type === "final") result.set(p.winner, 8);
  }
  return result;
}

export function buildSeries(
  games: PlayoffGameInput[],
  seeds: Map<string, TeamSeed>,
  playoffSeed: Map<string, number>
): SeriesRow[] {
  const bySeries = new Map<string, PlayoffGameInput[]>();
  for (const g of games.filter((x) => x.game_type === "playoffs" && x.playoff_round)) {
    if (!g.home_team || !g.away_team || g.home_team === "TBD" || g.away_team === "TBD") continue;
    const key = `${g.playoff_round}-${[g.home_team, g.away_team].sort().join("-")}`;
    const list = bySeries.get(key);
    if (list) list.push(g);
    else bySeries.set(key, [g]);
  }

  const rows: SeriesRow[] = [];
  for (const list of bySeries.values()) {
    list.sort(chronological);
    const first = list[0];
    const round = first.playoff_round!;
    const seedOf = (t: string) => playoffSeed.get(t) ?? seeds.get(t)?.seed ?? 99;
    const homeSeed = seedOf(first.home_team);
    const awaySeed = seedOf(first.away_team);
    // Le mieux classé reçoit le premier match ; à égalité (Finales entre deux
    // premiers), c'est lui qui a l'avantage du terrain.
    const homeIsTop = homeSeed <= awaySeed;
    const top = homeIsTop ? first.home_team : first.away_team;
    const bottom = homeIsTop ? first.away_team : first.home_team;

    let winsTop = 0;
    let winsBottom = 0;
    let live = false;
    for (const g of list) {
      const w = winnerOf(g);
      if (w === top) winsTop++;
      else if (w === bottom) winsBottom++;
      if (g.status === 2) live = true;
    }

    const conference = round === 4 ? null : seeds.get(top)?.conference ?? seeds.get(bottom)?.conference ?? null;

    rows.push({
      round,
      conference,
      seed_top: homeIsTop ? homeSeed : awaySeed,
      seed_bottom: homeIsTop ? awaySeed : homeSeed,
      team_top: top,
      team_bottom: bottom,
      wins_top: winsTop,
      wins_bottom: winsBottom,
      status:
        winsTop === 4 || winsBottom === 4 ? "completed" : winsTop + winsBottom > 0 || live ? "active" : "upcoming",
      games: list.map((g, i) => ({
        game_number: i + 1,
        home_team: g.home_team,
        away_team: g.away_team,
        home_score: g.home_score,
        away_score: g.away_score,
        status: g.status,
        game_date: g.game_date,
      })),
    });
  }
  return rows;
}
