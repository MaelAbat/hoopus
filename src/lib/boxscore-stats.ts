/**
 * Statistiques de saison recalculées à partir des box scores en base.
 *
 * stats.nba.com ne nous répond plus. Ses tableaux de joueurs et d'équipes
 * (`leaguedashplayerstats`, `leaguedashteamstats`) sont reconstruits ici, au
 * même format — mêmes en-têtes, mêmes échelles —, à partir des box scores ESPN
 * de chaque match terminé. Les routes de sync gardent ainsi toute leur logique
 * (catégories, seuils d'éligibilité, classements) sans savoir d'où viennent les
 * chiffres.
 *
 * Les stats de base sont exactes, aux minutes près : ESPN arrondit le temps de
 * jeu de chaque match à la minute. Les stats avancées suivent des formules
 * publiques, et ne coïncident donc pas au dixième avec celles de NBA.com, qui
 * s'appuient sur des données de terrain qu'elle seule publie :
 *
 *   PIE                        formule de la NBA, rapportée au temps de jeu
 *   USG%, AST%, OREB/DREB/REB% formules de Basketball Reference
 *   OFF/DEF RATING (joueur)    évaluations individuelles de Dean Oliver
 *   OFF/DEF RATING (équipe)    points pour / contre par 100 possessions
 *   PACE                       possessions par 48 minutes, pondérées par le
 *                              temps de jeu du joueur
 *
 * Pour un joueur, les totaux d'équipe et d'adversaire sont ceux des matchs
 * qu'il a joués : un joueur échangé en cours de saison est rapporté à chacune
 * de ses équipes pour les rencontres disputées avec elle.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { syncBoxscore } from "./sync-boxscore";
import { ACTIVE_TEAM_IDS } from "./nba-teams";

export type GameType = "regular" | "playoffs";

/** Même forme que les réponses de stats.nba.com. */
export interface DashResponse {
  resultSets: { headers: string[]; rowSet: (string | number)[][] }[];
}

interface BoxRow {
  game_id: string;
  player_id: number;
  player_name: string;
  team: string;
  minutes: string | null;
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
}

interface GameMeta {
  game_id: string;
  game_date: string;
  status_text: string | null;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
}

/** Les compteurs d'un box score, pour un joueur, une équipe ou un match. */
interface Line {
  mp: number;
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
  pm: number;
}

const zero = (): Line => ({
  mp: 0, pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0,
  fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, pm: 0,
});

function add(into: Line, from: Line): void {
  for (const k of Object.keys(into) as (keyof Line)[]) into[k] += from[k];
}

function minutesOf(raw: string | null): number {
  if (!raw) return 0;
  const [m, s] = raw.split(":");
  return (Number(m) || 0) + (Number(s) || 0) / 60;
}

function lineOf(r: BoxRow): Line {
  return {
    mp: minutesOf(r.minutes), pts: r.pts, reb: r.reb, oreb: r.oreb, dreb: r.dreb, ast: r.ast,
    stl: r.stl, blk: r.blk, tov: r.tov, pf: r.pf, fgm: r.fgm, fga: r.fga, fg3m: r.fg3m,
    fg3a: r.fg3a, ftm: r.ftm, fta: r.fta, pm: r.plus_minus,
  };
}

/** Minutes d'équipe : 240 en temps réglementaire, 25 de plus par prolongation. */
function teamMinutes(statusText: string | null): number {
  const ot = statusText?.match(/OT(\d*)/);
  const overtimes = ot ? Number(ot[1] || 1) : 0;
  return 240 + 25 * overtimes;
}

/** Possessions d'une équipe sur un match (estimation de Basketball Reference). */
function possessions(t: Line, o: Line): number {
  const side = (a: Line, b: Line) => {
    const orbShare = a.oreb + b.dreb > 0 ? a.oreb / (a.oreb + b.dreb) : 0;
    return a.fga + 0.4 * a.fta - 1.07 * orbShare * (a.fga - a.fgm) + a.tov;
  };
  return 0.5 * (side(t, o) + side(o, t));
}

/** Numérateur du PIE : la même expression sert pour le joueur et pour le match. */
function pieScore(l: Line): number {
  return l.pts + l.fgm + l.ftm - l.fga - l.fta + l.dreb + 0.5 * l.oreb + l.ast + l.stl + 0.5 * l.blk - l.pf - l.tov;
}

const ratio = (a: number, b: number) => (b > 0 && Number.isFinite(a / b) ? a / b : 0);

/* ─── Lecture ─── */

async function finishedGames(supabase: SupabaseClient, season: string, gameType: GameType): Promise<GameMeta[]> {
  const games: GameMeta[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("games")
      .select("game_id, game_date, status_text, home_team, away_team, home_score, away_score")
      .eq("season", season)
      .eq("game_type", gameType)
      .eq("status", 3)
      .order("game_id")
      .range(from, from + 999);
    if (error) throw new Error(`lecture des matchs impossible : ${error.message}`);
    games.push(...((data ?? []) as GameMeta[]));
    if (!data || data.length < 1000) break;
  }
  return games;
}

async function boxscoreRows(supabase: SupabaseClient, gameIds: string[]): Promise<BoxRow[]> {
  const rows: BoxRow[] = [];
  for (let i = 0; i < gameIds.length; i += 40) {
    const chunk = gameIds.slice(i, i + 40);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("boxscores")
        .select("game_id, player_id, player_name, team, minutes, pts, reb, oreb, dreb, ast, stl, blk, tov, pf, fgm, fga, fg3m, fg3a, ftm, fta, plus_minus")
        .in("game_id", chunk)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`lecture des box scores impossible : ${error.message}`);
      rows.push(...((data ?? []) as BoxRow[]));
      if (!data || data.length < 1000) break;
    }
  }
  return rows;
}

/**
 * Matchs qui ont déjà un box score. Une ligne par match suffit : relire les
 * vingt joueurs de chacun pour le savoir coûtait une saison entière de lignes.
 */
async function gamesWithBoxscore(supabase: SupabaseClient, gameIds: string[]): Promise<Set<string>> {
  const present = new Set<string>();
  await Promise.all(
    Array.from({ length: Math.ceil(gameIds.length / 100) }, async (_, k) => {
      const chunk = gameIds.slice(k * 100, k * 100 + 100);
      const { data, error } = await supabase
        .from("boxscores")
        .select("game_id")
        .in("game_id", chunk)
        .eq("starter", true);
      if (error) throw new Error(`lecture des box scores impossible : ${error.message}`);
      for (const r of data ?? []) present.add(r.game_id);
    })
  );
  return present;
}

/**
 * Récupère les box scores manquants des matchs terminés de la saison. Une
 * requête ESPN par match absent : la première fois, toute la saison écoulée ;
 * ensuite, seulement les matchs de la veille.
 */
export async function ensureSeasonBoxscores(
  supabase: SupabaseClient,
  season: string,
  gameType: GameType,
  { budgetMs = 40_000, recentDays = 3 }: { budgetMs?: number; recentDays?: number } = {}
): Promise<{ missing: number; synced: number; complete: boolean }> {
  const games = await finishedGames(supabase, season, gameType);
  const ids = games.map((g) => g.game_id);
  const present = await gamesWithBoxscore(supabase, ids);
  const missing = ids.filter((id) => !present.has(id));

  // Les matchs des derniers jours sont relus même s'ils ont un box score : les
  // corrections de stats tombent après coup, et un box score pris pendant le
  // direct peut s'être arrêté avant la dernière action. Un box score inchangé
  // n'est pas réécrit (voir syncEspnBoxscore).
  const since = new Date(Date.now() - recentDays * 86_400_000).toISOString().slice(0, 10);
  const recent = games.filter((g) => g.game_date >= since && present.has(g.game_id)).map((g) => g.game_id);

  const started = Date.now();
  let synced = 0;
  for (const [id, force] of [...missing.map((id) => [id, false] as const), ...recent.map((id) => [id, true] as const)]) {
    // Budget : la fonction Vercel est plafonnée à 60 s. Ce qui reste sera
    // récupéré à la sync suivante.
    if (Date.now() - started > budgetMs) break;
    const ok = await syncBoxscore(id, { force });
    if (ok && !force) synced++;
    await new Promise((r) => setTimeout(r, 150));
  }

  return { missing: missing.length, synced, complete: synced === missing.length };
}

/* ─── Agrégation ─── */

interface PlayerAgg {
  id: number;
  name: string;
  team: string;
  lastDate: string;
  gp: number;
  own: Line;
  /** Totaux de son équipe et de l'adversaire, sur ses seuls matchs. */
  tm: Line;
  opp: Line;
  tmMp: number;
  poss: number;
  /** Somme des minutes × rythme du match, pour le PACE pondéré. */
  paceMinutes: number;
  /**
   * Dénominateur du PIE : les actions des deux équipes pendant son temps de
   * jeu. La NBA rapporte le joueur à ce qui s'est passé quand il était sur le
   * terrain, pas au match entier — c'est ce qui donne 0,19 à Dončić et non 0,14.
   */
  gamePie: number;
}

interface TeamAgg {
  team: string;
  gp: number;
  w: number;
  l: number;
  own: Line;
  opp: Line;
  tmMp: number;
  poss: number;
  gamePie: number;
}

interface Aggregates {
  players: PlayerAgg[];
  teams: TeamAgg[];
}

/**
 * `byTeam` sépare un joueur échangé en une ligne par équipe, comme les carrières
 * de NBA.com ; sans lui, une seule ligne par joueur, affichée sous sa dernière
 * équipe, comme les tableaux de la ligue.
 */
async function aggregate(
  supabase: SupabaseClient,
  season: string,
  gameType: GameType,
  { byTeam = false }: { byTeam?: boolean } = {}
): Promise<Aggregates> {
  const games = await finishedGames(supabase, season, gameType);
  const rows = await boxscoreRows(supabase, games.map((g) => g.game_id));
  const gameById = new Map(games.map((g) => [g.game_id, g]));

  // Noms officiels (accents compris) pour les joueurs rapprochés d'une fiche :
  // ESPN écrit « Luka Doncic », la NBA « Luka Dončić ».
  const ids = [...new Set(rows.map((r) => r.player_id).filter((id) => id > 0))];
  const officialName = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("players")
      .select("player_id, first_name, last_name")
      .in("player_id", ids.slice(i, i + 200));
    for (const p of data ?? []) officialName.set(p.player_id, `${p.first_name} ${p.last_name}`.trim());
  }

  const byGame = new Map<string, BoxRow[]>();
  for (const r of rows) {
    const list = byGame.get(r.game_id);
    if (list) list.push(r);
    else byGame.set(r.game_id, [r]);
  }

  const players = new Map<string, PlayerAgg>();
  const teams = new Map<string, TeamAgg>();

  for (const [gameId, list] of byGame) {
    const game = gameById.get(gameId);
    if (!game) continue;

    const totals = new Map<string, Line>();
    for (const r of list) {
      const t = totals.get(r.team) ?? zero();
      add(t, lineOf(r));
      totals.set(r.team, t);
    }
    if (totals.size !== 2) continue;

    const tmMp = teamMinutes(game.status_text);
    const [a, b] = [...totals.keys()];
    const both = zero();
    add(both, totals.get(a)!);
    add(both, totals.get(b)!);
    const gamePie = pieScore(both);

    for (const team of [a, b]) {
      const own = totals.get(team)!;
      const opp = totals.get(team === a ? b : a)!;
      const poss = possessions(own, opp);
      const pace = ratio(48 * poss, tmMp / 5);

      const agg = teams.get(team) ?? {
        team, gp: 0, w: 0, l: 0, own: zero(), opp: zero(), tmMp: 0, poss: 0, gamePie: 0,
      };
      agg.gp++;
      if (own.pts > opp.pts) agg.w++;
      else agg.l++;
      add(agg.own, own);
      add(agg.opp, opp);
      agg.tmMp += tmMp;
      agg.poss += poss;
      agg.gamePie += gamePie;
      teams.set(team, agg);

      for (const r of list.filter((x) => x.team === team)) {
        const line = lineOf(r);
        const key = byTeam ? `${r.player_id}|${r.team}` : String(r.player_id);
        const p = players.get(key) ?? {
          id: r.player_id,
          name: officialName.get(r.player_id) ?? r.player_name,
          team: r.team,
          lastDate: "",
          gp: 0, own: zero(), tm: zero(), opp: zero(), tmMp: 0, poss: 0, paceMinutes: 0, gamePie: 0,
        };
        // L'équipe affichée est la dernière en date, comme sur NBA.com.
        if (game.game_date >= p.lastDate) {
          p.lastDate = game.game_date;
          p.team = r.team;
        }
        p.gp++;
        add(p.own, line);
        add(p.tm, own);
        add(p.opp, opp);
        p.tmMp += tmMp;
        p.poss += poss;
        p.paceMinutes += line.mp * pace;
        p.gamePie += gamePie * ratio(line.mp, tmMp / 5);
        players.set(key, p);
      }
    }
  }

  return { players: [...players.values()], teams: [...teams.values()] };
}

/* ─── Évaluations de Dean Oliver ─── */

function offensiveRating(p: PlayerAgg): number {
  const { own: P, tm: T, opp: O, tmMp } = p;
  if (P.mp <= 0 || T.fgm <= 0 || T.fta <= 0) return 0;
  const share = P.mp / (tmMp / 5);

  const qAst =
    share * (1.14 * ratio(T.ast - P.ast, T.fgm)) +
    ratio((T.ast / tmMp) * P.mp * 5 - P.ast, (T.fgm / tmMp) * P.mp * 5 - P.fgm) * (1 - share);
  const ptsFromFg = P.pts - P.ftm;
  const fgPart = P.fga > 0 ? P.fgm * (1 - 0.5 * (ptsFromFg / (2 * P.fga)) * qAst) : 0;
  const astPart = 0.5 * ratio(T.pts - T.ftm - ptsFromFg, 2 * (T.fga - P.fga)) * P.ast;
  const ftMiss = P.fta > 0 ? (1 - P.ftm / P.fta) ** 2 : 1;
  const ftPart = (1 - ftMiss) * 0.4 * P.fta;

  const tmScPoss = T.fgm + (1 - (1 - T.ftm / T.fta) ** 2) * T.fta * 0.4;
  const tmOrbPct = ratio(T.oreb, T.oreb + O.dreb);
  const tmPlayPct = ratio(tmScPoss, T.fga + T.fta * 0.4 + T.tov);
  const tmOrbWeight = ratio(
    (1 - tmOrbPct) * tmPlayPct,
    (1 - tmOrbPct) * tmPlayPct + tmOrbPct * (1 - tmPlayPct)
  );
  const orbPart = P.oreb * tmOrbWeight * tmPlayPct;
  const orbFactor = 1 - ratio(T.oreb, tmScPoss) * tmOrbWeight * tmPlayPct;

  const scPoss = (fgPart + astPart + ftPart) * orbFactor + orbPart;
  const fgxPoss = (P.fga - P.fgm) * (1 - 1.07 * tmOrbPct);
  const ftxPoss = ftMiss * 0.4 * P.fta;
  const totPoss = scPoss + fgxPoss + ftxPoss + P.tov;

  const pprodFg = P.fga > 0 ? 2 * (P.fgm + 0.5 * P.fg3m) * (1 - 0.5 * (ptsFromFg / (2 * P.fga)) * qAst) : 0;
  const pprodAst =
    2 * ratio(T.fgm - P.fgm + 0.5 * (T.fg3m - P.fg3m), T.fgm - P.fgm) *
    0.5 * ratio(T.pts - T.ftm - ptsFromFg, 2 * (T.fga - P.fga)) * P.ast;
  const pprodOrb = P.oreb * tmOrbWeight * tmPlayPct * ratio(T.pts, tmScPoss);
  const pprod = (pprodFg + pprodAst + P.ftm) * orbFactor + pprodOrb;

  return 100 * ratio(pprod, totPoss);
}

function defensiveRating(p: PlayerAgg): number {
  const { own: P, tm: T, opp: O, tmMp, poss } = p;
  if (P.mp <= 0 || poss <= 0 || O.fga <= 0) return 0;

  const dorPct = ratio(O.oreb, O.oreb + T.dreb);
  const dfgPct = O.fgm / O.fga;
  const fmWt = ratio(dfgPct * (1 - dorPct), dfgPct * (1 - dorPct) + (1 - dfgPct) * dorPct);
  const stops1 = P.stl + P.blk * fmWt * (1 - 1.07 * dorPct) + P.dreb * (1 - fmWt);
  const oppFtMiss = O.fta > 0 ? (1 - O.ftm / O.fta) ** 2 : 0;
  const stops2 =
    (ratio(O.fga - O.fgm - T.blk, tmMp) * fmWt * (1 - 1.07 * dorPct) + ratio(O.tov - T.stl, tmMp)) * P.mp +
    ratio(P.pf, T.pf) * 0.4 * O.fta * oppFtMiss;
  const stopPct = ratio((stops1 + stops2) * tmMp, poss * P.mp);

  const teamDrtg = 100 * (O.pts / poss);
  const dPtsPerScPoss = ratio(O.pts, O.fgm + (1 - oppFtMiss) * O.fta * 0.4);
  return teamDrtg + 0.2 * (100 * dPtsPerScPoss * (1 - stopPct) - teamDrtg);
}

/* ─── Tableaux au format stats.nba.com ─── */

const PLAYER_BASE_HEADERS = [
  "PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GP", "MIN", "PTS", "REB", "OREB", "DREB",
  "AST", "STL", "BLK", "TOV", "PF", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "PLUS_MINUS",
  "NBA_FANTASY_PTS",
];

const PLAYER_ADV_HEADERS = [
  "PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GP", "MIN", "USG_PCT", "OFF_RATING",
  "DEF_RATING", "NET_RATING", "AST_PCT", "OREB_PCT", "DREB_PCT", "REB_PCT", "PACE", "PIE",
  "TS_PCT", "EFG_PCT",
];

/** Barème « fantasy » de NBA.com, que le site affiche sous le nom EFF. */
function fantasyPoints(l: Line): number {
  return l.pts + 1.2 * l.reb + 1.5 * l.ast + 3 * l.stl + 3 * l.blk - l.tov;
}

function baseRow(p: PlayerAgg, perGame: boolean): (string | number)[] {
  const d = perGame ? p.gp : 1;
  const l = p.own;
  return [
    p.id, p.name, p.team, p.gp, l.mp / d, l.pts / d, l.reb / d, l.oreb / d, l.dreb / d,
    l.ast / d, l.stl / d, l.blk / d, l.tov / d, l.pf / d, l.fgm / d, l.fga / d, l.fg3m / d,
    l.fg3a / d, l.ftm / d, l.fta / d, l.pm / d, fantasyPoints(l) / d,
  ];
}

function advancedRow(p: PlayerAgg): (string | number)[] {
  const { own: P, tm: T, opp: O, tmMp } = p;
  const fifth = tmMp / 5;
  const usg = ratio((P.fga + 0.44 * P.fta + P.tov) * fifth, P.mp * (T.fga + 0.44 * T.fta + T.tov));
  const astPct = ratio(P.ast, (P.mp / fifth) * T.fgm - P.fgm);
  const orebPct = ratio(P.oreb * fifth, P.mp * (T.oreb + O.dreb));
  const drebPct = ratio(P.dreb * fifth, P.mp * (T.dreb + O.oreb));
  const rebPct = ratio(P.reb * fifth, P.mp * (T.reb + O.reb));
  const ortg = offensiveRating(p);
  const drtg = defensiveRating(p);
  return [
    p.id, p.name, p.team, p.gp, P.mp / p.gp,
    usg, ortg, drtg, ortg && drtg ? ortg - drtg : 0, astPct, orebPct, drebPct, rebPct,
    ratio(p.paceMinutes, P.mp), ratio(pieScore(P), p.gamePie),
    ratio(P.pts, 2 * (P.fga + 0.44 * P.fta)), ratio(P.fgm + 0.5 * P.fg3m, P.fga),
  ];
}

const dash = (headers: string[], rowSet: (string | number)[][]): DashResponse => ({
  resultSets: [{ headers, rowSet }],
});

/**
 * Équivalents de `leaguedashplayerstats` : totaux (Base/Totals), moyennes
 * (Base/PerGame) et stats avancées (Advanced/PerGame).
 */
export async function playerDashboards(
  supabase: SupabaseClient,
  season: string,
  gameType: GameType
): Promise<{ totals: DashResponse; perGame: DashResponse; advanced: DashResponse }> {
  const { players } = await aggregate(supabase, season, gameType);
  return {
    totals: dash(PLAYER_BASE_HEADERS, players.map((p) => baseRow(p, false))),
    perGame: dash(PLAYER_BASE_HEADERS, players.map((p) => baseRow(p, true))),
    advanced: dash(PLAYER_ADV_HEADERS, players.map(advancedRow)),
  };
}

const TEAM_BASE_HEADERS = [
  "TEAM_ID", "TEAM_NAME", "GP", "W", "L", "W_PCT", "PTS", "REB", "AST", "STL", "BLK", "TOV",
  "FG_PCT", "FG3_PCT", "FT_PCT", "OREB", "DREB", "PLUS_MINUS",
];

const TEAM_ADV_HEADERS = [
  "TEAM_ID", "TEAM_NAME", "OFF_RATING", "DEF_RATING", "NET_RATING", "PACE", "TS_PCT", "EFG_PCT",
  "AST_PCT", "AST_RATIO", "OREB_PCT", "DREB_PCT", "TM_TOV_PCT", "PIE",
];

const round = (v: number, digits: number) => Number(v.toFixed(digits));

/**
 * Équivalents de `leaguedashteamstats` en moyennes par match (Base et
 * Advanced). `teamNames` donne le nom complet de chaque franchise par tricode.
 */
export async function teamDashboards(
  supabase: SupabaseClient,
  season: string,
  gameType: GameType,
  teamNames: Record<string, string>
): Promise<{ base: DashResponse; advanced: DashResponse }> {
  const { teams } = await aggregate(supabase, season, gameType);
  const base: (string | number)[][] = [];
  const advanced: (string | number)[][] = [];

  for (const t of teams) {
    const id = ACTIVE_TEAM_IDS[t.team];
    if (!id) continue;
    const name = teamNames[t.team] ?? t.team;
    const { own: T, opp: O, gp } = t;
    const g = (v: number) => round(v / gp, 1);

    base.push([
      id, name, gp, t.w, t.l, round(ratio(t.w, gp), 3), g(T.pts), g(T.reb), g(T.ast), g(T.stl),
      g(T.blk), g(T.tov), round(ratio(T.fgm, T.fga), 3), round(ratio(T.fg3m, T.fg3a), 3),
      round(ratio(T.ftm, T.fta), 3), g(T.oreb), g(T.dreb), g(T.pts - O.pts),
    ]);

    const ortg = 100 * ratio(T.pts, t.poss);
    const drtg = 100 * ratio(O.pts, t.poss);
    advanced.push([
      id, name, round(ortg, 1), round(drtg, 1), round(ortg - drtg, 1),
      round(ratio(48 * t.poss, t.tmMp / 5), 2),
      round(ratio(T.pts, 2 * (T.fga + 0.44 * T.fta)), 3),
      round(ratio(T.fgm + 0.5 * T.fg3m, T.fga), 3),
      round(ratio(T.ast, T.fgm), 3),
      round(ratio(100 * T.ast, T.fga + 0.44 * T.fta + T.ast + T.tov), 1),
      round(ratio(T.oreb, T.oreb + O.dreb), 3),
      round(ratio(T.dreb, T.dreb + O.oreb), 3),
      round(ratio(T.tov, T.fga + 0.44 * T.fta + T.tov), 3),
      round(ratio(pieScore(T), t.gamePie), 3),
    ]);
  }

  return { base: dash(TEAM_BASE_HEADERS, base), advanced: dash(TEAM_ADV_HEADERS, advanced) };
}

/** La saison est-elle lue chez ESPN ? Ses statistiques se calculent alors ici. */
export async function isEspnSeason(supabase: SupabaseClient, season: string): Promise<boolean> {
  const { count } = await supabase
    .from("games")
    .select("game_id", { count: "exact", head: true })
    .eq("season", season)
    .eq("source", "espn");
  return (count ?? 0) > 0;
}

/* ─── Carrières ─── */

/** Ligne de `player_career_stats` pour une saison, hors stats « + » (calculées par l'appelant). */
export interface CareerLine {
  player_id: number;
  season: string;
  team: string;
  gp: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  tov: number;
  pf: number;
  plus_minus: number;
  off_rating: number;
  def_rating: number;
  net_rating: number;
  ts_pct: number;
  efg_pct: number;
  usg_pct: number;
  pace: number;
  pie: number;
  ast_pct: number;
  oreb_pct: number;
  dreb_pct: number;
  reb_pct: number;
}

function careerLine(p: PlayerAgg, season: string, team: string): CareerLine {
  const adv = advancedRow(p);
  const at = (h: string) => Number(adv[PLAYER_ADV_HEADERS.indexOf(h)]);
  const l = p.own;
  const g = (v: number) => round(v / p.gp, 1);
  return {
    player_id: p.id,
    season,
    team,
    gp: p.gp,
    min: g(l.mp),
    pts: g(l.pts),
    reb: g(l.reb),
    ast: g(l.ast),
    stl: g(l.stl),
    blk: g(l.blk),
    fg_pct: round(ratio(l.fgm, l.fga), 3),
    fg3_pct: round(ratio(l.fg3m, l.fg3a), 3),
    ft_pct: round(ratio(l.ftm, l.fta), 3),
    fgm: g(l.fgm),
    fga: g(l.fga),
    fg3m: g(l.fg3m),
    fg3a: g(l.fg3a),
    ftm: g(l.ftm),
    fta: g(l.fta),
    oreb: g(l.oreb),
    dreb: g(l.dreb),
    tov: g(l.tov),
    pf: g(l.pf),
    plus_minus: g(l.pm),
    off_rating: round(at("OFF_RATING"), 1),
    def_rating: round(at("DEF_RATING"), 1),
    net_rating: round(at("NET_RATING"), 1),
    ts_pct: round(at("TS_PCT"), 3),
    efg_pct: round(at("EFG_PCT"), 3),
    usg_pct: round(at("USG_PCT"), 3),
    pace: round(at("PACE"), 2),
    pie: round(at("PIE"), 3),
    ast_pct: round(at("AST_PCT"), 3),
    oreb_pct: round(at("OREB_PCT"), 3),
    dreb_pct: round(at("DREB_PCT"), 3),
    reb_pct: round(at("REB_PCT"), 3),
  };
}

/**
 * Lignes de carrière d'une saison de saison régulière, au format de NBA.com :
 * une ligne par équipe, plus une ligne `TOT` pour un joueur passé par
 * plusieurs.
 */
export async function seasonCareerLines(supabase: SupabaseClient, season: string): Promise<CareerLine[]> {
  const [{ players: perTeam }, { players: whole }] = await Promise.all([
    aggregate(supabase, season, "regular", { byTeam: true }),
    aggregate(supabase, season, "regular"),
  ]);

  const teamCount = new Map<number, number>();
  for (const p of perTeam) teamCount.set(p.id, (teamCount.get(p.id) ?? 0) + 1);

  const lines = perTeam.map((p) => careerLine(p, season, p.team));
  for (const p of whole) {
    if ((teamCount.get(p.id) ?? 0) > 1) lines.push(careerLine(p, season, "TOT"));
  }
  return lines;
}
