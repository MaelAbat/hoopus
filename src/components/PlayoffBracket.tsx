"use client";

import { useState } from "react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { useFavorites } from "@/context/FavoritesContext";

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
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${isWinner ? "bg-accent/5" : ""}`}>
      <span className="w-4 text-center text-[10px] font-bold text-text-faint">{seed ?? ""}</span>
      {tricode ? (
        <>
          <img src={teamLogoUrl(tricode)} alt={tricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className={`text-xs font-semibold flex-1 ${isWinner ? "text-accent" : "text-text-primary"}`}>{tricode}</span>
          {wins !== undefined ? (
            <span className={`text-[10px] font-bold tabular-nums ${isWinner ? "text-accent" : "text-text-muted"}`}>
              {wins}
            </span>
          ) : record ? (
            <span className="text-[10px] tabular-nums text-text-muted">{record}</span>
          ) : null}
        </>
      ) : (
        <span className="text-[10px] text-text-faint italic">TBD</span>
      )}
    </div>
  );
}

/* ─── Games detail popover ─── */
function GamesPopover({ series }: { series: PlayoffSeries }) {
  const finishedGames = series.games.filter(g => g.status === 3).sort((a, b) => a.game_number - b.game_number);
  if (finishedGames.length === 0) return null;

  return (
    <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1.5 w-48 rounded-lg border border-border-t bg-card shadow-xl p-2 space-y-1">
      <p className="text-[9px] font-semibold text-text-muted uppercase tracking-wider text-center mb-1">
        Détail de la série
      </p>
      {finishedGames.map((g) => {
        const awayWon = g.away_score > g.home_score;
        const homeWon = g.home_score > g.away_score;
        return (
          <div key={g.game_number} className="flex items-center gap-1.5 text-[10px]">
            <span className="text-text-faint w-5 shrink-0">G{g.game_number}</span>
            <span className={`flex-1 text-right ${awayWon ? "font-semibold text-text-primary" : "text-text-faint"}`}>
              {g.away_team}
            </span>
            <span className={`w-5 text-center tabular-nums ${awayWon ? "font-bold text-text-primary" : "text-text-faint"}`}>
              {g.away_score}
            </span>
            <span className="text-text-faint">-</span>
            <span className={`w-5 text-center tabular-nums ${homeWon ? "font-bold text-text-primary" : "text-text-faint"}`}>
              {g.home_score}
            </span>
            <span className={`flex-1 ${homeWon ? "font-semibold text-text-primary" : "text-text-faint"}`}>
              {g.home_team}
            </span>
          </div>
        );
      })}
      {series.games.some(g => g.status === 1) && (
        <p className="text-[9px] text-text-faint text-center pt-1 border-t border-border-t">
          {series.games.filter(g => g.status === 1).length} match(s) à venir
        </p>
      )}
    </div>
  );
}

/* ─── Matchup box with optional series data ─── */
function MatchupBox({ series, topTeam, bottomTeam, seedTop, seedBottom, accent, animDelay = 0 }: {
  series?: PlayoffSeries | null;
  topTeam?: Standing | null;
  bottomTeam?: Standing | null;
  seedTop?: number;
  seedBottom?: number;
  accent?: boolean;
  animDelay?: number;
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
        className={`relative rounded-lg overflow-visible shadow-sm shrink-0 ${
          hasGames ? "cursor-pointer" : ""
        } ${
          hasFav
            ? "border-2 border-accent/60 bg-card ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]"
            : accent
              ? "border-2 border-accent/40 bg-card"
              : isCompleted
                ? "border border-border-t/60 bg-card/80"
                : "border border-border-t bg-card"
        }`}
        style={{ width: BOX_W, animation: `fadeSlideUp 0.4s ease-out ${animDelay}ms both` }}
        onMouseEnter={() => hasGames && setShowGames(true)}
        onMouseLeave={() => setShowGames(false)}
      >
        <div className="rounded-lg overflow-hidden">
          <TeamRow
            tricode={series.team_top}
            seed={series.seed_top}
            wins={series.wins_top}
            isWinner={topWinner}
          />
          <div className={`h-px ${accent ? "bg-accent/30" : "bg-border-t"}`} />
          <TeamRow
            tricode={series.team_bottom}
            seed={series.seed_bottom}
            wins={series.wins_bottom}
            isWinner={bottomWinner}
          />
        </div>
        {showGames && <GamesPopover series={series} />}
      </div>
    );
  }

  // Fallback: use standings data (pre-playoff seeding)
  const fallbackFav =
    (topTeam?.team_tricode && isTeamFavorite(topTeam.team_tricode)) ||
    (bottomTeam?.team_tricode && isTeamFavorite(bottomTeam.team_tricode));

  return (
    <div
      className={`rounded-lg overflow-hidden shadow-sm shrink-0 ${
        fallbackFav
          ? "border-2 border-accent/60 bg-card ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]"
          : accent
            ? "border-2 border-accent/40 bg-card"
            : "border border-border-t bg-card"
      }`}
      style={{ width: BOX_W, animation: `fadeSlideUp 0.4s ease-out ${animDelay}ms both` }}
    >
      <TeamRow
        tricode={topTeam?.team_tricode || null}
        seed={seedTop}
        record={topTeam ? `${topTeam.wins}-${topTeam.losses}` : undefined}
      />
      <div className={`h-px ${fallbackFav ? "bg-accent/30" : accent ? "bg-accent/30" : "bg-border-t"}`} />
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
        <path key={i} d={d} fill="none" stroke="var(--border-t)" strokeWidth="1.5"
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
      <path d={`M 0 ${eastY} H ${mid} V ${finalsY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5"
        strokeDasharray="1000" strokeDashoffset="1000"
        style={{ animation: `drawLine 0.8s ease-out ${animDelay}ms both` }} />
      <path d={`M 0 ${westY} H ${mid} V ${finalsY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5"
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
                className="text-[10px] font-semibold uppercase tracking-wider text-accent text-center shrink-0"
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
            className="absolute left-0 right-0 border-t border-dashed border-accent/20"
            style={{ top: HALF_H }}
          />

          {/* Conference labels (vertical text) */}
          <div className="shrink-0 flex flex-col" style={{ width: 28, height: TOTAL_H }}>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                Est
              </span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                Ouest
              </span>
            </div>
          </div>

          {/* R1: 4 matchups per conference */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={4}>
              {eastR1.map((m, i) => (
                <MatchupBox key={i} series={m.series} topTeam={m.topTeam} bottomTeam={m.bottomTeam} seedTop={m.seedTop} seedBottom={m.seedBottom} animDelay={i * 80} />
              ))}
            </HalfCol>
            <HalfCol count={4}>
              {westR1.map((m, i) => (
                <MatchupBox key={i} series={m.series} topTeam={m.topTeam} bottomTeam={m.bottomTeam} seedTop={m.seedTop} seedBottom={m.seedBottom} animDelay={i * 80} />
              ))}
            </HalfCol>
          </div>

          {/* Connector R1 → Semis */}
          <DualConnector inputPerConf={4} outputPerConf={2} animDelay={300} />

          {/* Semis: 2 matchups per conference */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={2}>
              <MatchupBox series={eastSemi0} animDelay={400} />
              <MatchupBox series={eastSemi1} animDelay={480} />
            </HalfCol>
            <HalfCol count={2}>
              <MatchupBox series={westSemi0} animDelay={400} />
              <MatchupBox series={westSemi1} animDelay={480} />
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
              <MatchupBox series={westCF} animDelay={600} />
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
        className={`rounded-lg overflow-hidden shadow-sm shrink-0 ${
          hasFav
            ? "border-2 border-accent/60 bg-card ring-2 ring-accent/20 shadow-[0_0_12px_rgba(var(--accent-rgb,249,115,22),0.15)]"
            : finished ? "border border-border-t/60 bg-card/80" : "border border-border-t bg-card"
        }`}
        style={{ width: BOX_W, animation: `fadeSlideUp 0.4s ease-out ${animDelay}ms both` }}
      >
        <div className={`flex items-center gap-2 px-2.5 py-1.5 ${topWon ? "bg-accent/5" : ""}`}>
          <span className="w-4 text-center text-[10px] font-bold text-text-faint">{topSeed}</span>
          <img src={teamLogoUrl(topTricode)} alt={topTricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className={`text-xs font-semibold flex-1 ${topWon ? "text-accent" : "text-text-primary"}`}>{topTricode}</span>
          {finished && (
            <span className={`text-[10px] font-bold tabular-nums ${topWon ? "text-accent" : "text-text-faint"}`}>{topScore}</span>
          )}
        </div>
        <div className="h-px bg-border-t" />
        <div className={`flex items-center gap-2 px-2.5 py-1.5 ${bottomWon ? "bg-accent/5" : ""}`}>
          <span className="w-4 text-center text-[10px] font-bold text-text-faint">{bottomSeed}</span>
          <img src={teamLogoUrl(bottomTricode)} alt={bottomTricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className={`text-xs font-semibold flex-1 ${bottomWon ? "text-accent" : "text-text-primary"}`}>{bottomTricode}</span>
          {finished && (
            <span className={`text-[10px] font-bold tabular-nums ${bottomWon ? "text-accent" : "text-text-faint"}`}>{bottomScore}</span>
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
      <h3 className="text-sm font-bold text-text-primary text-center">{label}</h3>
      <div className="flex items-center justify-center overflow-x-auto">
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-2">Tour 1</span>
          <div className="flex flex-col justify-around" style={{ height: H }}>
            <div className="text-center">
              <p className="text-[9px] text-text-faint mb-1">Vainqueur → 7e seed</p>
              <PlayInMatchupBox game={game78} topTeam={byRank(7)} bottomTeam={byRank(8)} seedTop={7} seedBottom={8} animDelay={0} />
            </div>
            <div className="text-center">
              <p className="text-[9px] text-text-faint mb-1">Perdant éliminé</p>
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
                <path d={`M 0 ${inY1} H ${mid} V ${outY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5"
                  strokeDasharray="1000" strokeDashoffset="1000"
                  style={{ animation: 'drawLine 0.8s ease-out 200ms both' }} />
                <path d={`M 0 ${inY2} H ${mid} V ${outY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5"
                  strokeDasharray="1000" strokeDashoffset="1000"
                  style={{ animation: 'drawLine 0.8s ease-out 200ms both' }} />
              </>
            );
          })()}
        </svg>

        <div className="shrink-0 flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-2">8e place</span>
          <div className="flex flex-col justify-center" style={{ height: H }}>
            <div className="text-center">
              <p className="text-[9px] text-text-faint mb-1">Perdant 7-8 vs Vainqueur 9-10</p>
              <PlayInMatchupBox game={gameFinal} topTeam={finalTopTeam} bottomTeam={finalBottomTeam} seedTop={finalSeedTop} seedBottom={finalSeedBottom} animDelay={300} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function PlayoffBracket({ east, west, series, playinGames }: { east: Standing[]; west: Standing[]; series: PlayoffSeries[]; playinGames: PlayInGame[] }) {
  const [view, setView] = useState<"playin" | "playoffs">("playoffs");

  const views: { key: "playin" | "playoffs"; label: string }[] = [
    { key: "playoffs", label: "Playoffs" },
    { key: "playin", label: "Play-In" },
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
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                view === key
                  ? "bg-accent text-white"
                  : "bg-input text-text-muted hover:bg-card-hover hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!hasData ? (
        <div className="rounded-2xl bg-card border border-border-t px-6 py-12 text-center text-sm text-text-muted">
          Aucune donnée disponible — synchronisez les classements d&apos;abord.
        </div>
      ) : view === "playin" ? (
        <div className="space-y-6">
          <div className="rounded-2xl bg-card border border-border-t p-3 sm:p-6 overflow-x-auto">
            <PlayInConference teams={east} label="Play-In — Conférence Est" games={playinGames.filter(g => g.conference === "East")} />
          </div>
          <div className="rounded-2xl bg-card border border-border-t p-3 sm:p-6 overflow-x-auto">
            <PlayInConference teams={west} label="Play-In — Conférence Ouest" games={playinGames.filter(g => g.conference === "West")} />
          </div>
          <div className="rounded-xl border border-border-t bg-card/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-text-secondary">Comment fonctionne le Play-In ?</p>
            <ul className="text-xs text-text-muted space-y-1 list-disc pl-4">
              <li>Le <strong>7e</strong> affronte le <strong>8e</strong> — le vainqueur obtient la <strong>7e place</strong></li>
              <li>Le <strong>9e</strong> affronte le <strong>10e</strong> — le perdant est <strong>éliminé</strong></li>
              <li>Perdant du 7-8 vs vainqueur du 9-10 → <strong>8e place</strong></li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border-t p-3 sm:p-6">
          <FullBracket east={east} west={west} series={series} />
        </div>
      )}
    </div>
  );
}
