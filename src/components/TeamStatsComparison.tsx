"use client";

import { teamLogoUrl } from "@/lib/nba-teams";

interface BoxscorePlayer {
  team: string;
  is_home: boolean;
  pts: number;
  reb: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  [key: string]: unknown;
}

interface TeamStatsComparisonProps {
  awayTeam: string;
  homeTeam: string;
  awayPlayers: BoxscorePlayer[];
  homePlayers: BoxscorePlayer[];
}

interface StatRow {
  label: string;
  awayValue: number;
  homeValue: number;
  format: "int" | "pct";
  lowerIsBetter?: boolean;
}

function aggregate(players: BoxscorePlayer[]) {
  return players.reduce(
    (acc, p) => {
      acc.pts += p.pts || 0;
      acc.reb += p.reb || 0;
      acc.ast += p.ast || 0;
      acc.stl += p.stl || 0;
      acc.blk += p.blk || 0;
      acc.tov += p.tov || 0;
      acc.fgm += p.fgm || 0;
      acc.fga += p.fga || 0;
      acc.fg3m += p.fg3m || 0;
      acc.fg3a += p.fg3a || 0;
      acc.ftm += p.ftm || 0;
      acc.fta += p.fta || 0;
      acc.oreb += p.oreb || 0;
      acc.dreb += p.dreb || 0;
      return acc;
    },
    {
      pts: 0,
      reb: 0,
      ast: 0,
      stl: 0,
      blk: 0,
      tov: 0,
      fgm: 0,
      fga: 0,
      fg3m: 0,
      fg3a: 0,
      ftm: 0,
      fta: 0,
      oreb: 0,
      dreb: 0,
    },
  );
}

function formatValue(value: number, format: "int" | "pct"): string {
  if (format === "pct") return (value * 100).toFixed(1) + "%";
  return String(value);
}

// SVG constants
const SVG_WIDTH = 600;
const BAR_MAX_WIDTH = 200;
const CENTER_X = SVG_WIDTH / 2;
const ROW_HEIGHT = 34;
const BAR_HEIGHT = 12;
const HEADER_HEIGHT = 48;

function ComparisonBar({
  stat,
  index,
}: {
  stat: StatRow;
  index: number;
}) {
  const y = HEADER_HEIGHT + index * ROW_HEIGHT;
  const barY = y + 20;

  const maxVal = Math.max(stat.awayValue, stat.homeValue) || 1;
  const awayBarWidth = (stat.awayValue / maxVal) * BAR_MAX_WIDTH;
  const homeBarWidth = (stat.homeValue / maxVal) * BAR_MAX_WIDTH;

  const tied = stat.awayValue === stat.homeValue;
  const awayLeads = stat.lowerIsBetter
    ? stat.awayValue < stat.homeValue
    : stat.awayValue > stat.homeValue;
  const homeLeads = stat.lowerIsBetter
    ? stat.homeValue < stat.awayValue
    : stat.homeValue > stat.awayValue;

  const awayColor = awayLeads ? "#f97316" : tied ? "#6b7280" : "#6b7280";
  const homeColor = homeLeads ? "#3b82f6" : tied ? "#6b7280" : "#6b7280";
  const awayOpacity = awayLeads ? 0.9 : 0.4;
  const homeOpacity = homeLeads ? 0.9 : 0.4;

  return (
    <g>
      {/* Separator line */}
      {index > 0 && (
        <line
          x1={CENTER_X - BAR_MAX_WIDTH - 50}
          y1={y - 4}
          x2={CENTER_X + BAR_MAX_WIDTH + 50}
          y2={y - 4}
          stroke="var(--border)"
          strokeWidth={0.5}
          opacity={0.4}
        />
      )}

      {/* Stat label (center) */}
      <text
        x={CENTER_X}
        y={y + 12}
        textAnchor="middle"
        className="text-[11px] font-semibold"
        fill="var(--text-muted)"
      >
        {stat.label}
      </text>

      {/* Away bar (grows left from center) */}
      <rect
        x={CENTER_X - 40 - awayBarWidth}
        y={barY}
        width={awayBarWidth}
        height={BAR_HEIGHT}
        rx={4}
        fill={awayColor}
        opacity={awayOpacity}
      />

      {/* Away value */}
      <text
        x={CENTER_X - 40 - awayBarWidth - 8}
        y={barY + BAR_HEIGHT / 2 + 4}
        textAnchor="end"
        className="text-[12px] tabular-nums"
        fill={awayLeads ? "var(--text)" : "var(--text-muted)"}
        fontWeight={awayLeads ? 700 : 400}
      >
        {formatValue(stat.awayValue, stat.format)}
      </text>

      {/* Home bar (grows right from center) */}
      <rect
        x={CENTER_X + 40}
        y={barY}
        width={homeBarWidth}
        height={BAR_HEIGHT}
        rx={4}
        fill={homeColor}
        opacity={homeOpacity}
      />

      {/* Home value */}
      <text
        x={CENTER_X + 40 + homeBarWidth + 8}
        y={barY + BAR_HEIGHT / 2 + 4}
        textAnchor="start"
        className="text-[12px] tabular-nums"
        fill={homeLeads ? "var(--text)" : "var(--text-muted)"}
        fontWeight={homeLeads ? 700 : 400}
      >
        {formatValue(stat.homeValue, stat.format)}
      </text>
    </g>
  );
}

export default function TeamStatsComparison({
  awayTeam,
  homeTeam,
  awayPlayers,
  homePlayers,
}: TeamStatsComparisonProps) {
  const away = aggregate(awayPlayers);
  const home = aggregate(homePlayers);

  const awayFgPct = away.fga > 0 ? away.fgm / away.fga : 0;
  const homeFgPct = home.fga > 0 ? home.fgm / home.fga : 0;
  const awayFg3Pct = away.fg3a > 0 ? away.fg3m / away.fg3a : 0;
  const homeFg3Pct = home.fg3a > 0 ? home.fg3m / home.fg3a : 0;
  const awayFtPct = away.fta > 0 ? away.ftm / away.fta : 0;
  const homeFtPct = home.fta > 0 ? home.ftm / home.fta : 0;

  const stats: StatRow[] = [
    { label: "Points", awayValue: away.pts, homeValue: home.pts, format: "int" },
    { label: "Rebonds", awayValue: away.reb, homeValue: home.reb, format: "int" },
    { label: "Passes", awayValue: away.ast, homeValue: home.ast, format: "int" },
    { label: "Interceptions", awayValue: away.stl, homeValue: home.stl, format: "int" },
    { label: "Contres", awayValue: away.blk, homeValue: home.blk, format: "int" },
    { label: "Pertes de balle", awayValue: away.tov, homeValue: home.tov, format: "int", lowerIsBetter: true },
    { label: "FG%", awayValue: awayFgPct, homeValue: homeFgPct, format: "pct" },
    { label: "3P%", awayValue: awayFg3Pct, homeValue: homeFg3Pct, format: "pct" },
    { label: "FT%", awayValue: awayFtPct, homeValue: homeFtPct, format: "pct" },
  ];

  const svgHeight = HEADER_HEIGHT + stats.length * ROW_HEIGHT + 10;

  const awayLogo = teamLogoUrl(awayTeam);
  const homeLogo = teamLogoUrl(homeTeam);

  return (
    <div className="rounded-2xl bg-card border border-border-t p-4 sm:p-6">
      <h2 className="text-base font-bold text-text-primary mb-3">
        Comparaison par équipe
      </h2>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        className="w-full max-w-2xl mx-auto block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Team headers */}
        {/* Away team (left side) */}
        <image
          href={awayLogo}
          x={CENTER_X - BAR_MAX_WIDTH - 60}
          y={8}
          width={28}
          height={28}
        />
        <text
          x={CENTER_X - BAR_MAX_WIDTH - 26}
          y={28}
          textAnchor="start"
          className="text-[13px] font-bold"
          fill="var(--text)"
        >
          {awayTeam}
        </text>

        {/* Home team (right side) */}
        <image
          href={homeLogo}
          x={CENTER_X + BAR_MAX_WIDTH + 32}
          y={8}
          width={28}
          height={28}
        />
        <text
          x={CENTER_X + BAR_MAX_WIDTH + 26}
          y={28}
          textAnchor="end"
          className="text-[13px] font-bold"
          fill="var(--text)"
        >
          {homeTeam}
        </text>

        {/* Center divider */}
        <line
          x1={CENTER_X}
          y1={HEADER_HEIGHT - 8}
          x2={CENTER_X}
          y2={svgHeight - 10}
          stroke="var(--border)"
          strokeWidth={0.5}
          strokeDasharray="4,4"
          opacity={0.5}
        />

        {/* Stat rows */}
        {stats.map((stat, i) => (
          <ComparisonBar key={stat.label} stat={stat} index={i} />
        ))}
      </svg>
    </div>
  );
}
