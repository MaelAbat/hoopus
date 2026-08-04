import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeName } from "./br-salaries";
import { attachPlayerIds, fetchSeasonTransactions, type ParsedEvent } from "./br-transactions";
import { fetchEspnEvents } from "./espn-transactions";
import { fetchDraft } from "./br-draft";
import { semanticKey } from "./market";
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

/**
 * Libellés des franchises NBA, lus depuis les classements.
 *
 * Le champ `college` de l'API NBA n'est pas fiable : pour certains joueurs, il
 * contient l'équipe NBA du moment et non l'université ou le club d'avant-draft
 * (Alex Sarr y figure avec « Washington Wizards »). Avant de reprendre cette
 * valeur, il faut donc pouvoir reconnaître un nom de franchise.
 *
 * La liste vient de la base plutôt que du code : elle couvre ainsi les noms
 * historiques sans entretien.
 */
export async function loadFranchiseLabels(supabase: Client): Promise<Set<string>> {
  const labels = new Set<string>();
  const { data } = await supabase.from("standings").select("team_city, team_name");

  for (const row of data || []) {
    if (!row.team_name) continue;
    labels.add(normalizeLabel(row.team_name));
    if (row.team_city) labels.add(normalizeLabel(`${row.team_city} ${row.team_name}`));
  }

  return labels;
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Valeurs de remplissage de l'API NBA, à ne pas confondre avec une information.
 * Un tiret recopié dans une colonne se lit comme une donnée ; une case vide se
 * lit comme une absence, ce qu'elle est.
 */
const PLACEHOLDERS = /^(?:[-–—]+|n\/?a|none|null|unknown|undrafted|inconnu)$/i;

/**
 * Université ou club d'un joueur drafté.
 *
 * Basketball Reference ne renseigne que les universités : un joueur venu d'un
 * club professionnel étranger arrive sans rien, alors que la fiche joueur connaît
 * souvent son club. On complète donc, en écartant deux valeurs trompeuses :
 *
 *   * les noms de franchises NBA — le champ `college` de l'API contient parfois
 *     l'équipe du moment (Alex Sarr y figure avec « Washington Wizards ») ;
 *   * les tirets et autres marques de remplissage.
 *
 * Dans les deux cas, mieux vaut une case vide qu'une affirmation fausse.
 */
export function resolveCollege(
  fromDraftPage: string | null,
  fromPlayerRow: string | null | undefined,
  franchiseLabels: Set<string>
): string | null {
  const fromDraft = fromDraftPage?.trim();
  if (fromDraft && !PLACEHOLDERS.test(fromDraft)) return fromDraft;

  const fromPlayer = fromPlayerRow?.trim();
  if (!fromPlayer || PLACEHOLDERS.test(fromPlayer)) return null;
  return franchiseLabels.has(normalizeLabel(fromPlayer)) ? null : fromPlayer;
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
  const scrape = await fetchSeasonTransactions(season, log);
  const { pagesRead, missing } = scrape;

  const { kept: events, dropped } = await filterAlreadyKnown(supabase, scrape.events);
  if (dropped > 0) log(`${dropped} mouvement(s) déjà connus d'une autre source, ignorés`);

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

/**
 * Écarte les mouvements déjà connus sous une autre plume.
 *
 * Deux sources décrivent la même signature avec des mots différents, donc avec
 * des empreintes de texte différentes : sans ce filtre, ESPN rejouerait ce que
 * Basketball Reference a déjà écrit, et inversement le jour où BR rattrape son
 * retard. La comparaison porte sur le sens du mouvement (voir `semanticKey`).
 *
 * Un mouvement déjà présent avec la *même* empreinte de texte n'est pas écarté :
 * c'est la même ligne, que l'upsert doit pouvoir mettre à jour.
 */
export async function filterAlreadyKnown(
  supabase: Client,
  events: ParsedEvent[]
): Promise<{ kept: ParsedEvent[]; dropped: number }> {
  if (events.length === 0) return { kept: [], dropped: 0 };

  const dates = events.map((e) => e.event_date).sort();
  const { data, error } = await supabase
    .from("league_events")
    .select("event_key, event_date, kind, teams, players")
    .gte("event_date", dates[0])
    .lte("event_date", dates[dates.length - 1]);

  if (error) {
    console.warn(`[MARKET] comparaison impossible, écriture sans filtre : ${error.message}`);
    return { kept: events, dropped: 0 };
  }

  const known = new Map<string, string>();
  for (const row of data || []) {
    known.set(
      semanticKey({
        event_date: row.event_date,
        kind: row.kind,
        teams: row.teams ?? [],
        players: row.players ?? [],
      }),
      row.event_key
    );
  }

  const kept = events.filter((event) => {
    const existing = known.get(semanticKey(event));
    return existing === undefined || existing === event.event_key;
  });

  return { kept, dropped: events.length - kept.length };
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

/**
 * Synchronise les mouvements vus par ESPN pour une année civile.
 *
 * Ce lecteur existe parce que Basketball Reference publie avec retard : début
 * août 2026, son journal s'arrêtait au 9 juillet, sans l'arrivée de LeBron James
 * à Philadelphie ni l'échange envoyant Zaccharie Risacher à Dallas. ESPN est à
 * jour au jour près.
 *
 * Il ne remplace pas BR, qui reste plus riche — liens joueurs, choix de draft
 * détaillés. Les deux cohabitent, et `filterAlreadyKnown` empêche de compter deux
 * fois le même mouvement.
 */
export async function syncEspnTransactions(
  supabase: Client,
  year: number | undefined,
  log: (message: string) => void = () => {}
): Promise<TransactionSyncResult & { entries: number; skipped: number }> {
  const scrape = await fetchEspnEvents(year);
  log(`${scrape.entries} entrées ESPN, ${scrape.events.length} mouvements lus`);
  if (scrape.skipped.length > 0) {
    log(`${scrape.skipped.length} phrase(s) non exploitées`);
  }

  const { kept: events, dropped } = await filterAlreadyKnown(supabase, scrape.events);
  if (dropped > 0) log(`${dropped} mouvement(s) déjà connus de Basketball Reference, ignorés`);

  const nameIndex = await loadPlayerNameIndex(supabase);
  const playersResolved = attachPlayerIds(events, nameIndex);

  const seasonsTouched = [...new Set(events.map((e) => e.season))].sort();
  const phasesBySeason = new Map<string, SeasonPhase[]>();
  for (const touched of seasonsTouched) {
    phasesBySeason.set(touched, await ensureSeasonPhases(supabase, touched));
  }

  const rows = events.map((event) => ({
    ...toEventRow(event, phasesBySeason.get(event.season) || []),
    source: "espn",
  }));

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("league_events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(batch as any, { onConflict: "event_key" });
    if (error) {
      console.error(`[MARKET] écriture ESPN (lot ${i}) :`, error.message);
      continue;
    }
    written += batch.length;
  }

  return {
    season: seasonsTouched.join(", "),
    fetched: scrape.events.length,
    written,
    playersResolved,
    seasonsTouched,
    pagesRead: 1,
    pagesMissing: 0,
    entries: scrape.entries,
    skipped: scrape.skipped.length,
  };
}

/* ─── Draft et loterie ─── */

export interface DraftSyncResult {
  draftYear: number;
  season: string;
  picks: number;
  playersResolved: number;
  /** Universités ou clubs repris de la fiche joueur, absents de la page de draft. */
  collegesFilled: number;
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
  let collegesFilled = 0;
  if (picks.length > 0) {
    const nameIndex = await loadPlayerNameIndex(supabase);
    const resolvedIds = picks
      .map((pick) => (pick.player_name ? nameIndex.get(normalizeName(pick.player_name)) : undefined))
      .filter((id): id is number => !!id);

    // Universités et clubs connus des fiches joueurs, pour compléter ce que la
    // page de draft ne dit pas des joueurs venus du professionnel.
    const [{ data: playerRows }, franchiseLabels] = await Promise.all([
      resolvedIds.length > 0
        ? supabase.from("players").select("player_id, college").in("player_id", resolvedIds)
        : Promise.resolve({ data: [] as { player_id: number; college: string | null }[] }),
      loadFranchiseLabels(supabase),
    ]);
    const collegeById = new Map((playerRows || []).map((row) => [row.player_id, row.college]));

    const rows = picks.map((pick) => {
      const playerId = pick.player_name ? nameIndex.get(normalizeName(pick.player_name)) : undefined;
      if (playerId) playersResolved++;
      const college = resolveCollege(
        pick.college,
        playerId ? collegeById.get(playerId) : null,
        franchiseLabels
      );
      if (!pick.college && college) collegesFilled++;
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
        college,
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

    if (collegesFilled > 0) {
      log(`${collegesFilled} université(s) ou club(s) repris des fiches joueurs`);
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
    collegesFilled,
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
