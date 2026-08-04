import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "./br-salaries";
import { attachPlayerIds, fetchSeasonTransactions, type ParsedEvent } from "./br-transactions";
import { fetchDraft } from "./br-draft";
import { buildLotteryBoard, type LotteryRow, type StandingsRow } from "./lottery";
import { seasonFromStartYear, seasonStartYear } from "./season";
import {
  estimateSeasonPhases,
  phaseForDate,
  type PhaseKey,
  type SeasonPhase,
} from "./season-phases";

/**
 * Écritures du marché en base.
 *
 * Cette couche est partagée par la route de synchronisation quotidienne et par le
 * script de rattrapage historique : les deux font le même travail, sur une saison
 * ou sur douze. La logique ne vit donc qu'une fois.
 *
 * Deux principes, hérités des synchronisations existantes :
 *
 *   * On n'efface jamais. Tout passe par `upsert` : une page de Basketball
 *     Reference momentanément incomplète ne doit pas vider un historique.
 *   * Une date réelle saisie à la main prime sur une date estimée. Les périodes
 *     ne sont donc insérées que si elles manquent.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<any, any, any>;

const BATCH_SIZE = 200;

/* ─── Rapprochement des noms ─── */

/**
 * Index des joueurs par nom normalisé.
 *
 * Basketball Reference n'expose que son identifiant maison : le lien vers une
 * fiche joueur passe par le nom. Les joueurs actifs gagnent en cas d'homonymie —
 * un « Gary Payton » d'aujourd'hui est plus probablement celui dont on parle.
 */
export async function loadPlayerNameIndex(supabase: Client): Promise<Map<string, number>> {
  const index = new Map<string, number>();
  const seenActive = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("players")
      .select("player_id, first_name, last_name, is_active")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`lecture des joueurs impossible : ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const key = normalizeName(`${row.first_name} ${row.last_name}`);
      if (!key) continue;
      if (row.is_active) {
        index.set(key, row.player_id);
        seenActive.add(key);
      } else if (!seenActive.has(key) && !index.has(key)) {
        index.set(key, row.player_id);
      }
    }

    if (data.length < pageSize) break;
  }

  return index;
}

/* ─── Périodes ─── */

/**
 * Périodes d'une saison : les dates saisies à la main, complétées et rafraîchies
 * par les estimations.
 *
 * Une ligne estimée est une donnée dérivée : affiner la règle d'estimation doit la
 * mettre à jour, sinon la base garde éternellement une définition abandonnée. Une
 * ligne dont `is_estimated` est faux a été corrigée par un humain et prime
 * toujours : elle n'est jamais touchée.
 */
export async function ensureSeasonPhases(supabase: Client, season: string): Promise<SeasonPhase[]> {
  const { data, error } = await supabase
    .from("season_phases")
    .select("season, phase, starts_on, ends_on, is_estimated")
    .eq("season", season);

  if (error) throw new Error(`lecture des périodes impossible : ${error.message}`);

  const existing: SeasonPhase[] = (data || []).map((row) => ({
    season: row.season,
    phase: row.phase as PhaseKey,
    startsOn: row.starts_on,
    endsOn: row.ends_on ?? row.starts_on,
    isEstimated: row.is_estimated,
  }));

  // Les périodes corrigées à la main gardent la main ; les autres sont réécrites
  // depuis l'estimation courante.
  const corrected = new Set(existing.filter((p) => !p.isEstimated).map((p) => p.phase));
  const estimated = estimateSeasonPhases(season).filter((p) => !corrected.has(p.phase));

  if (estimated.length > 0) {
    const { error: writeError } = await supabase.from("season_phases").upsert(
      estimated.map((p) => ({
        season: p.season,
        phase: p.phase,
        starts_on: p.startsOn,
        ends_on: p.endsOn,
        is_estimated: true,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "season,phase" }
    );
    if (writeError) throw new Error(`écriture des périodes impossible : ${writeError.message}`);
  }

  return [...existing.filter((p) => corrected.has(p.phase)), ...estimated];
}

/* ─── Mouvements ─── */

export interface TransactionSyncResult {
  season: string;
  fetched: number;
  written: number;
  playersResolved: number;
  seasonsTouched: string[];
  pagesRead: number;
  pagesMissing: number;
}

/**
 * Synchronise les mouvements d'une saison.
 *
 * Les pages de Basketball Reference débordent de part et d'autre d'une saison :
 * les mouvements sont donc écrits dans la saison que leur date désigne, ce qui
 * peut en toucher trois (la précédente, la demandée, la suivante). Chacune reçoit
 * ses périodes au passage, pour que le classement par période soit juste.
 */
export async function syncSeasonTransactions(
  supabase: Client,
  season: string,
  log: (message: string) => void = () => {}
): Promise<TransactionSyncResult> {
  const { events, pagesRead, missing } = await fetchSeasonTransactions(season, log);

  const nameIndex = await loadPlayerNameIndex(supabase);
  const playersResolved = attachPlayerIds(events, nameIndex);

  // Périodes de chaque saison concernée, résolues une fois pour toutes.
  const seasonsTouched = [...new Set(events.map((e) => e.season))].sort();
  const phasesBySeason = new Map<string, SeasonPhase[]>();
  for (const touched of seasonsTouched) {
    phasesBySeason.set(touched, await ensureSeasonPhases(supabase, touched));
  }

  const rows = events.map((event) => toEventRow(event, phasesBySeason.get(event.season) || []));

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("league_events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any, { onConflict: "event_key" });
    if (error) {
      console.error(`[MARKET] écriture des mouvements (lot ${i}) :`, error.message);
      continue;
    }
    written += batch.length;
  }

  return {
    season,
    fetched: events.length,
    written,
    playersResolved,
    seasonsTouched,
    pagesRead: pagesRead.length,
    pagesMissing: missing.length,
  };
}

function toEventRow(event: ParsedEvent, phases: SeasonPhase[]) {
  return {
    event_key: event.event_key,
    season: event.season,
    event_date: event.event_date,
    phase: phaseForDate(event.event_date, phases),
    kind: event.kind,
    teams: event.teams,
    from_team: event.from_team,
    to_team: event.to_team,
    players: event.players,
    assets: event.assets,
    contract: event.contract,
    detail: event.detail,
    raw: event.raw,
    source: "basketball-reference",
    updated_at: new Date().toISOString(),
  };
}

/* ─── Draft et loterie ─── */

export interface DraftSyncResult {
  draftYear: number;
  season: string;
  picks: number;
  playersResolved: number;
  lotteryTeams: number;
  /** Vrai si la grille de loterie n'a pas pu être établie, faute de playoffs connus. */
  lotterySkipped: boolean;
}

/**
 * Synchronise une draft et la grille de loterie qui l'a précédée.
 *
 * La draft de juin Y ouvre la saison Y/Y+1 ; sa loterie découle du classement de
 * la saison Y-1/Y. Sans playoffs connus pour cette saison-là, la grille est
 * laissée de côté plutôt que devinée.
 */
export async function syncDraftYear(
  supabase: Client,
  draftYear: number,
  log: (message: string) => void = () => {}
): Promise<DraftSyncResult> {
  const season = seasonFromStartYear(draftYear);
  const picks = await fetchDraft(draftYear);
  log(`draft ${draftYear} — ${picks.length} choix`);

  let playersResolved = 0;
  if (picks.length > 0) {
    const nameIndex = await loadPlayerNameIndex(supabase);
    const rows = picks.map((pick) => {
      const playerId = pick.player_name ? nameIndex.get(normalizeName(pick.player_name)) : undefined;
      if (playerId) playersResolved++;
      return {
        draft_year: pick.draft_year,
        pick_overall: pick.pick_overall,
        season: pick.season,
        round: pick.round,
        pick_in_round: pick.pick_in_round,
        team_tricode: pick.team_tricode,
        player_name: pick.player_name,
        player_id: playerId ?? null,
        br_slug: pick.br_slug,
        college: pick.college,
        updated_at: new Date().toISOString(),
      };
    });

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const { error } = await supabase
        .from("draft_picks")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .upsert(rows.slice(i, i + BATCH_SIZE) as any, { onConflict: "draft_year,pick_overall" });
      if (error) console.error(`[MARKET] écriture des choix de draft :`, error.message);
    }
  }

  const lottery = await buildLotteryFromDatabase(supabase, draftYear);
  if (lottery.length > 0) {
    const { error } = await supabase
      .from("draft_lottery")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(
        lottery.map((row) => ({
          draft_year: row.draft_year,
          team_tricode: row.team_tricode,
          from_season: row.from_season,
          pre_lottery_rank: row.pre_lottery_rank,
          wins: row.wins,
          losses: row.losses,
          odds_top1: row.odds_top1,
          tied: row.tied,
          updated_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any,
        { onConflict: "draft_year,team_tricode" }
      );
    if (error) console.error("[MARKET] écriture de la loterie :", error.message);
    else log(`loterie ${draftYear} — ${lottery.length} équipes`);
  }

  return {
    draftYear,
    season,
    picks: picks.length,
    playersResolved,
    lotteryTeams: lottery.length,
    lotterySkipped: lottery.length === 0,
  };
}

/** Grille de loterie d'une draft, reconstruite depuis le classement et les playoffs. */
export async function buildLotteryFromDatabase(
  supabase: Client,
  draftYear: number
): Promise<LotteryRow[]> {
  const fromSeason = seasonFromStartYear(draftYear - 1);

  const [{ data: standings }, { data: series }] = await Promise.all([
    supabase.from("standings").select("team_tricode, wins, losses").eq("season", fromSeason),
    supabase.from("playoff_series").select("team_top, team_bottom").eq("season", fromSeason),
  ]);

  if (!standings || standings.length === 0) return [];

  const playoffTeams = new Set<string>();
  for (const row of series || []) {
    if (row.team_top) playoffTeams.add(row.team_top);
    if (row.team_bottom) playoffTeams.add(row.team_bottom);
  }

  return buildLotteryBoard({
    fromSeason,
    draftYear,
    standings: standings as StandingsRow[],
    playoffTeams,
  });
}

/** Année de draft associée à une saison : 2025-26 est ouverte par la draft 2025. */
export function draftYearForSeason(season: string): number {
  return seasonStartYear(season);
}
