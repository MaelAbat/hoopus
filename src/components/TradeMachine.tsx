"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Info,
  Link2,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { playerPhotoUrl, teamLogoUrl } from "@/lib/nba-teams";
import {
  capStatus,
  formatMoney,
  formatMoneyDelta,
  type CapThresholds,
  type SeasonThresholds,
} from "@/lib/salary-cap";
import {
  encodeTrade,
  evaluateTrade,
  productionIndex,
  ROSTER_MAX,
  ROSTER_MIN,
  TPE_CUSHION,
  type TeamTradeSummary,
  type TradeMove,
  type TradeRosterPlayer,
} from "@/lib/trade-rules";

const MAX_TEAMS = 4;

interface Props {
  season: string;
  roster: TradeRosterPlayer[];
  payrollBase: Record<string, number>;
  initialTeams: string[];
  initialMoves: TradeMove[];
  /** Saison d'où viennent les moyennes affichées, si ce n'est pas celle de l'échange. */
  statsFromSeason?: string | null;
  /** Seuils de la saison, lus en base plutôt que codés en dur. */
  thresholds: SeasonThresholds;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function playerName(p: TradeRosterPlayer): string {
  return `${p.first_name} ${p.last_name}`;
}

function shortName(p: TradeRosterPlayer): string {
  return `${p.first_name.charAt(0)}. ${p.last_name}`;
}

/** Destination par défaut : l'équipe suivante dans la liste, en cycle. */
function defaultDestination(from: string, teams: string[]): string | null {
  const others = teams.filter((t) => t !== from);
  if (others.length === 0) return null;
  const i = teams.indexOf(from);
  return teams[(i + 1) % teams.length] === from ? others[0] : teams[(i + 1) % teams.length];
}

/* ─────────────────────── Verdict banner ─────────────────────── */

function VerdictBanner({
  verdict,
  errors,
  warnings,
}: {
  verdict: "empty" | "valid" | "invalid" | "incomplete";
  errors: string[];
  warnings: string[];
}) {
  const config = {
    empty: {
      label: "Aucun joueur dans l'échange",
      hint: "Choisissez deux équipes, puis cliquez sur les joueurs à échanger.",
      Icon: Info,
      accent: "bg-text-faint",
      text: "text-text-muted",
    },
    valid: {
      label: "Échange valide",
      hint: "L'échange respecte la concordance salariale et les règles d'apron.",
      Icon: CheckCircle2,
      accent: "bg-emerald-500",
      text: "text-emerald-500",
    },
    incomplete: {
      label: "Verdict incomplet",
      hint: "Aucune règle enfreinte, mais des contrats manquent — le calcul salarial est partiel.",
      Icon: AlertTriangle,
      accent: "bg-amber-500",
      text: "text-amber-500",
    },
    invalid: {
      label: "Échange invalide",
      hint: "Au moins une règle de la convention collective n'est pas respectée.",
      Icon: AlertTriangle,
      accent: "bg-red-500",
      text: "text-red-500",
    },
  }[verdict];

  const { Icon } = config;

  return (
    <div className="relative overflow-hidden border border-rule bg-card">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          <Icon size={22} className={`mt-0.5 shrink-0 ${config.text}`} strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="kicker text-text-faint">Verdict</p>
            <h2 className={`mt-1 font-display text-2xl uppercase leading-none sm:text-3xl ${config.text}`}>
              {config.label}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{config.hint}</p>

            {errors.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-rule pt-3">
                {errors.map((message, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text-secondary">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-red-500" />
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            )}

            {warnings.length > 0 && (
              <ul className={`space-y-2 ${errors.length > 0 ? "mt-3" : "mt-4 border-t border-rule pt-3"}`}>
                {warnings.map((message, i) => (
                  <li key={i} className="flex gap-2 text-sm text-text-muted">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-amber-500" />
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Cap ladder bar ─────────────────────── */

/** Barre compacte situant la masse salariale par rapport aux seuils. */
function CapLadder({
  payroll,
  thresholds,
}: {
  payroll: number;
  thresholds: CapThresholds;
}) {
  const scale = Math.max(thresholds.secondApron * 1.12, payroll * 1.04);
  const marks = [
    { key: "cap", value: thresholds.salaryCap, label: "Cap" },
    { key: "tax", value: thresholds.luxuryTax, label: "Tax" },
    { key: "a1", value: thresholds.firstApron, label: "A1" },
    { key: "a2", value: thresholds.secondApron, label: "A2" },
  ];
  const status = capStatus(payroll, thresholds);

  return (
    <div>
      <div className="relative h-4 bg-input">
        {marks.map((m) => (
          <div
            key={m.key}
            className={`absolute top-0 bottom-0 w-px ${m.key === "a2" ? "bg-accent" : "bg-border-hover"}`}
            style={{ left: `${(m.value / scale) * 100}%` }}
          />
        ))}
        <div
          className={`absolute top-0.5 bottom-0.5 left-0 ${status.barFill}`}
          style={{ width: `${Math.min((payroll / scale) * 100, 100)}%` }}
        />
      </div>
      <div className="relative mt-1 h-3">
        {marks.map((m) => (
          <span
            key={m.key}
            className={`absolute font-mono text-[9px] uppercase tracking-wider ${
              m.key === "a2" ? "text-accent-text" : "text-text-faint"
            }`}
            style={{ left: `${(m.value / scale) * 100}%`, transform: "translateX(-50%)" }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Team picker ─────────────────────── */

function TeamPicker({
  teams,
  taken,
  onSelect,
  onCancel,
}: {
  teams: { tricode: string; city: string; name: string }[];
  taken: string[];
  onSelect: (tricode: string) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="border border-rule bg-card">
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <p className="kicker text-text-faint">Choisir une équipe</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Annuler"
            className="flex h-6 w-6 items-center justify-center text-text-muted transition-colors hover:bg-input hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-5">
        {teams.map((t) => {
          const disabled = taken.includes(t.tricode);
          return (
            <button
              key={t.tricode}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(t.tricode)}
              title={`${t.city} ${t.name}`}
              className={`flex flex-col items-center gap-1 border p-2 transition-colors ${
                disabled
                  ? "cursor-not-allowed border-rule/40 opacity-30"
                  : "border-rule hover:border-border-hover hover:bg-input"
              }`}
            >
              <img src={teamLogoUrl(t.tricode)} alt="" className="h-7 w-7 object-contain" />
              <span className="font-display text-xs uppercase leading-none text-text-primary">
                {t.tricode}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────── Team panel ─────────────────────── */

function TeamPanel({
  summary,
  teams,
  roster,
  moves,
  thresholds,
  canRemove,
  onRemove,
  onToggle,
  onDestination,
}: {
  summary: TeamTradeSummary;
  teams: string[];
  roster: TradeRosterPlayer[];
  moves: TradeMove[];
  thresholds: CapThresholds;
  canRemove: boolean;
  onRemove: () => void;
  onToggle: (p: TradeRosterPlayer) => void;
  onDestination: (playerId: number, to: string) => void;
}) {
  const [query, setQuery] = useState("");
  const movedIds = useMemo(() => new Set(moves.map((m) => m.playerId)), [moves]);

  // Effectif restant, salaire décroissant (contrats inconnus en fin de liste).
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((p) => p.team_tricode === summary.tricode && !movedIds.has(p.player_id))
      .filter((p) => !q || playerName(p).toLowerCase().includes(q))
      .sort((a, b) => (b.salary ?? -1) - (a.salary ?? -1));
  }, [roster, summary.tricode, movedIds, query]);

  const netSalary = summary.incomingSalary - summary.outgoingSalary;
  const statusBefore = capStatus(summary.payrollBefore, thresholds);
  const statusAfter = capStatus(summary.payrollAfter, thresholds);
  const hasErrors = summary.issues.some((i) => i.level === "error");

  return (
    <div className={`border bg-card ${hasErrors ? "border-red-500/60" : "border-rule"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
        <img src={teamLogoUrl(summary.tricode)} alt="" className="h-9 w-9 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg uppercase leading-none text-text-primary">
            {summary.tricode}
          </p>
          <p className="kicker mt-0.5 truncate text-text-faint">
            {summary.city} {summary.name}
          </p>
        </div>
        <span
          className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${statusAfter.badge}`}
        >
          {statusAfter.label}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Retirer ${summary.tricode} de l'échange`}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-input hover:text-text-primary"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Salary flow */}
      <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        <div className="px-3 py-2.5 text-center">
          <p className="kicker text-text-faint">Sortant</p>
          <p className="tnum mt-1 text-sm font-bold text-text-primary">
            {formatMoney(summary.outgoingSalary)}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="kicker text-text-faint">Entrant</p>
          <p className="tnum mt-1 text-sm font-bold text-text-primary">
            {formatMoney(summary.incomingSalary)}
          </p>
        </div>
        <div className="px-3 py-2.5 text-center">
          <p className="kicker text-text-faint">Écart</p>
          <p
            className={`tnum mt-1 text-sm font-bold ${
              netSalary > 0 ? "text-red-500" : netSalary < 0 ? "text-emerald-500" : "text-text-muted"
            }`}
          >
            {formatMoneyDelta(netSalary)}
          </p>
        </div>
      </div>

      {/* Payroll before / after + ladder */}
      <div className="border-b border-rule px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="kicker text-text-faint">Masse salariale</p>
          <p className="tnum text-xs text-text-muted">
            <span className={statusBefore.color}>{formatMoney(summary.payrollBefore)}</span>
            <ArrowRight size={11} className="mx-1 inline align-middle text-text-faint" />
            <span className={`font-bold ${statusAfter.color}`}>{formatMoney(summary.payrollAfter)}</span>
          </p>
        </div>
        <div className="mt-2">
          <CapLadder payroll={summary.payrollAfter} thresholds={thresholds} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span className="kicker text-text-faint">
            Marge 1er apron{" "}
            <span className={`tnum ${summary.firstApronRoomAfter < 0 ? "text-red-500" : "text-text-secondary"}`}>
              {formatMoneyDelta(summary.firstApronRoomAfter)}
            </span>
          </span>
          <span className="kicker text-text-faint">
            Effectif <span className="tnum text-text-secondary">{summary.rosterBefore}</span>
            <ArrowRight size={10} className="mx-1 inline align-middle" />
            <span
              className={`tnum ${
                summary.rosterAfter > ROSTER_MAX || summary.rosterAfter < ROSTER_MIN
                  ? "text-amber-500"
                  : "text-text-secondary"
              }`}
            >
              {summary.rosterAfter}
            </span>
          </span>
        </div>
      </div>

      {/* Salary matching rule */}
      {summary.outgoingSalary > 0 && (
        <div className="border-b border-rule bg-input/30 px-4 py-2.5">
          <p className="kicker text-text-faint">Salaire entrant maximal</p>
          <p className="tnum mt-1 text-sm font-bold text-text-primary">
            {formatMoney(summary.matchRule.limit)}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{summary.matchRule.label}</p>
        </div>
      )}

      {/* Outgoing */}
      {summary.outgoing.length > 0 && (
        <div className="border-b border-rule">
          <p className="kicker border-b border-rule/60 px-4 py-2 text-text-faint">
            Partants · <span className="tnum">{summary.outgoing.length}</span>
          </p>
          {summary.outgoing.map((p) => {
            const move = moves.find((m) => m.playerId === p.player_id);
            return (
              <div key={p.player_id} className="flex items-center gap-2 border-b border-rule/60 px-3 py-2 last:border-b-0">
                <img
                  src={playerPhotoUrl(p.player_id)}
                  alt=""
                  className="h-8 w-8 shrink-0 bg-input object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/joueurs/${p.player_id}`}
                    className="block truncate text-xs font-semibold text-text-primary transition-colors hover:text-accent-text"
                  >
                    {shortName(p)}
                  </Link>
                  <p className="tnum kicker text-text-faint">
                    {p.salary != null ? formatMoney(p.salary) : "Contrat inconnu"}
                  </p>
                </div>

                {/* Destination : sélecteur dès trois équipes */}
                {teams.length > 2 ? (
                  <select
                    value={move?.to ?? ""}
                    onChange={(e) => onDestination(p.player_id, e.target.value)}
                    aria-label={`Destination de ${playerName(p)}`}
                    className="shrink-0 border border-rule bg-input px-1.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-text-primary outline-none transition-colors hover:border-border-hover"
                  >
                    {teams
                      .filter((t) => t !== summary.tricode)
                      .map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                  </select>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <ArrowRight size={11} />
                    {move?.to}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onToggle(p)}
                  aria-label={`Retirer ${playerName(p)} de l'échange`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-input hover:text-text-primary"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Incoming */}
      {summary.incoming.length > 0 && (
        <div className="border-b border-rule bg-accent-light/40">
          <p className="kicker border-b border-rule/60 px-4 py-2 text-accent-text">
            Arrivants · <span className="tnum">{summary.incoming.length}</span>
          </p>
          {summary.incoming.map((p) => (
            <div key={p.player_id} className="flex items-center gap-2 border-b border-rule/60 px-3 py-2 last:border-b-0">
              <img
                src={playerPhotoUrl(p.player_id)}
                alt=""
                className="h-8 w-8 shrink-0 bg-input object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = "hidden";
                }}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/joueurs/${p.player_id}`}
                  className="block truncate text-xs font-semibold text-text-primary transition-colors hover:text-accent-text"
                >
                  {shortName(p)}
                </Link>
                <p className="tnum kicker text-text-faint">
                  {p.salary != null ? formatMoney(p.salary) : "Contrat inconnu"}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {p.team_tricode}
                <ArrowRight size={11} />
              </span>
              <button
                type="button"
                onClick={() => onToggle(p)}
                aria-label={`Retirer ${playerName(p)} de l'échange`}
                className="flex h-6 w-6 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-input hover:text-text-primary"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Issues */}
      {summary.issues.length > 0 && (
        <div className="border-b border-rule px-4 py-2.5">
          <ul className="space-y-1.5">
            {summary.issues.map((issue, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-snug">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 ${
                    issue.level === "error" ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
                <span className={issue.level === "error" ? "text-text-secondary" : "text-text-muted"}>
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Roster browser */}
      <div>
        <div className="relative border-b border-rule">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Rechercher dans l'effectif ${summary.tricode}`}
            autoComplete="off"
            className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-faint outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {available.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">Aucun joueur disponible.</p>
          ) : (
            available.map((p) => (
              <button
                key={p.player_id}
                type="button"
                onClick={() => onToggle(p)}
                className="group flex w-full items-center gap-2 border-b border-rule/60 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-card-hover"
              >
                <img
                  src={playerPhotoUrl(p.player_id)}
                  alt=""
                  className="h-8 w-8 shrink-0 bg-input object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-text-primary">{shortName(p)}</p>
                  <p className="kicker text-text-faint">
                    {p.position || "N/A"} ·{" "}
                    <span className="tnum">{p.pts?.toFixed(1) ?? "—"}</span> pts
                  </p>
                </div>
                <span
                  className={`tnum shrink-0 text-[11px] font-semibold ${
                    p.salary != null ? "text-text-secondary" : "text-text-faint"
                  }`}
                >
                  {p.salary != null ? formatMoney(p.salary) : "N/A"}
                </span>
                <Plus
                  size={14}
                  className="shrink-0 text-text-faint transition-colors group-hover:text-accent-text"
                />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Balance table ─────────────────────── */

function BalanceTable({
  summaries,
  statsFromSeason,
}: {
  summaries: TeamTradeSummary[];
  statsFromSeason?: string | null;
}) {
  return (
    <div className="border border-rule bg-card">
      <p className="kicker border-b border-rule px-4 py-3 text-text-faint">Bilan de l&apos;échange</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="px-3 py-2.5 text-left kicker text-text-faint">Équipe</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint whitespace-nowrap">Salaire net</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint whitespace-nowrap">Masse après</th>
              <th className="px-3 py-2.5 text-center kicker text-text-faint whitespace-nowrap">Statut</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint">PTS</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint">REB</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint">AST</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint whitespace-nowrap">Indice prod.</th>
              <th className="px-3 py-2.5 text-right kicker text-text-faint whitespace-nowrap">Âge moyen</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const netSalary = s.incomingSalary - s.outgoingSalary;
              const netPts = s.ptsIn - s.ptsOut;
              const netReb = s.rebIn - s.rebOut;
              const netAst = s.astIn - s.astOut;
              const netProd = s.productionIn - s.productionOut;
              const status = capStatus(s.payrollAfter);
              const ageDelta =
                s.ageBefore != null && s.ageAfter != null ? s.ageAfter - s.ageBefore : null;

              return (
                <tr key={s.tricode} className="border-b border-rule transition-colors last:border-b-0 hover:bg-card-hover">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <img src={teamLogoUrl(s.tricode)} alt="" className="h-5 w-5 object-contain" />
                      <span className="font-display text-sm uppercase text-text-primary">{s.tricode}</span>
                    </div>
                  </td>
                  <td
                    className={`tnum px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap ${
                      netSalary > 0 ? "text-red-500" : netSalary < 0 ? "text-emerald-500" : "text-text-muted"
                    }`}
                  >
                    {formatMoneyDelta(netSalary)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-xs text-text-secondary whitespace-nowrap">
                    {formatMoney(s.payrollAfter)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-block border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${status.badge}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  {[netPts, netReb, netAst].map((v, i) => (
                    <td
                      key={i}
                      className={`tnum px-3 py-2.5 text-right text-xs ${
                        v > 0 ? "text-emerald-500" : v < 0 ? "text-red-500" : "text-text-muted"
                      }`}
                    >
                      {v > 0 ? "+" : ""}
                      {v.toFixed(1)}
                    </td>
                  ))}
                  <td
                    className={`tnum px-3 py-2.5 text-right text-xs font-bold ${
                      netProd > 0 ? "text-emerald-500" : netProd < 0 ? "text-red-500" : "text-text-muted"
                    }`}
                  >
                    {netProd > 0 ? "+" : ""}
                    {netProd.toFixed(1)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-xs text-text-muted whitespace-nowrap">
                    {s.ageAfter != null ? s.ageAfter.toFixed(1) : "—"}
                    {ageDelta != null && Math.abs(ageDelta) >= 0.05 && (
                      <span className={ageDelta > 0 ? " text-red-500" : " text-emerald-500"}>
                        {" "}
                        ({ageDelta > 0 ? "+" : ""}
                        {ageDelta.toFixed(1)})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-rule px-4 py-2.5 text-[11px] leading-snug text-text-faint">
        PTS / REB / AST : variation du total des moyennes par match des joueurs échangés. Indice de
        production = PTS + 1,2 × REB + 1,5 × AST — repère indicatif, pas une valeur de marché.
        {statsFromSeason && (
          <>
            {" "}Moyennes issues de la saison {statsFromSeason}, la saison en cours n&apos;ayant pas
            encore débuté.
          </>
        )}
      </p>
    </div>
  );
}

/* ─────────────────────── Rules panel ─────────────────────── */

function RulesPanel({ season, thresholds }: { season: string; thresholds: SeasonThresholds }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-rule bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-card-hover"
      >
        <span className="kicker text-text-faint">Règles appliquées · Saison {season}</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
          {open ? "Masquer" : "Afficher"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-rule px-4 py-4 text-sm text-text-muted">
          <div>
            <p className="kicker mb-2 text-text-faint">Seuils</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Salary Cap", val: thresholds.salaryCap },
                { label: "Luxury Tax", val: thresholds.luxuryTax },
                { label: "1er Apron", val: thresholds.firstApron },
                { label: "2nd Apron", val: thresholds.secondApron },
              ].map((t) => (
                <div key={t.label} className="border border-rule px-3 py-2">
                  <p className="kicker text-text-faint">{t.label}</p>
                  <p className="tnum mt-0.5 text-sm font-bold text-text-primary">{formatMoney(t.val)}</p>
                </div>
              ))}
            </div>
            {thresholds.isEstimated && (
              <p className="mt-2 text-[11px] leading-snug text-amber-500">
                Montants estimés : la ligue n&apos;a pas encore publié ses seuils pour {season}. La
                projection applique la hausse maximale prévue par la convention collective, soit
                10 % par an. Les verdicts d&apos;échange sont donc indicatifs près des lignes.
              </p>
            )}
          </div>

          <div>
            <p className="kicker mb-2 text-text-faint">Concordance salariale</p>
            <ul className="space-y-1.5">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                <span>
                  Équipe sous le plafond après l&apos;échange : elle absorbe le salaire entrant dans son
                  espace disponible.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                <span>
                  Équipe au-dessus du plafond mais sous le 1er apron : jusqu&apos;à 125 % du salaire
                  sortant + {formatMoney(TPE_CUSHION)}, sans franchir le 1er apron.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                <span>
                  Équipe au-dessus du 1er apron : dollar pour dollar, elle ne peut pas recevoir plus
                  qu&apos;elle n&apos;envoie.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
                <span>
                  Équipe au-dessus du second apron : interdiction d&apos;agréger plusieurs contrats
                  sortants pour absorber un salaire entrant.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <p className="kicker mb-2 text-text-faint">Effectifs</p>
            <p>
              Limite de {ROSTER_MAX} joueurs sous contrat standard, minimum de {ROSTER_MIN}. Les
              effectifs listés ici recensent tous les joueurs passés par la franchise sur la saison :
              les écarts de limite sont donc signalés en avertissement, sans invalider l&apos;échange.
            </p>
          </div>

          <div>
            <p className="kicker mb-2 text-text-faint">Non pris en compte</p>
            <p>
              Exceptions de trade des saisons antérieures, clauses de non-échange, tours de draft,
              joueurs two-way, délais post-signature, droits Bird et restrictions liées aux
              prolongations. Les masses salariales proviennent des contrats de l&apos;effectif et
              incluent le dead money quand la donnée est disponible.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Main component ─────────────────────── */

export default function TradeMachine({
  season,
  roster,
  payrollBase,
  initialTeams,
  initialMoves,
  statsFromSeason,
  thresholds,
}: Props) {
  const [teams, setTeams] = useState<string[]>(initialTeams);
  const [moves, setMoves] = useState<TradeMove[]>(initialMoves);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toutes les franchises présentes dans les effectifs, pour le sélecteur.
  const allTeams = useMemo(() => {
    const map = new Map<string, { tricode: string; city: string; name: string }>();
    for (const p of roster) {
      if (!map.has(p.team_tricode)) {
        map.set(p.team_tricode, {
          tricode: p.team_tricode,
          city: p.team_city,
          name: p.team_name,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.tricode.localeCompare(b.tricode));
  }, [roster]);

  /* ── Actions ── */

  const addTeam = useCallback((tricode: string) => {
    setTeams((prev) => (prev.includes(tricode) || prev.length >= MAX_TEAMS ? prev : [...prev, tricode]));
    setAdding(false);
  }, []);

  const removeTeam = useCallback((tricode: string) => {
    setTeams((prev) => prev.filter((t) => t !== tricode));
    // Retirer aussi tous les mouvements qui touchaient cette équipe.
    setMoves((prev) => prev.filter((m) => m.from !== tricode && m.to !== tricode));
  }, []);

  const togglePlayer = useCallback(
    (p: TradeRosterPlayer) => {
      setMoves((prev) => {
        if (prev.some((m) => m.playerId === p.player_id)) {
          return prev.filter((m) => m.playerId !== p.player_id);
        }
        const to = defaultDestination(p.team_tricode, teams);
        if (!to) return prev;
        return [...prev, { playerId: p.player_id, from: p.team_tricode, to }];
      });
    },
    [teams]
  );

  const setDestination = useCallback((playerId: number, to: string) => {
    setMoves((prev) => prev.map((m) => (m.playerId === playerId ? { ...m, to } : m)));
  }, []);

  const reset = useCallback(() => {
    setMoves([]);
    setCopied(false);
  }, []);

  const copyLink = useCallback(async () => {
    const query = encodeTrade(teams, moves);
    const url = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Presse-papiers indisponible : on remplace l'URL, l'utilisateur peut la copier.
      window.history.replaceState(null, "", url);
    }
  }, [teams, moves]);

  /* ── Évaluation ── */

  const evaluation = useMemo(
    () => evaluateTrade({ season, teams, moves, roster, payrollBase, thresholds }),
    [season, teams, moves, roster, payrollBase, thresholds]
  );

  const errors = useMemo(
    () => [
      ...evaluation.globalIssues.filter((i) => i.level === "error").map((i) => i.message),
      ...evaluation.teams.flatMap((t) => t.issues.filter((i) => i.level === "error").map((i) => i.message)),
    ],
    [evaluation]
  );
  const warnings = useMemo(
    () => [
      ...evaluation.globalIssues.filter((i) => i.level === "warning").map((i) => i.message),
      ...evaluation.teams.flatMap((t) => t.issues.filter((i) => i.level === "warning").map((i) => i.message)),
    ],
    [evaluation]
  );

  const totalPlayers = moves.length;
  const totalSalary = useMemo(
    () =>
      moves.reduce((a, m) => {
        const p = roster.find((r) => r.player_id === m.playerId);
        return a + (p?.salary ?? 0);
      }, 0),
    [moves, roster]
  );
  const bestProduction = useMemo(() => {
    const players = moves
      .map((m) => roster.find((r) => r.player_id === m.playerId))
      .filter((p): p is TradeRosterPlayer => !!p);
    if (players.length === 0) return null;
    return players.reduce((a, b) => (productionIndex(b) > productionIndex(a) ? b : a));
  }, [moves, roster]);

  if (roster.length === 0) {
    return (
      <div className="border border-rule bg-card px-6 py-12 text-center text-sm text-text-muted">
        Aucun effectif disponible pour cette saison — synchronisez les effectifs d&apos;abord.
      </div>
    );
  }

  /* ── Rendu ── */

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={teams.length >= MAX_TEAMS}
          className="flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} />
          Ajouter une équipe
          <span className="tnum text-text-faint">
            {teams.length}/{MAX_TEAMS}
          </span>
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={moves.length === 0}
          className="flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={13} />
          Réinitialiser
        </button>

        <button
          type="button"
          onClick={copyLink}
          disabled={teams.length === 0}
          className="flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Link2 size={13} />
          {copied ? "Lien copié" : "Partager"}
        </button>

        {totalPlayers > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="kicker text-text-faint">
              <span className="tnum text-text-secondary">{totalPlayers}</span> joueur
              {totalPlayers > 1 ? "s" : ""} échangé{totalPlayers > 1 ? "s" : ""}
            </span>
            <span className="kicker text-text-faint">
              <span className="tnum text-text-secondary">{formatMoney(totalSalary)}</span> en jeu
            </span>
            {bestProduction && (
              <span className="kicker text-text-faint">
                Pièce maîtresse{" "}
                <span className="text-text-secondary">{shortName(bestProduction)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Team picker */}
      {(adding || teams.length === 0) && (
        <TeamPicker
          teams={allTeams}
          taken={teams}
          onSelect={addTeam}
          onCancel={teams.length > 0 ? () => setAdding(false) : undefined}
        />
      )}

      {/* Verdict */}
      {teams.length > 0 && (
        <VerdictBanner verdict={evaluation.verdict} errors={errors} warnings={warnings} />
      )}

      {/* Prompt when a single team is selected */}
      {teams.length === 1 && (
        <div className="flex items-center gap-3 border border-rule bg-card px-4 py-3 text-sm text-text-muted">
          <ArrowLeftRight size={16} className="shrink-0 text-accent" />
          Ajoutez une deuxième équipe pour construire l&apos;échange.
        </div>
      )}

      {/* Team panels */}
      {teams.length > 0 && (
        <div className={`grid gap-4 ${teams.length > 1 ? "lg:grid-cols-2" : ""}`}>
          {evaluation.teams.map((summary) => (
            <TeamPanel
              key={summary.tricode}
              summary={summary}
              teams={teams}
              roster={roster}
              moves={moves}
              thresholds={evaluation.thresholds}
              canRemove={teams.length > 1}
              onRemove={() => removeTeam(summary.tricode)}
              onToggle={togglePlayer}
              onDestination={setDestination}
            />
          ))}
        </div>
      )}

      {/* Balance */}
      {moves.length > 0 && (
        <BalanceTable summaries={evaluation.teams} statsFromSeason={statsFromSeason} />
      )}

      {/* Rules */}
      <RulesPanel season={season} thresholds={thresholds} />
    </div>
  );
}
