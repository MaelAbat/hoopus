"use client";

import { useState, useRef, useCallback } from "react";

interface SeasonStats {
  season: string;
  team: string;
  gp: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  fg3Pct: number;
  min: number;
}

interface CareerChartProps {
  seasons: SeasonStats[];
}

interface StatConfig {
  key: keyof SeasonStats;
  label: string;
  format: (v: number) => string;
}

const STATS: StatConfig[] = [
  { key: "pts", label: "PTS", format: (v) => v.toFixed(1) },
  { key: "reb", label: "REB", format: (v) => v.toFixed(1) },
  { key: "ast", label: "AST", format: (v) => v.toFixed(1) },
  { key: "stl", label: "STL", format: (v) => v.toFixed(1) },
  { key: "blk", label: "BLK", format: (v) => v.toFixed(1) },
  { key: "fgPct", label: "FG%", format: (v) => (v * 100).toFixed(1) + "%" },
  { key: "min", label: "MIN", format: (v) => v.toFixed(1) },
];

const MAX_SELECTED = 3;

// Single-accent palette: the primary series is the theme accent, additional
// series step down into neutral text tones so up to 3 lines stay distinguishable
// without resorting to a decorative rainbow. Colors come from the theme tokens.
const SERIES_COLORS = ["var(--accent)", "var(--text-secondary)", "var(--text-faint)"];
function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

// Chart layout constants
const CHART_PADDING_LEFT = 50;
const CHART_PADDING_RIGHT = 20;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 50;
const GRID_LINES = 5;

function shortenSeason(season: string): string {
  // "2020-21" -> "20-21"
  if (season.length === 7 && season[4] === "-") {
    return season.slice(2);
  }
  return season;
}

function getStatValue(s: SeasonStats, key: keyof SeasonStats): number {
  const val = s[key];
  if (typeof val === "number") return val;
  return 0;
}

function getDisplayValue(s: SeasonStats, stat: StatConfig): number {
  const raw = getStatValue(s, stat.key);
  // For percentage stats, display as 0-100 scale in the chart
  if (stat.key === "fgPct" || stat.key === "fg3Pct") {
    return raw * 100;
  }
  return raw;
}

export default function CareerChart({ seasons }: CareerChartProps) {
  const [selected, setSelected] = useState<string[]>(["pts"]);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    season: string;
    values: { label: string; value: string; color: string }[];
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const toggleStat = useCallback(
    (key: string) => {
      setSelected((prev) => {
        if (prev.includes(key)) {
          // Don't allow deselecting the last stat
          if (prev.length === 1) return prev;
          return prev.filter((k) => k !== key);
        }
        if (prev.length >= MAX_SELECTED) {
          // Replace the first selected stat
          return [...prev.slice(1), key];
        }
        return [...prev, key];
      });
    },
    [],
  );

  if (seasons.length === 0) return null;

  // Filter out "TOT" rows for the chart
  const chartSeasons = seasons.filter((s) => s.team !== "TOT");

  if (chartSeasons.length === 0) return null;

  const selectedStats = STATS.filter((s) => selected.includes(s.key));

  const isSingleSeason = chartSeasons.length === 1;

  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = 280;
  const plotLeft = CHART_PADDING_LEFT;
  const plotRight = chartWidth - CHART_PADDING_RIGHT;
  const plotBottom = chartHeight - CHART_PADDING_BOTTOM;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - CHART_PADDING_TOP;

  // Calculate Y range across all selected stats
  let yMax = 0;
  for (const stat of selectedStats) {
    for (const s of chartSeasons) {
      const val = getDisplayValue(s, stat);
      if (val > yMax) yMax = val;
    }
  }
  // Add 10% padding to max
  yMax = yMax * 1.1 || 10;

  // Generate grid line values
  const gridStep = yMax / GRID_LINES;
  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, i) => i * gridStep);

  // Map data to chart coordinates
  const xStep = isSingleSeason ? plotWidth : plotWidth / (chartSeasons.length - 1);

  function getX(index: number): number {
    if (isSingleSeason) return plotLeft + plotWidth / 2;
    return plotLeft + index * xStep;
  }

  function getY(value: number): number {
    if (yMax === 0) return plotBottom;
    return plotBottom - (value / yMax) * plotHeight;
  }

  // Build line paths and area paths
  function buildLinePath(stat: StatConfig): string {
    return chartSeasons
      .map((s, i) => {
        const x = getX(i);
        const y = getY(getDisplayValue(s, stat));
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  function buildAreaPath(stat: StatConfig): string {
    const line = chartSeasons
      .map((s, i) => {
        const x = getX(i);
        const y = getY(getDisplayValue(s, stat));
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    const lastX = getX(chartSeasons.length - 1);
    const firstX = getX(0);
    return `${line} L ${lastX} ${plotBottom} L ${firstX} ${plotBottom} Z`;
  }

  function handleDotHover(
    e: React.MouseEvent<SVGCircleElement>,
    seasonIndex: number,
  ) {
    const svg = svgRef.current;
    if (!svg) return;

    const s = chartSeasons[seasonIndex];
    const values = selectedStats.map((stat, idx) => ({
      label: stat.label,
      value: stat.format(getStatValue(s, stat.key)),
      color: seriesColor(idx),
    }));

    // Get position relative to the SVG element
    const rect = svg.getBoundingClientRect();
    const scaleX = chartWidth / rect.width;
    const scaleY = chartHeight / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    setTooltip({
      x: svgX,
      y: svgY - 10,
      season: s.season,
      values,
    });
  }

  function handleDotLeave() {
    setTooltip(null);
  }

  return (
    <div className="bg-card border border-rule p-6 sm:p-8">
      <h2 className="font-display text-2xl text-text-primary sm:text-3xl mb-4">
        Évolution de carrière
      </h2>

      {/* Stat toggle pills */}
      <div className="flex flex-wrap gap-1 mb-5">
        {STATS.map((stat) => {
          const isActive = selected.includes(stat.key);
          const activeIdx = selectedStats.findIndex((s) => s.key === stat.key);
          return (
            <button
              key={stat.key}
              onClick={() => toggleStat(stat.key)}
              className={`border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                isActive
                  ? "text-white"
                  : "border-rule text-text-muted hover:border-border-hover hover:text-text-primary"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: seriesColor(activeIdx),
                      borderColor: seriesColor(activeIdx),
                    }
                  : undefined
              }
            >
              {stat.label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="w-full" style={{ minHeight: 200 }}>
        {isSingleSeason ? (
          /* Single season: bar chart */
          <svg
            ref={svgRef}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid lines */}
            {gridValues.map((val, i) => {
              const y = getY(val);
              return (
                <g key={i}>
                  <line
                    x1={plotLeft}
                    y1={y}
                    x2={plotRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="4,4"
                    strokeWidth={0.5}
                  />
                  <text
                    x={plotLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px]"
                    fill="var(--text-faint)"
                  >
                    {val.toFixed(val >= 10 ? 0 : 1)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {selectedStats.map((stat, statIdx) => {
              const s = chartSeasons[0];
              const val = getDisplayValue(s, stat);
              const color = seriesColor(statIdx);
              const barWidth = Math.min(80, plotWidth / (selectedStats.length * 2));
              const totalBarsWidth =
                selectedStats.length * barWidth +
                (selectedStats.length - 1) * 8;
              const startX =
                plotLeft + plotWidth / 2 - totalBarsWidth / 2 + statIdx * (barWidth + 8);
              const barHeight = (val / yMax) * plotHeight;

              return (
                <g key={stat.key}>
                  <rect
                    x={startX}
                    y={plotBottom - barHeight}
                    width={barWidth}
                    height={barHeight}
                    fill={color}
                    opacity={0.9}
                  />
                  <text
                    x={startX + barWidth / 2}
                    y={plotBottom - barHeight - 8}
                    textAnchor="middle"
                    className="text-[11px] font-medium tabular-nums"
                    fill={color}
                  >
                    {stat.format(getStatValue(s, stat.key))}
                  </text>
                  <text
                    x={startX + barWidth / 2}
                    y={plotBottom + 16}
                    textAnchor="middle"
                    className="text-[10px]"
                    fill="var(--text-faint)"
                  >
                    {stat.label}
                  </text>
                </g>
              );
            })}

            {/* Season label */}
            <text
              x={plotLeft + plotWidth / 2}
              y={plotBottom + 38}
              textAnchor="middle"
              className="text-[11px] font-medium"
              fill="var(--text-muted)"
            >
              {chartSeasons[0].season}
            </text>
          </svg>
        ) : (
          /* Multi-season: line chart */
          <svg
            ref={svgRef}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            preserveAspectRatio="xMidYMid meet"
            onMouseLeave={handleDotLeave}
          >
            {/* Grid lines */}
            {gridValues.map((val, i) => {
              const y = getY(val);
              return (
                <g key={i}>
                  <line
                    x1={plotLeft}
                    y1={y}
                    x2={plotRight}
                    y2={y}
                    stroke="var(--border)"
                    strokeDasharray="4,4"
                    strokeWidth={0.5}
                  />
                  <text
                    x={plotLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px]"
                    fill="var(--text-faint)"
                  >
                    {val.toFixed(val >= 10 ? 0 : 1)}
                  </text>
                </g>
              );
            })}

            {/* X-axis labels */}
            {chartSeasons.map((s, i) => {
              const x = getX(i);
              return (
                <text
                  key={i}
                  x={x}
                  y={plotBottom + 16}
                  textAnchor="end"
                  className="text-[10px]"
                  fill="var(--text-faint)"
                  transform={`rotate(-45 ${x} ${plotBottom + 16})`}
                >
                  {shortenSeason(s.season)}
                </text>
              );
            })}

            {/* Area fills + lines + dots for each selected stat */}
            {selectedStats.map((stat, statIdx) => {
              const color = seriesColor(statIdx);
              return (
              <g key={stat.key}>
                {/* Area fill */}
                <path
                  d={buildAreaPath(stat)}
                  fill={color}
                  opacity={0.08}
                />
                {/* Line */}
                <path
                  d={buildLinePath(stat)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {/* Dots */}
                {chartSeasons.map((s, i) => {
                  const x = getX(i);
                  const y = getY(getDisplayValue(s, stat));
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={4}
                      fill={color}
                      stroke="var(--bg-card)"
                      strokeWidth={2}
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleDotHover(e, i)}
                      onMouseLeave={handleDotLeave}
                    />
                  );
                })}
              </g>
              );
            })}

            {/* Tooltip */}
            {tooltip && (
              <g
                style={{ pointerEvents: "none" }}
                transform={`translate(${
                  tooltip.x > chartWidth - 140 ? tooltip.x - 140 : tooltip.x + 10
                }, ${tooltip.y > 60 ? tooltip.y - 60 : tooltip.y + 10})`}
              >
                <rect
                  x={0}
                  y={0}
                  width={130}
                  height={24 + tooltip.values.length * 20}
                  fill="var(--bg-card)"
                  stroke="var(--rule)"
                  strokeWidth={1}
                  opacity={0.97}
                />
                <text
                  x={10}
                  y={16}
                  className="text-[11px] font-semibold tabular-nums"
                  fill="var(--text)"
                >
                  {tooltip.season}
                </text>
                {tooltip.values.map((v, i) => (
                  <g key={i}>
                    <rect x={11} y={28 + i * 20} width={8} height={8} fill={v.color} />
                    <text
                      x={26}
                      y={36 + i * 20}
                      className="text-[10px] tabular-nums"
                      fill="var(--text-muted)"
                    >
                      {v.label}: {v.value}
                    </text>
                  </g>
                ))}
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
