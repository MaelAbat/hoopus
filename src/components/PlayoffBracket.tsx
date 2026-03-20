"use client";

import { useState } from "react";

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

const TEAM_ID: Record<string, number> = {
  ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766,
  CHI: 1610612741, CLE: 1610612739, DAL: 1610612742, DEN: 1610612743,
  DET: 1610612765, GSW: 1610612744, HOU: 1610612745, IND: 1610612754,
  LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748,
  MIL: 1610612749, MIN: 1610612750, NOP: 1610612740, NYK: 1610612752,
  OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
  POR: 1610612757, SAC: 1610612758, SAS: 1610612759, TOR: 1610612761,
  UTA: 1610612762, WAS: 1610612764,
};

function teamLogoUrl(tricode: string): string {
  const id = TEAM_ID[tricode];
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : "";
}

/* ─── Dimensions ─── */
const BOX_W = 170;
const BOX_H = 52;
const CONN_W = 36;
const HALF_H = 360;   // height per conference
const TOTAL_H = HALF_H * 2;

/* ─── Team row ─── */
function TeamRow({ team, seed }: { team: Standing | null; seed?: number }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <span className="w-4 text-center text-[10px] font-bold text-text-faint">{seed ?? ""}</span>
      {team ? (
        <>
          <img src={teamLogoUrl(team.team_tricode)} alt={team.team_tricode} className="h-5 w-5 shrink-0 object-contain" />
          <span className="text-xs font-semibold text-text-primary flex-1">{team.team_tricode}</span>
          <span className="text-[10px] tabular-nums text-text-muted">{team.wins}-{team.losses}</span>
        </>
      ) : (
        <span className="text-[10px] text-text-faint italic">TBD</span>
      )}
    </div>
  );
}

/* ─── Matchup box ─── */
function MatchupBox({ top, bottom, seedTop, seedBottom, accent }: {
  top: Standing | null;
  bottom: Standing | null;
  seedTop?: number;
  seedBottom?: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg overflow-hidden shadow-sm shrink-0 ${
        accent
          ? "border-2 border-accent/40 bg-card"
          : "border border-border-t bg-card"
      }`}
      style={{ width: BOX_W }}
    >
      <TeamRow team={top} seed={seedTop} />
      <div className={`h-px ${accent ? "bg-accent/30" : "bg-border-t"}`} />
      <TeamRow team={bottom} seed={seedBottom} />
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
/* Draws merge lines for both conferences (top half + bottom half) */
function DualConnector({ inputPerConf, outputPerConf }: { inputPerConf: number; outputPerConf: number }) {
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
        <path key={i} d={d} fill="none" stroke="var(--border-t)" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/* ─── SVG connector: 2 conf finals → 1 NBA finals ─── */
function FinalsConnector() {
  const eastY = HALF_H / 2;
  const westY = HALF_H + HALF_H / 2;
  const finalsY = TOTAL_H / 2;
  const mid = CONN_W / 2;

  return (
    <svg width={CONN_W} height={TOTAL_H} className="shrink-0">
      <path d={`M 0 ${eastY} H ${mid} V ${finalsY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5" />
      <path d={`M 0 ${westY} H ${mid} V ${finalsY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5" />
    </svg>
  );
}

/* ─── Full unified playoff bracket ─── */
function FullBracket({ east, west }: { east: Standing[]; west: Standing[] }) {
  const byRank = (teams: Standing[], rank: number) => teams.find(t => t.conference_rank === rank) || null;

  const makeR1 = (teams: Standing[]) => [
    { top: byRank(teams, 1), bottom: null as Standing | null, seedTop: 1, seedBottom: 8 },
    { top: byRank(teams, 4), bottom: byRank(teams, 5), seedTop: 4, seedBottom: 5 },
    { top: byRank(teams, 3), bottom: byRank(teams, 6), seedTop: 3, seedBottom: 6 },
    { top: byRank(teams, 2), bottom: null as Standing | null, seedTop: 2, seedBottom: 7 },
  ];

  const eastR1 = makeR1(east);
  const westR1 = makeR1(west);

  const roundLabels = ["1er tour", "Demi-finales", "Finale conf.", "Finales NBA"];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex flex-col items-center min-w-max">
        {/* ── Round labels ── */}
        <div className="flex items-end mb-3">
          {/* spacer for conference label column */}
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
                <MatchupBox key={i} top={m.top} bottom={m.bottom} seedTop={m.seedTop} seedBottom={m.seedBottom} />
              ))}
            </HalfCol>
            <HalfCol count={4}>
              {westR1.map((m, i) => (
                <MatchupBox key={i} top={m.top} bottom={m.bottom} seedTop={m.seedTop} seedBottom={m.seedBottom} />
              ))}
            </HalfCol>
          </div>

          {/* Connector R1 → Semis (4→2 per conf) */}
          <DualConnector inputPerConf={4} outputPerConf={2} />

          {/* Semis: 2 matchups per conference */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={2}>
              <MatchupBox top={null} bottom={null} />
              <MatchupBox top={null} bottom={null} />
            </HalfCol>
            <HalfCol count={2}>
              <MatchupBox top={null} bottom={null} />
              <MatchupBox top={null} bottom={null} />
            </HalfCol>
          </div>

          {/* Connector Semis → CF (2→1 per conf) */}
          <DualConnector inputPerConf={2} outputPerConf={1} />

          {/* Conference Finals: 1 per conference */}
          <div className="shrink-0" style={{ width: BOX_W }}>
            <HalfCol count={1}>
              <MatchupBox top={null} bottom={null} />
            </HalfCol>
            <HalfCol count={1}>
              <MatchupBox top={null} bottom={null} />
            </HalfCol>
          </div>

          {/* Connector CF → Finals (2 confs → 1) */}
          <FinalsConnector />

          {/* NBA Finals */}
          <div className="shrink-0 flex flex-col justify-center" style={{ width: BOX_W, height: TOTAL_H }}>
            <MatchupBox top={null} bottom={null} accent />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Play-In: single conference ─── */
function PlayInConference({ teams, label }: { teams: Standing[]; label: string }) {
  const byRank = (rank: number) => teams.find(t => t.conference_rank === rank) || null;
  const H = 220;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-text-primary text-center">{label}</h3>
      <div className="flex items-center justify-center overflow-x-auto">
        {/* R1 */}
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-2">Tour 1</span>
          <div className="flex flex-col justify-around" style={{ height: H }}>
            <div className="text-center">
              <p className="text-[9px] text-text-faint mb-1">Vainqueur → 7e seed</p>
              <MatchupBox top={byRank(7)} bottom={byRank(8)} seedTop={7} seedBottom={8} />
            </div>
            <div className="text-center">
              <p className="text-[9px] text-text-faint mb-1">Perdant éliminé</p>
              <MatchupBox top={byRank(9)} bottom={byRank(10)} seedTop={9} seedBottom={10} />
            </div>
          </div>
        </div>

        {/* Connector */}
        <svg width={CONN_W} height={H} className="shrink-0">
          {(() => {
            const inY1 = H / 4;
            const inY2 = (3 * H) / 4;
            const outY = H / 2;
            const mid = CONN_W / 2;
            return (
              <>
                <path d={`M 0 ${inY1} H ${mid} V ${outY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5" />
                <path d={`M 0 ${inY2} H ${mid} V ${outY} H ${CONN_W}`} fill="none" stroke="var(--border-t)" strokeWidth="1.5" />
              </>
            );
          })()}
        </svg>

        {/* R2 */}
        <div className="shrink-0 flex flex-col items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-2">8e place</span>
          <div className="flex flex-col justify-center" style={{ height: H }}>
            <div className="text-center">
              <p className="text-[9px] text-text-faint mb-1">Perdant 7-8 vs Vainqueur 9-10</p>
              <MatchupBox top={null} bottom={null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */
export default function PlayoffBracket({ east, west }: { east: Standing[]; west: Standing[] }) {
  const [view, setView] = useState<"playin" | "playoffs">("playoffs");

  const views: { key: "playin" | "playoffs"; label: string }[] = [
    { key: "playoffs", label: "Playoffs" },
    { key: "playin", label: "Play-In" },
  ];

  const hasData = east.length > 0 && west.length > 0;

  return (
    <div className="space-y-6">
      {/* Toggle */}
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

      {!hasData ? (
        <div className="rounded-2xl bg-card border border-border-t px-6 py-12 text-center text-sm text-text-muted">
          Aucune donnée disponible — synchronisez les classements d&apos;abord.
        </div>
      ) : view === "playin" ? (
        <div className="space-y-6">
          <div className="rounded-2xl bg-card border border-border-t p-6">
            <PlayInConference teams={east} label="Play-In — Conférence Est" />
          </div>
          <div className="rounded-2xl bg-card border border-border-t p-6">
            <PlayInConference teams={west} label="Play-In — Conférence Ouest" />
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
        <div className="rounded-2xl bg-card border border-border-t p-6">
          <FullBracket east={east} west={west} />
        </div>
      )}
    </div>
  );
}
