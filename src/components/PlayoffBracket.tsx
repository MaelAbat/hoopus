"use client";

import { useState } from "react";
import Link from "next/link";
import { teamLogoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";
import PlayoffStatsPanel from "./PlayoffStatsPanel";

interface Standing {
  id: string;
  conference: string;
  team_tricode: string;
  team_name: string;
  team_city: string;
  wins: number;
  losses: number;
  win_pct: number;
  conference_rank: number;
}

interface SeriesGame {
  game_id?: string;
  game_number: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: number;
  game_date: string;
}

interface PlayoffSeries {
  id: string;
  season: string;
  round: number;
  conference: string | null;
  seed_top: number;
  seed_bottom: number;
  team_top: string;
  team_bottom: string;
  wins_top: number;
  wins_bottom: number;
  status: "upcoming" | "active" | "completed";
  games: SeriesGame[];
}

interface PlayInGame {
  id: string;
  season: string;
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

/* ─── Dimensions ─── */
const BOX_W = 170;
const CONN_W = 36;
const HALF_H = 310;
const TOTAL_H = HALF_H * 2;

/* ─── Team row inside a matchup box ─── */
function TeamRow({ tricode, seed, wins, isWinner, record }: {
  tricode: string | null;
  seed?: number;
  wins?: number;
  isWinner?: boolean;
  record?: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${isWinner ? "bg-accent-light" : ""}`}>
      <span className="tnum w-4 text-center text-[10px] font-bold text-text-faint">{seed ?? ""}</span>
      {tricode ? (
        <>
          <img src={teamLogoUrl(tricode)} alt={tricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className={`flex-1 text-xs font-bold uppercase tracking-wide ${isWinner ? "text-text-primary" : "text-text-secondary"}`}>{tricode}</span>
          {wins !== undefined ? (
            <span className={`tnum text-[11px] font-bold ${isWinner ? "text-accent-text" : "text-text-muted"}`}>
              {wins}
            </span>
          ) : record ? (
            <span className="tnum text-[10px] text-text-muted">{record}</span>
          ) : null}
        </>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">TBD</span>
      )}
    </div>
  );
}

/* ─── Games detail popover ─── */
function GamesPopover({ series, flipUp }: { series: PlayoffSeries; flipUp?: boolean }) {
  const finishedGames = series.games.filter(g => g.status === 3).sort((a, b) => a.game_number - b.game_number);
  if (finishedGames.length === 0) return null;

  return (
    <div
      className={`absolute z-50 left-1/2 -translate-x-1/2 w-48 border border-border-hover bg-card-hover shadow-2xl p-2 space-y-0.5 ${
        flipUp ? "bottom-full" : "top-full"
      }`}
    >
      <p className="kicker text-text-faint text-center mb-1">
        Détail de la série
      </p>
      {finishedGames.map((g) => {
        const awayWon = g.away_score > g.home_score;
        const homeWon = g.home_score > g.away_score;
        const row = (
          <div className="flex items-center gap-1.5 text-[10px] px-1 py-0.5">
            <span className="tnum text-text-faint w-5 shrink-0">G{g.game_number}</span>
            <span className={`flex-1 text-right ${awayWon ? "font-bold text-text-primary" : "text-text-muted"}`}>
              {g.away_team}
            </span>
            <span className={`tnum w-5 text-center ${awayWon ? "font-bold text-text-primary" : "text-text-muted"}`}>
              {g.away_score}
            </span>
            <span className="text-text-faint">-</span>
            <span className={`tnum w-5 text-center ${homeWon ? "font-bold text-text-primary" : "text-text-muted"}`}>
              {g.home_score}
            </span>
            <span className={`flex-1 ${homeWon ? "font-bold text-text-primary" : "text-text-muted"}`}>
              {g.home_team}
            </span>
          </div>
        );
        return g.game_id ? (
          <Link key={g.game_number} href={`/match/${g.game_id}`} className="block hover:bg-input/50 transition-colors">
            {row}
          </Link>
        ) : (
          <div key={g.game_number}>{row}</div>
        );
      })}
      {series.status !== "completed" && series.games.some(g => g.status === 1) && (
        <p className="font-mono text-[9px] uppercase tracking-wider text-text-muted text-center pt-1 mt-1 border-t border-rule">
          {series.games.filter(g => g.status === 1).length} match(s) à venir
        </p>
      )}
    </div>
  );
}

/* ─── Matchup box with optional series data ─── */
function MatchupBox({ series, topTeam, bottomTeam, seedTop, seedBottom, accent, animDelay = 0, flipPopover }: {
  series?: PlayoffSeries | null;
  topTeam?: Standing | null;
  bottomTeam?: Standing | null;
  seedTop?: number;
  seedBottom?: number;
  accent?: boolean;
  animDelay?: number;
  flipPopover?: boolean;
}) {
  const [showGames, setShowGames] = useState(false);
  const { isTeamFavorite } = useFavorites();

  // If we have series data, use it
  if (series) {
    const isCompleted = series.status === "completed";
    const topWinner = isCompleted && series.wins_top === 4;
    const bottomWinner = isCompleted && series.wins_bottom === 4;
    const hasGames = series.games && series.games.some(g => g.status === 3);
    const hasFav = isTeamFavorite(series.team_top) || isTeamFavorite(series.team_bottom);

    return (
      <div
        className={`relative overflow-visible shrink-0 transition-colors ${
          hasGames ? "cursor-pointer" : ""
        } ${
          showGames ? "z-50" : ""
        } ${
          hasFav
            ? "border border-accent bg-card"
            : accent
              ? "border border-accent bg-card"
              : "border border-rule bg-card hover:border-border-hover"
        }`}
        style={{ width: BOX_W, animation: `fadeSlideUp 0.4s ease-out ${animDelay}ms both` }}
        onMouseEnter={() => hasGames && setShowGames(true)}
        onMouseLeave={() => setShowGames(false)}
      >
        {(hasFav || accent) && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
        <div className="overflow-hidden">
          <TeamRow
            tricode={series.team_top}
            seed={series.seed_top}
            wins={series.wins_top}
            isWinner={topWinner}
          />
          <div className="h-px bg-rule" />
          <TeamRow
            tricode={series.team_bottom}
            seed={series.seed_bottom}
            wins={series.wins_bottom}
            isWinner={bottomWinner}
          />
        </div>
        {showGames && <GamesPopover series={series} flipUp={flipPopover} />}
      </div>
    );
  }

  // Fallback: use standings data (pre-playoff seeding)
  const fallbackFav =
    (topTeam?.team_tricode && isTeamFavorite(topTeam.team_tricode)) ||
    (bottomTeam?.team_tricode && isTeamFavorite(bottomTeam.team_tricode));

  return (
    <div
      className={`relative overflow-hidden shrink-0 transition-colors ${
        fallbackFav
          ? "border border-accent bg-card"
          : accent
            ? "border border-accent bg-card"
            : "border border-rule bg-card hover:border-border-hover"
      }`}
      style={{ width: BOX_W, animation: `fadeSlideUp 0.4s ease-out ${animDelay}ms both` }}
    >
      {(fallbackFav || accent) && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
      <TeamRow
        tricode={topTeam?.team_tricode || null}
        seed={seedTop}
        record={topTeam ? `${topTeam.wins}-${topTeam.losses}` : undefined}
      />
      <div className="h-px bg-rule" />
      <TeamRow
        tricode={bottomTeam?.team_tricode || null}
        seed={seedBottom}
        record={bottomTeam ? `${bottomTeam.wins}-${bottomTeam.losses}` : undefined}
      />
    </div>
  );
}

/* ─── Half-height column (one conference) ─── */
function HalfCol({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col ${count === 1 ? "justify-center" : "justify-around"}`}
      style={{ height: HALF_H }}
    >
      {children}
    </div>
  );
}

/* ─── SVG connector for intra-conference transitions ─── */
function DualConnector({ inputPerConf, outputPerConf, animDelay = 300 }: { inputPerConf: number; outputPerConf: number; animDelay?: number }) {
  const inSpace = HALF_H / inputPerConf;
  const outSpace = HALF_H / outputPerConf;
  const mid = CONN_W / 2;

  const paths: string[] = [];
  for (const offset of [0, HALF_H]) {
    for (let o = 0; o < outputPerConf; o++) {
      const outY = offset + outSpace * o + outSpace / 2;
      const inY1 = offset + inSpace * (o * 2) + inSpace / 2;
      const inY2 = offset + inSpace * (o * 2 + 1) + inSpace / 2;
      paths.push(`M 0 ${inY1} H ${mid} V ${outY} H ${CONN_W}`);
      paths.push(`M 0 ${inY2} H ${mid} V ${outY} H ${CONN_W}`);
    }
  }

  return (
    <svg width={CONN_W} height={TOTAL_H} className="shrink-0">
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--rule)" strokeWidth="1.5"
          strokeDasharray="1000" strokeDashoffset="1000"
          style={{ animation: `drawLine 0.8s ease-out ${animDelay}ms both` }} />
      ))}
    </svg>
  );
}

/* ─── SVG connector: 2 conf finals → 1 NBA finals ─── */
function FinalsConnector({ animDelay = 700 }: { animDelay?: number }) {
  const eastY = HALF_H / 2;
  const westY = HALF_H + HALF_H / 2;
  const finalsY = TOTAL_H / 2;
  const mid = CONN_W / 2;

  return (
    <svg width={CONN_W} height={TOTAL_H} className="shrink-0">
      <path d={`M 0 ${eastY} H ${mid} V ${finalsY} H ${CONN_W}`} fill="none" stroke="var(--rule)" strokeWidth="1.5"
        strokeDasharray="1000" strokeDashoffset="1000"
        style={{ animation: `drawLine 0.8s ease-out ${animDelay}ms both` }} />
      <path d={`M 0 ${westY} H ${mid} V ${finalsY} H ${CONN_W}`} fill="none" stroke="var(--rule)" strokeWidth="1.5"
        strokeDasharray="1000" strokeDashoffset="1000"
        style={{ animation: `drawLine 0.8s ease-out ${animDelay}ms both` }} />
    </svg>
  );
}

/* ─── Helper: find series for a given round, conference, and matchup position ─── */
function findSeries(
  allSeries: PlayoffSeries[],
  round: number,
  conference: string | null,
  expectedSeeds?: [number, number]
): PlayoffSeries | null {
  return allSeries.find(s => {
    if (s.round !== round) return false;
    if (conference && s.conference !== conference) return false;
    if (!conference && s.conference !== null) return false;
    if (expectedSeeds) {
      const seeds = [s.seed_top, s.seed_bottom].sort((a, b) => a - b);
      const expected = [...expectedSeeds].sort((a, b) => a - b);
      return seeds[0] === expected[0] && seeds[1] === expected[1];
    }
    return true;
  }) || null;
}

/* ─── Find series by teams involved (for later rounds) ─── */
function findSeriesByConference(
  allSeries: PlayoffSeries[],
  round: number,
  conference: string | null,
  index: number
): PlayoffSeries | null {
  const matches = allSeries.filter(s => {
    if (s.round !== round) return false;
    if (conference !== null && s.conference !== conference) return false;
    if (conference === null && s.conference !== null) return false;
    return true;
  });
  // Sort by seed_top to have consistent ordering
  matches.sort((a, b) => a.seed_top - b.seed_top);
  return matches[index] || null;
}

/* ─── Full unified playoff bracket ─── */
function FullBracket({ east, west, series }: { east: Standing[]; west: Standing[]; series: PlayoffSeries[] }) {
  const byRank = (teams: Standing[], rank: number) => teams.find(t => t.conference_rank === rank) || null;

  const makeR1 = (teams: Standing[], conf: string) => {
    // Matchup order: 1v8, 4v5, 3v6, 2v7
    // Seeds 7 and 8 come from Play-In — only show them if actual series data exists
    const matchups: [number, number][] = [[1, 8], [4, 5], [3, 6], [2, 7]];
    return matchups.map(([seedA, seedB]) => {
      const s = findSeries(series, 1, conf, [seedA, seedB]);
      const isPlayInSeed = (seed: number) => seed === 7 || seed === 8;
      return {
        series: s,
        topTeam: isPlayInSeed(seedA) && !s ? null : byRank(teams, seedA),
        bottomTeam: isPlayInSeed(seedB) && !s ? null : byRank(teams, seedB),
        seedTop: seedA,
        seedBottom: seedB,
      };
    });
  };

  const eastR1 = makeR1(east, "East");
  const westR1 = makeR1(west, "West");

  // Semis (round 2): 2 per conference
  const eastSemi0 = findSeriesByConference(series, 2, "East", 0);
  const eastSemi1 = findSeriesByConference(series, 2, "East", 1);
  const westSemi0 = findSeriesByConference(series, 2, "West", 0);
  const westSemi1 = findSeriesByConference(series, 2, "West", 1);

  // Conf Finals (round 3): 1 per conference
  const eastCF = findSeriesByConference(series, 3, "East", 0);
  const westCF = findSeriesByConference(series, 3, "West", 0);

  // NBA Finals (round 4)
  const finals = findSeriesByConference(series, 4, null, 0);

  const roundLabels = ["1er tour", "Demi-finales", "Finale conf.", "Finales NBA"];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex flex-col items-center min-w-max">
        {/* ── Round labels ── */}
        <div className="flex items-end mb-3">
          <div className="shrink-0" style={{ width: 28 }} />
          {roundLabels.map((label, i) => (
            <div key={i} className="flex items-center shrink-0">
              {i > 0 && <div style={{ width: CONN_W }} className="shrink-0" />}
              <span
                className="kicker text-accent-text text-center shrink-0"
                style={{ width: BOX_W }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── Bracket body ── */}
        <div className="relative flex items-stretch min-w-max">
          {/* Dashed separator between conferences */}
          <div
            className="absolute left-0 right-0 border-t border-dashed border-rule"
            style={{ top: HALF_H }}
          />

          {/* Conference labels (vertical text) */}
          <div className="shrink-0 flex flex-col" style={{ width: 28, height: TOTAL_H }}>
            <div className="flex-1 flex items-center justify-center">
              <span className="kicker text-text-faint [writing-mode:vertical-lr] rotate-180">
                Est
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="kicker text-text-faint [writing-mode:vertical-lr] rotate-180">
                Ouest
              </span>
            </div>
          </div>

          {/* R1: 4 matchups per conference — last in each half flips popover up to avoid page overflow */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={4}>
              {eastR1.map((m, i) => (
                <MatchupBox key={i} series={m.series} topTeam={m.topTeam} bottomTeam={m.bottomTeam} seedTop={m.seedTop} seedBottom={m.seedBottom} animDelay={i * 80} flipPopover={i === eastR1.length - 1} />
              ))}
            </HalfCol>
            <HalfCol count={4}>
              {westR1.map((m, i) => (
                <MatchupBox key={i} series={m.series} topTeam={m.topTeam} bottomTeam={m.bottomTeam} seedTop={m.seedTop} seedBottom={m.seedBottom} animDelay={i * 80} flipPopover={i === westR1.length - 1} />
              ))}
            </HalfCol>
          </div>

          {/* Connector R1 → Semis */}
          <DualConnector inputPerConf={4} outputPerConf={2} animDelay={300} />

          {/* Semis: 2 matchups per conference */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={2}>
              <MatchupBox series={eastSemi0} animDelay={400} />
              <MatchupBox series={eastSemi1} animDelay={480} flipPopover />
            </HalfCol>
            <HalfCol count={2}>
              <MatchupBox series={westSemi0} animDelay={400} />
              <MatchupBox series={westSemi1} animDelay={480} flipPopover />
            </HalfCol>
          </div>

          {/* Connector Semis → CF */}
          <DualConnector inputPerConf={2} outputPerConf={1} animDelay={550} />

          {/* Conference Finals: 1 per conference */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={1}>
              <MatchupBox series={eastCF} animDelay={600} />
            </HalfCol>
            <HalfCol count={1}>
              <MatchupBox series={westCF} animDelay={600} flipPopover />
            </HalfCol>
          </div>

          {/* Connector CF → Finals */}
          <FinalsConnector animDelay={700} />

          {/* NBA Finals */}
          <div className="shrink-0 flex flex-col justify-center" style={{ width: BOX_W, height: TOTAL_H }}>
            <MatchupBox series={finals} accent animDelay={800} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Play-In matchup box (single game, not a series) ─── */
function PlayInMatchupBox({ game, topTeam, bottomTeam, seedTop, seedBottom, animDelay = 0 }: {
  game?: PlayInGame | null;
  topTeam?: Standing | null;
  bottomTeam?: Standing | null;
  seedTop?: number;
  seedBottom?: number;
  animDelay?: number;
}) {
  const { isTeamFavorite } = useFavorites();

  if (game) {
    const finished = game.status === 3;
    const homeSeed = game.home_seed;
    const awaySeed = game.away_seed;
    // Show higher seed on top
    const topIsHome = homeSeed <= awaySeed;
    const topTricode = topIsHome ? game.home_team : game.away_team;
    const bottomTricode = topIsHome ? game.away_team : game.home_team;
    const topScore = topIsHome ? game.home_score : game.away_score;
    const bottomScore = topIsHome ? game.away_score : game.home_score;
    const topSeed = topIsHome ? game.home_seed : game.away_seed;
    const bottomSeed = topIsHome ? game.away_seed : game.home_seed;
    const topWon = finished && game.winner === topTricode;
    const bottomWon = finished && game.winner === bottomTricode;
    const hasFav = isTeamFavorite(topTricode) || isTeamFavorite(bottomTricode);

    return (
      <div
        className={`relative overflow-hidden shrink-0 transition-colors ${
          hasFav
            ? "border border-accent bg-card"
            : "border border-rule bg-card hover:border-border-hover"
        }`}
        style={{ width: BOX_W, animation: `fadeSlideUp 0.4s ease-out ${animDelay}ms both` }}
      >
        {hasFav && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
        <div className={`flex items-center gap-2 px-2.5 py-1.5 ${topWon ? "bg-accent-light" : ""}`}>
          <span className="tnum w-4 text-center text-[10px] font-bold text-text-faint">{topSeed}</span>
          <img src={teamLogoUrl(topTricode)} alt={topTricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className={`flex-1 text-xs font-bold uppercase tracking-wide ${topWon ? "text-text-primary" : "text-text-secondary"}`}>{topTricode}</span>
          {finished && (
            <span className={`tnum text-[11px] font-bold ${topWon ? "text-accent-text" : "text-text-faint"}`}>{topScore}</span>
          )}
        </div>
        <div className="h-px bg-rule" />
        <div className={`flex items-center gap-2 px-2.5 py-1.5 ${bottomWon ? "bg-accent-light" : ""}`}>
          <span className="tnum w-4 text-center text-[10px] font-bold text-text-faint">{bottomSeed}</span>
          <img src={teamLogoUrl(bottomTricode)} alt={bottomTricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className={`flex-1 text-xs font-bold uppercase tracking-wide ${bottomWon ? "text-text-primary" : "text-text-secondary"}`}>{bottomTricode}</span>
          {finished && (
            <span className={`tnum text-[11px] font-bold ${bottomWon ? "text-accent-text" : "text-text-faint"}`}>{bottomScore}</span>
          )}
        </div>
      </div>
    );
  }

  // Fallback: use standings data
  return <MatchupBox topTeam={topTeam} bottomTeam={bottomTeam} seedTop={seedTop} seedBottom={seedBottom} animDelay={animDelay} />;
}

/* ─── Play-In: single conference ─── */
function PlayInConference({ teams, label, games }: { teams: Standing[]; label: string; games: PlayInGame[] }) {
  const byRank = (rank: number) => teams.find(t => t.conference_rank === rank) || null;
  const byTricode = (tricode: string) => teams.find(t => t.team_tricode === tricode) || null;
  const H = 180;

  const game78 = games.find(g => g.matchup_type === "seven_eight") || null;
  const game910 = games.find(g => g.matchup_type === "nine_ten") || null;
  const gameFinal = games.find(g => g.matchup_type === "final") || null;

  // Derive known teams for the final from earlier results
  let finalTopTeam: Standing | null = null;
  let finalBottomTeam: Standing | null = null;
  let finalSeedTop: number | undefined;
  let finalSeedBottom: number | undefined;
  if (!gameFinal) {
    // Loser of 7v8 → plays in the final
    if (game78?.winner) {
      const loserTricode = game78.winner === game78.home_team ? game78.away_team : game78.home_team;
      const loserSeed = game78.winner === game78.home_team ? game78.away_seed : game78.home_seed;
      finalTopTeam = byTricode(loserTricode);
      finalSeedTop = loserSeed;
    }
    // Winner of 9v10 → plays in the final
    if (game910?.winner) {
      const winnerSeed = game910.winner === game910.home_team ? game910.home_seed : game910.away_seed;
      finalBottomTeam = byTricode(game910.winner);
      finalSeedBottom = winnerSeed;
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-text-primary text-center">{label}</h3>
      <div className="flex items-center justify-center overflow-x-auto">
        <div className="shrink-0 flex flex-col items-center">
          <span className="kicker text-accent-text mb-2">Tour 1</span>
          <div className="flex flex-col justify-around" style={{ height: H }}>
            <div className="text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-text-faint mb-1">Vainqueur → 7e seed</p>
              <PlayInMatchupBox game={game78} topTeam={byRank(7)} bottomTeam={byRank(8)} seedTop={7} seedBottom={8} animDelay={0} />
            </div>
            <div className="text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-text-faint mb-1">Perdant éliminé</p>
              <PlayInMatchupBox game={game910} topTeam={byRank(9)} bottomTeam={byRank(10)} seedTop={9} seedBottom={10} animDelay={100} />
            </div>
          </div>
        </div>

        <svg width={CONN_W} height={H} className="shrink-0">
          {(() => {
            const inY1 = H / 4;
            const inY2 = (3 * H) / 4;
            const outY = H / 2;
            const mid = CONN_W / 2;
            return (
              <>
                <path d={`M 0 ${inY1} H ${mid} V ${outY} H ${CONN_W}`} fill="none" stroke="var(--rule)" strokeWidth="1.5"
                  strokeDasharray="1000" strokeDashoffset="1000"
                  style={{ animation: 'drawLine 0.8s ease-out 200ms both' }} />
                <path d={`M 0 ${inY2} H ${mid} V ${outY} H ${CONN_W}`} fill="none" stroke="var(--rule)" strokeWidth="1.5"
                  strokeDasharray="1000" strokeDashoffset="1000"
                  style={{ animation: 'drawLine 0.8s ease-out 200ms both' }} />
              </>
            );
          })()}
        </svg>

        <div className="shrink-0 flex flex-col items-center">
          <span className="kicker text-accent-text mb-2">8e place</span>
          <div className="flex flex-col justify-center" style={{ height: H }}>
            <div className="text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-text-faint mb-1">Perdant 7-8 vs Vainqueur 9-10</p>
              <PlayInMatchupBox game={gameFinal} topTeam={finalTopTeam} bottomTeam={finalBottomTeam} seedTop={finalSeedTop} seedBottom={finalSeedBottom} animDelay={300} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
interface PlayoffLeaderRow {
  category: string;
  rank: number;
  player_name: string;
  player_id: number;
  team: string;
  value: number;
}

interface PlayoffTeamStat {
  team_id: number;
  team_name: string;
  team_tricode: string;
  gp: number;
  w: number;
  l: number;
  pts: number;
  reb: number;
  ast: number;
  off_rating: number;
  def_rating: number;
  net_rating: number;
  ts_pct: number;
}

export default function PlayoffBracket({
  east,
  west,
  series,
  playinGames,
  playoffLeaders = [],
  playoffTeamStats = [],
}: {
  east: Standing[];
  west: Standing[];
  series: PlayoffSeries[];
  playinGames: PlayInGame[];
  playoffLeaders?: PlayoffLeaderRow[];
  playoffTeamStats?: PlayoffTeamStat[];
}) {
  const [view, setView] = useState<"playin" | "playoffs" | "stats">("playoffs");

  const views: { key: "playin" | "playoffs" | "stats"; label: string }[] = [
    { key: "playoffs", label: "Playoffs" },
    { key: "playin", label: "Play-In" },
    { key: "stats", label: "Statistiques" },
  ];

  const hasData = east.length > 0 && west.length > 0;

  return (
    <div className="space-y-6">
      {/* Toggle — only show if Play-In exists */}
      {views.length > 1 && (
        <div className="flex gap-2">
          {views.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest transition-colors ${
                view === key
                  ? "bg-accent text-white"
                  : "border border-rule text-text-muted hover:bg-input hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!hasData ? (
        <div className="border border-rule bg-card px-6 py-12 text-center text-sm text-text-muted">
          Aucune donnée disponible — synchronisez les classements d&apos;abord.
        </div>
      ) : view === "playin" ? (
        <div className="space-y-6">
          <div className="border border-rule bg-card p-3 sm:p-6 overflow-x-auto">
            <PlayInConference teams={east} label="Play-In — Conférence Est" games={playinGames.filter(g => g.conference === "East")} />
          </div>
          <div className="border border-rule bg-card p-3 sm:p-6 overflow-x-auto">
            <PlayInConference teams={west} label="Play-In — Conférence Ouest" games={playinGames.filter(g => g.conference === "West")} />
          </div>
          <div className="border border-rule bg-card p-4 space-y-2">
            <p className="kicker text-text-faint">Comment fonctionne le Play-In ?</p>
            <ul className="text-xs text-text-muted space-y-1 list-disc pl-4">
              <li>Le <strong className="text-text-primary">7e</strong> affronte le <strong className="text-text-primary">8e</strong> — le vainqueur obtient la <strong className="text-text-primary">7e place</strong></li>
              <li>Le <strong className="text-text-primary">9e</strong> affronte le <strong className="text-text-primary">10e</strong> — le perdant est <strong className="text-text-primary">éliminé</strong></li>
              <li>Perdant du 7-8 vs vainqueur du 9-10 → <strong className="text-text-primary">8e place</strong></li>
            </ul>
          </div>
        </div>
      ) : view === "stats" ? (
        <PlayoffStatsPanel leaders={playoffLeaders} teamStats={playoffTeamStats} />
      ) : (
        <div className="border border-rule bg-card p-3 sm:p-6">
          <FullBracket east={east} west={west} series={series} />
        </div>
      )}
    </div>
  );
}
