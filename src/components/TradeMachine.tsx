"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Info,
  Layers,
  Link2,
  Lock,
  Plus,
  Redo2,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { playerPhotoUrl, teamLogoUrl } from "@/lib/nba-teams";
import {
  capStatus,
  formatMoney,
  formatMoneyDelta,
  TRADE_CUSHION,
  type CapThresholds,
  type SeasonThresholds,
  type TradeAmounts,
} from "@/lib/salary-cap";
import {
  buildPickInventory,
  DRAFT_HORIZON,
  frozenPickYear,
  lastTradeableDraftYear,
  pickLabel,
  tradeableDraftYears,
  type DraftPickAsset,
} from "@/lib/draft-assets";
import {
  encodeTrade,
  evaluateTrade,
  isMinimumContract,
  MAX_TEAMS,
  MAX_TRADE_BONUS_PCT,
  productionIndex,
  RESTRICTIONS,
  ROSTER_MAX,
  ROSTER_MIN,
  type CashMove,
  type PickMove,
  type PlayerTradeFlags,
  type RestrictionKey,
  type TeamTradeSummary,
  type TradeIssue,
  type TradeMove,
  type TradeRosterPlayer,
  type TradeVerdict,
  type TradeWindow,
} from "@/lib/trade-rules";

interface Props {
  season: string;
  roster: TradeRosterPlayer[];
  payrollBase: Record<string, number>;
  initialTeams: string[];
  initialMoves: TradeMove[];
  initialPickMoves: PickMove[];
  initialCash: CashMove[];
  initialFlags: Record<number, PlayerTradeFlags>;
  initialTradeExceptions: Record<string, number>;
  /** Saison d'où viennent les moyennes affichées, si ce n'est pas celle de l'échange. */
  statsFromSeason?: string | null;
  /** Seuils de la saison, lus en base plutôt que codés en dur. */
  thresholds: SeasonThresholds;
  /** Fenêtre d'échange, calculée depuis les périodes de la saison. */
  window: TradeWindow;
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

/** Saisie d'un montant en dollars, tolérante sur la forme. */
function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const ISSUE_DOT: Record<TradeIssue["level"], string> = {
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-accent",
};

const ISSUE_TEXT: Record<TradeIssue["level"], string> = {
  error: "text-text-secondary",
  warning: "text-text-muted",
  info: "text-text-muted",
};

/** Signe d'une variation, pour colorer une valeur nette. */
function deltaColor(v: number, goodWhenPositive = true): string {
  if (v === 0) return "text-text-muted";
  const good = goodWhenPositive ? v > 0 : v < 0;
  return good ? "text-emerald-500" : "text-red-500";
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n > 1 ? many : one;
}

/**
 * Habillage d'une `<option>` de liste déroulante.
 *
 * À ne pas retirer : le fond des champs (`bg-input`) est volontairement
 * translucide, ce qui va bien à un contrôle posé sur une carte mais pas au menu
 * natif, que le navigateur dessine sur sa propre surface. Sans fond opaque, le
 * menu apparaît blanc et transparent — illisible dans tous les thèmes sombres,
 * c'est-à-dire dans cinq des six. `bg-card` est le seul jeton opaque à la bonne
 * teinte, et le reste du site le pose déjà ainsi.
 */
const OPTION_CLASS = "bg-card text-text-primary";

/* ─────────────────────── État et historique ─────────────────────── */

interface TradeDraft {
  teams: string[];
  moves: TradeMove[];
  pickMoves: PickMove[];
  cash: CashMove[];
  flags: Record<number, PlayerTradeFlags>;
  tradeExceptions: Record<string, number>;
}

/**
 * L'échange, avec son historique.
 *
 * Tout ici se construit par essais : on ajoute une équipe, on la retire, on
 * change une destination. Sans retour arrière, chaque clic devient un
 * engagement — et retirer une équipe efface au passage les mouvements que les
 * autres avaient vers elle, ce qui coûte cher pour une fausse manœuvre. Un
 * historique rend donc tous les gestes réversibles, et dispense de demander
 * confirmation à chaque destruction : rien n'est perdu, donc rien n'interrompt.
 *
 * Un seul objet d'état, muté par une fonction pure : deux `setState` séparés
 * dédoubleraient l'historique au double appel des updaters de React.
 */
const HISTORY_LIMIT = 60;

function useTradeHistory(initial: TradeDraft) {
  const [stack, setStack] = useState<{
    past: TradeDraft[];
    present: TradeDraft;
    future: TradeDraft[];
  }>({ past: [], present: initial, future: [] });

  const commit = useCallback((update: (draft: TradeDraft) => TradeDraft) => {
    setStack(({ past, present, future }) => {
      const next = update(present);
      // Une mise à jour qui ne change rien ne mérite pas une entrée d'historique.
      if (next === present) return { past, present, future };
      return { past: [...past, present].slice(-HISTORY_LIMIT), present: next, future };
    });
  }, []);

  const undo = useCallback(() => {
    setStack(({ past, present, future }) => {
      if (past.length === 0) return { past, present, future };
      return {
        past: past.slice(0, -1),
        present: past[past.length - 1],
        future: [present, ...future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setStack(({ past, present, future }) => {
      if (future.length === 0) return { past, present, future };
      return {
        past: [...past, present].slice(-HISTORY_LIMIT),
        present: future[0],
        future: future.slice(1),
      };
    });
  }, []);

  return {
    draft: stack.present,
    commit,
    undo,
    redo,
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
  };
}

/** Ce qu'une équipe a dans l'échange — sert à prévenir avant de la retirer. */
function assetsInvolving(draft: TradeDraft, tricode: string): number {
  return (
    draft.moves.filter((m) => m.from === tricode || m.to === tricode).length +
    draft.pickMoves.filter((m) => m.from === tricode || m.to === tricode).length +
    draft.cash.filter((c) => (c.from === tricode || c.to === tricode) && c.amount > 0).length
  );
}

/* ─────────────────────── Petits éléments partagés ─────────────────────── */

/** Logo et tricode, la façon la plus rapide de lire « vers qui ». */
function TeamChip({ tricode, size = 14 }: { tricode: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-text-secondary">
      <img
        src={teamLogoUrl(tricode)}
        alt=""
        style={{ height: size, width: size }}
        className="object-contain"
      />
      {tricode}
    </span>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 border border-rule px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* ─────────────────────── Bloc repliable ─────────────────────── */

/**
 * Section repliable, tout l'enjeu de lisibilité de cette page.
 *
 * Une trade machine a beaucoup à dire — quatre voies de concordance, un hard
 * cap, une trade exception, des clauses par contrat — et tout afficher d'un coup
 * noie le geste principal, qui est de composer l'échange. Le détail se replie
 * donc derrière son résumé : la ligne visible suffit à décider si l'on veut en
 * savoir plus.
 */
function Collapsible({
  title,
  summary,
  defaultOpen = false,
  accent,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  accent?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-rule">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-card-hover"
      >
        <span className={`kicker shrink-0 ${accent ?? "text-text-faint"}`}>{title}</span>
        {summary && (
          <span className="min-w-0 flex-1 truncate text-right text-[11px] text-text-muted">
            {summary}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-rule/60">{children}</div>}
    </div>
  );
}

/* ─────────────────────── Verdict banner ─────────────────────── */

const VERDICTS: Record<
  TradeVerdict,
  { label: string; hint: string; Icon: typeof Info; accent: string; text: string }
> = {
  empty: {
    label: "Échange vide",
    hint: "Ajoutez des joueurs, des picks ou du cash depuis les effectifs ci-dessous.",
    Icon: Info,
    accent: "bg-text-faint",
    text: "text-text-muted",
  },
  valid: {
    label: "Échange valide",
    hint: "Concordance salariale, aprons, picks, cash et effectifs : tout passe.",
    Icon: CheckCircle2,
    accent: "bg-emerald-500",
    text: "text-emerald-500",
  },
  conditional: {
    label: "Échange sous conditions",
    hint: "Aucune règle enfreinte, mais l'accord d'au moins un joueur est nécessaire.",
    Icon: ShieldAlert,
    accent: "bg-amber-500",
    text: "text-amber-500",
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
};

/**
 * Le verdict et ce qui bloque.
 *
 * On n'y met que les erreurs : les avertissements et les notes vivent dans le
 * panneau de leur équipe, là où ils ont un sens. Sans erreur, on remonte les
 * avertissements — sinon un verdict « incomplet » n'aurait rien pour s'expliquer.
 */
function VerdictBanner({ verdict, issues }: { verdict: TradeVerdict; issues: TradeIssue[] }) {
  const config = VERDICTS[verdict];
  const { Icon } = config;

  return (
    <div className="relative overflow-hidden border border-rule bg-card">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start gap-3">
          <Icon size={22} className={`mt-0.5 shrink-0 ${config.text}`} strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="kicker text-text-faint">Verdict</p>
            <h2
              className={`mt-1 font-display text-2xl uppercase leading-none sm:text-3xl ${config.text}`}
            >
              {config.label}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{config.hint}</p>

            {issues.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-rule pt-3">
                {issues.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${ISSUE_DOT[issue.level]}`} />
                    <span className={ISSUE_TEXT[issue.level]}>
                      {issue.rule && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-faint">
                          {issue.rule}
                          {" · "}
                        </span>
                      )}
                      {issue.message}
                    </span>
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
function CapLadder({ payroll, thresholds }: { payroll: number; thresholds: CapThresholds }) {
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
      <div className="relative h-3.5 bg-input">
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

/* ─────────────────────── Choix d'une équipe ─────────────────────── */

interface TeamOption {
  tricode: string;
  city: string;
  name: string;
}

/**
 * Sélecteur d'équipe, en deux formats.
 *
 * `grid` pour l'écran de départ, où l'on a toute la largeur et où trente logos
 * invitent à cliquer. `list` pour le créneau vide de la grille de panneaux : la
 * colonne est étroite, une liste verticale s'y lit mieux qu'un damier — et
 * surtout, le sélecteur occupe exactement la place que prendra le panneau, si
 * bien qu'on voit où l'équipe va atterrir.
 *
 * Dans les deux cas une recherche : chercher « Mem » bat le balayage visuel de
 * trente écussons.
 */
function TeamPicker({
  teams,
  taken,
  layout,
  onSelect,
  onCancel,
}: {
  teams: TeamOption[];
  taken: string[];
  layout: "grid" | "list";
  onSelect: (tricode: string) => void;
  onCancel?: () => void;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      `${t.tricode} ${t.city} ${t.name}`.toLowerCase().includes(q)
    );
  }, [teams, query]);

  return (
    <div className="flex h-full flex-col border border-rule bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-3">
        <p className="kicker text-text-faint">Choisir une équipe</p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer le sélecteur d'équipe"
            className="flex h-6 w-6 shrink-0 items-center justify-center text-text-muted transition-colors hover:bg-input hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="relative border-b border-rule">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une franchise"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-faint outline-none"
        />
      </div>

      {matches.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-text-muted">Aucune franchise trouvée.</p>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-4 gap-2 p-3 sm:grid-cols-6 lg:grid-cols-10">
          {matches.map((t) => {
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
      ) : (
        <div className="max-h-80 flex-1 overflow-y-auto">
          {matches.map((t) => {
            const disabled = taken.includes(t.tricode);
            return (
              <button
                key={t.tricode}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(t.tricode)}
                className={`flex w-full items-center gap-2.5 border-b border-rule/60 px-3 py-2 text-left transition-colors last:border-b-0 ${
                  disabled
                    ? "cursor-not-allowed opacity-30"
                    : "hover:bg-card-hover"
                }`}
              >
                <img src={teamLogoUrl(t.tricode)} alt="" className="h-7 w-7 shrink-0 object-contain" />
                <span className="font-display text-sm uppercase leading-none text-text-primary">
                  {t.tricode}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                  {t.city} {t.name}
                </span>
                {disabled ? (
                  <span className="kicker shrink-0 text-text-faint">déjà dans l&apos;échange</span>
                ) : (
                  <Plus size={14} className="shrink-0 text-text-faint" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Créneau vide de la grille : l'endroit où l'on ajoute une équipe. */
function AddTeamSlot({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-40 flex-col items-center justify-center gap-2 border border-dashed border-rule bg-card/40 px-4 py-8 transition-colors hover:border-accent hover:bg-card-hover"
    >
      <span className="flex h-10 w-10 items-center justify-center border border-rule text-text-faint transition-colors group-hover:border-accent group-hover:text-accent-text">
        <Plus size={18} />
      </span>
      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors group-hover:text-text-primary">
        Ajouter une équipe
      </span>
      <span className="kicker tnum text-text-faint">
        {count}/{MAX_TEAMS} · jusqu&apos;à cinq équipes
      </span>
    </button>
  );
}

/* ─────────────────────── Destination ─────────────────────── */

function DestinationSelect({
  value,
  from,
  teams,
  label,
  onChange,
}: {
  value: string | undefined;
  from: string;
  teams: string[];
  label: string;
  onChange: (to: string) => void;
}) {
  // À deux équipes la destination est la seule possible : l'annoncer suffit,
  // proposer un choix d'un seul élément serait un faux contrôle.
  if (teams.length <= 2) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <ArrowUpRight size={12} className="text-text-faint" />
        {value && <TeamChip tricode={value} size={13} />}
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <ArrowUpRight size={12} className="text-text-faint" />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="border border-rule bg-input px-1.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-text-primary outline-none transition-colors hover:border-border-hover"
      >
        {teams
          .filter((t) => t !== from)
          .map((t) => (
            <option key={t} value={t} className={OPTION_CLASS}>
              {t}
            </option>
          ))}
      </select>
    </span>
  );
}

/* ─────────────────────── Clauses d'un contrat ─────────────────────── */

const BONUS_STEPS = [0, 5, 10, 15];

/**
 * Déclaration des clauses d'un contrat.
 *
 * Aucune source ne publie les trade kickers, les clauses de non-échange ni les
 * délais de carence : ce panneau est le seul endroit où ces règles peuvent
 * entrer dans le calcul. Tout part de zéro, rien n'est supposé.
 */
function FlagsEditor({
  player,
  flags,
  onChange,
}: {
  player: TradeRosterPlayer;
  flags: PlayerTradeFlags;
  onChange: (next: PlayerTradeFlags) => void;
}) {
  const patch = (next: Partial<PlayerTradeFlags>) => onChange({ ...flags, ...next });

  const checkbox = (key: "byc" | "twoWay" | "minimumContract", label: string, title: string) => (
    <label
      className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-muted"
      title={title}
    >
      <input
        type="checkbox"
        checked={!!flags[key]}
        onChange={(e) => patch({ [key]: e.target.checked })}
        className="h-3 w-3 accent-current"
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-2.5 border-t border-rule/60 bg-input/40 px-3 py-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="kicker text-text-faint">Trade kicker</span>
          <select
            value={flags.tradeBonusPct ?? 0}
            onChange={(e) => patch({ tradeBonusPct: Number(e.target.value) })}
            className="mt-1 w-full border border-rule bg-input px-2 py-1 text-[11px] text-text-primary outline-none transition-colors hover:border-border-hover"
          >
            {BONUS_STEPS.map((pct) => (
              <option key={pct} value={pct} className={OPTION_CLASS}>
                {pct === 0 ? "Aucun" : `${pct} % du salaire restant`}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="kicker text-text-faint">Restriction</span>
          <select
            value={flags.restriction ?? ""}
            onChange={(e) =>
              patch({ restriction: (e.target.value || undefined) as RestrictionKey | undefined })
            }
            className="mt-1 w-full border border-rule bg-input px-2 py-1 text-[11px] text-text-primary outline-none transition-colors hover:border-border-hover"
          >
            <option value="" className={OPTION_CLASS}>
              Aucune
            </option>
            {(Object.keys(RESTRICTIONS) as RestrictionKey[]).map((key) => (
              <option key={key} value={key} className={OPTION_CLASS}>
                {RESTRICTIONS[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {checkbox(
          "minimumContract",
          "Contrat au minimum",
          "Un contrat au minimum s'acquiert via son exception dédiée, sans concordance salariale. La détection automatique ne reconnaît que le minimum d'un rookie."
        )}
        {checkbox(
          "twoWay",
          "Contrat two-way",
          "Échangeable, mais hors concordance salariale et hors des quinze contrats standard."
        )}
        {checkbox(
          "byc",
          "Base year compensation",
          "Ré-signé avec une forte hausse par une équipe au-dessus du plafond : il part pour le plus élevé de son ancien salaire ou de la moitié du nouveau."
        )}
      </div>

      {flags.byc && (
        <label className="block">
          <span className="kicker text-text-faint">Salaire de la saison précédente</span>
          <input
            type="text"
            inputMode="numeric"
            value={flags.priorSalary ? String(flags.priorSalary) : ""}
            onChange={(e) => patch({ priorSalary: parseAmount(e.target.value) || undefined })}
            placeholder="Laissé vide : la moitié du nouveau salaire"
            className="mt-1 w-full border border-rule bg-input px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-faint outline-none transition-colors hover:border-border-hover"
          />
        </label>
      )}

      <label className="block">
        <span className="kicker text-text-faint">Poison pill — salaire compté à l&apos;arrivée</span>
        <input
          type="text"
          inputMode="numeric"
          value={flags.poisonPillIncoming ? String(flags.poisonPillIncoming) : ""}
          onChange={(e) => patch({ poisonPillIncoming: parseAmount(e.target.value) || undefined })}
          placeholder={`Extension rookie non entrée en vigueur — défaut ${formatMoney(player.salary ?? 0)}`}
          className="mt-1 w-full border border-rule bg-input px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-faint outline-none transition-colors hover:border-border-hover"
        />
      </label>
    </div>
  );
}

/** Résumé d'une ligne de clauses, pour ne pas avoir à ouvrir le panneau. */
function flagsSummary(flags: PlayerTradeFlags | undefined): string | null {
  if (!flags) return null;
  const parts: string[] = [];
  if (flags.tradeBonusPct) parts.push(`kicker ${flags.tradeBonusPct} %`);
  if (flags.restriction) parts.push(RESTRICTIONS[flags.restriction].label.toLowerCase());
  if (flags.byc) parts.push("BYC");
  if (flags.twoWay) parts.push("two-way");
  if (flags.minimumContract) parts.push("minimum");
  if (flags.poisonPillIncoming) parts.push("poison pill");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/* ─────────────────────── Lignes d'actifs ─────────────────────── */

/**
 * Un actif est visible deux fois — il part d'un panneau et arrive dans un autre.
 * Le survol allume les deux lignes à la fois : c'est ce qui permet de suivre un
 * joueur d'une colonne à l'autre sans lire les tricodes un par un.
 */
type Hover = { kind: "player"; id: number } | { kind: "pick"; id: string } | null;

function sameHover(a: Hover, b: Hover): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

/** Pastille du tour d'un pick : T1 en accent, T2 en neutre. */
function RoundBadge({ round }: { round: number }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center border font-mono text-[10px] font-bold ${
        round === 1 ? "border-accent text-accent-text" : "border-rule text-text-muted"
      }`}
    >
      T{round}
    </span>
  );
}

const ROW_BASE =
  "flex items-center gap-2 border-b border-rule/60 px-3 py-2 last:border-b-0 transition-colors";

function rowClass(highlighted: boolean): string {
  return `${ROW_BASE} ${highlighted ? "bg-accent-light" : ""}`;
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-6 w-6 shrink-0 items-center justify-center text-text-faint transition-colors hover:bg-input hover:text-red-500"
    >
      <X size={13} />
    </button>
  );
}

function PlayerRow({
  player,
  direction,
  counterparty,
  teams,
  flags,
  highlighted,
  onHover,
  onDestination,
  onRemove,
  onFlags,
}: {
  player: TradeRosterPlayer;
  direction: "out" | "in";
  /** Destination si le joueur part, provenance s'il arrive. */
  counterparty: string | undefined;
  teams: string[];
  flags: PlayerTradeFlags | undefined;
  highlighted: boolean;
  onHover: (h: Hover) => void;
  onDestination?: (to: string) => void;
  onRemove: () => void;
  onFlags: (next: PlayerTradeFlags) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = flagsSummary(flags);
  // Les clauses se déclarent une fois, du côté de l'équipe qui envoie le joueur :
  // les proposer aussi à l'arrivée ferait deux formulaires pour un seul contrat.
  const editable = direction === "out";

  return (
    <div
      className="border-b border-rule/60 last:border-b-0"
      onMouseEnter={() => onHover({ kind: "player", id: player.player_id })}
      onMouseLeave={() => onHover(null)}
    >
      <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${highlighted ? "bg-accent-light" : ""}`}>
        <img
          src={playerPhotoUrl(player.player_id)}
          alt=""
          className="h-8 w-8 shrink-0 bg-input object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <div className="min-w-0 flex-1">
          <Link
            href={`/joueurs/${player.player_id}`}
            className="block truncate text-xs font-semibold text-text-primary transition-colors hover:text-accent-text"
          >
            {shortName(player)}
          </Link>
          <p className="tnum kicker truncate text-text-faint">
            {player.salary != null ? formatMoney(player.salary) : "Contrat inconnu"}
            {summary && <span className="text-accent-text"> · {summary}</span>}
          </p>
        </div>

        {direction === "out" && onDestination ? (
          <DestinationSelect
            value={counterparty}
            from={player.team_tricode}
            teams={teams}
            label={`Destination de ${playerName(player)}`}
            onChange={onDestination}
          />
        ) : (
          <span className="flex shrink-0 items-center gap-1">
            {counterparty && <TeamChip tricode={counterparty} size={13} />}
            <ArrowDownLeft size={12} className="text-text-faint" />
          </span>
        )}

        {editable && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={`Clauses du contrat de ${playerName(player)}`}
            title="Clauses du contrat — trade kicker, restriction, BYC, two-way"
            className={`flex h-6 w-6 shrink-0 items-center justify-center transition-colors hover:bg-input ${
              summary ? "text-accent-text" : "text-text-faint hover:text-text-primary"
            }`}
          >
            <Settings2 size={13} />
          </button>
        )}

        <RemoveButton
          label={`Retirer ${playerName(player)} de l'échange`}
          onClick={onRemove}
        />
      </div>

      {editable && open && <FlagsEditor player={player} flags={flags ?? {}} onChange={onFlags} />}
    </div>
  );
}

function PickRow({
  pick,
  direction,
  holder,
  destination,
  teams,
  highlighted,
  onHover,
  onDestination,
  onRemove,
}: {
  pick: DraftPickAsset;
  direction: "out" | "in";
  /** Équipe qui cède le pick. */
  holder: string;
  destination?: string;
  teams: string[];
  highlighted: boolean;
  onHover: (h: Hover) => void;
  onDestination?: (to: string) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={rowClass(highlighted)}
      onMouseEnter={() => onHover({ kind: "pick", id: pick.id })}
      onMouseLeave={() => onHover(null)}
    >
      <RoundBadge round={pick.round} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-text-primary">{pickLabel(pick)}</p>
        {/* La provenance ne se dit que si elle diffère de l'expéditeur. */}
        <p className="kicker truncate text-text-faint">
          {pick.originalTeam === holder ? "Pick propre" : `Pick de ${pick.originalTeam}`}
        </p>
      </div>
      {direction === "out" && onDestination ? (
        <DestinationSelect
          value={destination}
          from={holder}
          teams={teams}
          label={`Destination du ${pickLabel(pick)}`}
          onChange={onDestination}
        />
      ) : (
        <span className="flex shrink-0 items-center gap-1">
          <TeamChip tricode={holder} size={13} />
          <ArrowDownLeft size={12} className="text-text-faint" />
        </span>
      )}
      <RemoveButton label={`Retirer le ${pickLabel(pick)} de l'échange`} onClick={onRemove} />
    </div>
  );
}

function CashRow({
  amount,
  counterparty,
  direction,
  onRemove,
}: {
  amount: number;
  counterparty: string;
  direction: "out" | "in";
  onRemove?: () => void;
}) {
  return (
    <div className={ROW_BASE}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-rule text-text-muted">
        <Banknote size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tnum truncate text-xs font-semibold text-text-primary">
          {formatMoney(amount)}
        </p>
        <p className="kicker text-text-faint">Cash</p>
      </div>
      <span className="flex shrink-0 items-center gap-1">
        {direction === "out" ? (
          <>
            <ArrowUpRight size={12} className="text-text-faint" />
            <TeamChip tricode={counterparty} size={13} />
          </>
        ) : (
          <>
            <TeamChip tricode={counterparty} size={13} />
            <ArrowDownLeft size={12} className="text-text-faint" />
          </>
        )}
      </span>
      {onRemove ? (
        <RemoveButton label={`Retirer le cash vers ${counterparty}`} onClick={onRemove} />
      ) : (
        <span className="w-6 shrink-0" />
      )}
    </div>
  );
}

/* ─────────────────────── Asset browser ─────────────────────── */

type BrowserTab = "players" | "picks" | "cash";

function AssetBrowser({
  tricode,
  teams,
  roster,
  movedIds,
  picks,
  pickedIds,
  amounts,
  thresholds,
  payrollBefore,
  season,
  onAddPlayer,
  onAddPick,
  onCash,
  cashByTarget,
}: {
  tricode: string;
  teams: string[];
  roster: TradeRosterPlayer[];
  movedIds: Set<number>;
  picks: DraftPickAsset[];
  pickedIds: Set<string>;
  amounts: TradeAmounts;
  thresholds: CapThresholds;
  payrollBefore: number;
  season: string;
  onAddPlayer: (p: TradeRosterPlayer) => void;
  onAddPick: (pick: DraftPickAsset) => void;
  onCash: (to: string, amount: number) => void;
  cashByTarget: Record<string, number>;
}) {
  const [tab, setTab] = useState<BrowserTab>("players");
  const [query, setQuery] = useState("");

  // Effectif restant, salaire décroissant (contrats inconnus en fin de liste).
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((p) => p.team_tricode === tricode && !movedIds.has(p.player_id))
      .filter((p) => !q || playerName(p).toLowerCase().includes(q))
      .sort((a, b) => (b.salary ?? -1) - (a.salary ?? -1));
  }, [roster, tricode, movedIds, query]);

  const ownedPicks = useMemo(
    () =>
      picks
        .filter((p) => p.owner === tricode && !pickedIds.has(p.id))
        .sort((a, b) => a.year - b.year || a.round - b.round),
    [picks, tricode, pickedIds]
  );

  const frozenYear = frozenPickYear(season);
  const overSecondApron = payrollBefore > thresholds.secondApron;

  const tabs: { key: BrowserTab; label: string; Icon: typeof Users; count?: number }[] = [
    { key: "players", label: "Joueurs", Icon: Users, count: available.length },
    { key: "picks", label: "Picks", Icon: Layers, count: ownedPicks.length },
    { key: "cash", label: "Cash", Icon: Banknote },
  ];

  return (
    <div>
      <p className="kicker border-b border-rule/60 px-4 py-2 text-text-faint">
        Ajouter depuis {tricode}
      </p>

      <div className="flex border-b border-rule">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-r border-rule px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors last:border-r-0 ${
              tab === t.key
                ? "bg-input text-text-primary"
                : "text-text-faint hover:bg-card-hover hover:text-text-muted"
            }`}
          >
            <t.Icon size={12} />
            {t.label}
            {t.count != null && <span className="tnum text-text-faint">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "players" && (
        <>
          <div className="relative border-b border-rule">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Rechercher dans l'effectif ${tricode}`}
              autoComplete="off"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs text-text-primary placeholder:text-text-faint outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {available.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-text-muted">
                {query ? "Aucun joueur ne correspond." : "Tout l'effectif est dans l'échange."}
              </p>
            ) : (
              available.map((p) => {
                const min = isMinimumContract(p, undefined, amounts);
                return (
                  <button
                    key={p.player_id}
                    type="button"
                    onClick={() => onAddPlayer(p)}
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
                      <p className="truncate text-xs font-medium text-text-primary">
                        {shortName(p)}
                      </p>
                      <p className="kicker text-text-faint">
                        {p.position || "N/A"} ·{" "}
                        <span className="tnum">{p.pts?.toFixed(1) ?? "—"}</span> pts
                        {min && <span className="text-accent-text"> · minimum</span>}
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
                );
              })
            )}
          </div>
        </>
      )}

      {tab === "picks" && (
        <div className="max-h-64 overflow-y-auto">
          {ownedPicks.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-text-muted">
              Tous les picks sont déjà dans l&apos;échange.
            </p>
          ) : (
            ownedPicks.map((pick) => {
              const frozen = pick.round === 1 && pick.year === frozenYear && overSecondApron;
              return (
                <button
                  key={pick.id}
                  type="button"
                  onClick={() => onAddPick(pick)}
                  className="group flex w-full items-center gap-2 border-b border-rule/60 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-card-hover"
                >
                  <RoundBadge round={pick.round} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {pickLabel(pick)}
                    </p>
                    <p className="kicker truncate text-text-faint">
                      {pick.originalTeam === tricode
                        ? "Pick propre"
                        : `Pick de ${pick.originalTeam}`}
                      {frozen && <span className="text-red-500"> · gelé, second apron</span>}
                    </p>
                  </div>
                  {frozen ? (
                    <Lock size={13} className="shrink-0 text-red-500" />
                  ) : (
                    <Plus
                      size={14}
                      className="shrink-0 text-text-faint transition-colors group-hover:text-accent-text"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {tab === "cash" && (
        <div className="space-y-2.5 px-3 py-3">
          {teams
            .filter((t) => t !== tricode)
            .map((target) => (
              <label key={target} className="flex items-center gap-2">
                <span className="flex w-20 shrink-0 items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <ArrowUpRight size={11} />
                  {target}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cashByTarget[target] ? String(cashByTarget[target]) : ""}
                  onChange={(e) => onCash(target, parseAmount(e.target.value))}
                  placeholder="0"
                  className="min-w-0 flex-1 border border-rule bg-input px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-faint outline-none transition-colors hover:border-border-hover"
                />
                <span className="tnum shrink-0 text-[11px] text-text-faint">
                  {formatMoney(cashByTarget[target] ?? 0)}
                </span>
              </label>
            ))}
          <p className="text-[11px] leading-snug text-text-faint">
            Plafond annuel : {formatMoney(amounts.cashLimit)} versés et, séparément, autant reçus. Le
            cash ne compte pas dans la concordance salariale.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Team panel ─────────────────────── */

function TeamPanel({
  summary,
  teams,
  roster,
  moves,
  pickMoves,
  picks,
  flags,
  cash,
  tradeException,
  thresholds,
  amounts,
  season,
  assetCount,
  hovered,
  errorCount,
  canRemove,
  onHover,
  onRemove,
  onTogglePlayer,
  onPlayerDestination,
  onPlayerFlags,
  onTogglePick,
  onPickDestination,
  onCash,
  onTradeException,
}: {
  summary: TeamTradeSummary;
  teams: string[];
  roster: TradeRosterPlayer[];
  moves: TradeMove[];
  pickMoves: PickMove[];
  picks: DraftPickAsset[];
  flags: Record<number, PlayerTradeFlags>;
  cash: CashMove[];
  tradeException: number;
  thresholds: CapThresholds;
  amounts: TradeAmounts;
  season: string;
  /** Actifs de l'échange qui touchent cette équipe — annoncé avant de la retirer. */
  assetCount: number;
  hovered: Hover;
  errorCount: number;
  canRemove: boolean;
  onHover: (h: Hover) => void;
  onRemove: () => void;
  onTogglePlayer: (p: TradeRosterPlayer) => void;
  onPlayerDestination: (playerId: number, to: string) => void;
  onPlayerFlags: (playerId: number, next: PlayerTradeFlags) => void;
  onTogglePick: (pick: DraftPickAsset) => void;
  onPickDestination: (pickId: string, to: string) => void;
  onCash: (from: string, to: string, amount: number) => void;
  onTradeException: (amount: number) => void;
}) {
  const movedIds = useMemo(() => new Set(moves.map((m) => m.playerId)), [moves]);
  const pickedIds = useMemo(() => new Set(pickMoves.map((m) => m.pickId)), [pickMoves]);
  const cashByTarget = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of cash) if (c.from === summary.tricode) map[c.to] = c.amount;
    return map;
  }, [cash, summary.tricode]);

  const outCash = cash.filter((c) => c.from === summary.tricode && c.amount > 0);
  const inCash = cash.filter((c) => c.to === summary.tricode && c.amount > 0);

  const netSalary = summary.incomingPayrollImpact - summary.outgoingPayrollImpact;
  const statusAfter = capStatus(summary.payrollAfter, thresholds);
  const localIssues = summary.issues.filter((i) => i.level !== "error");

  const outCount = summary.outgoing.length + summary.outgoingPicks.length + outCash.length;
  const inCount = summary.incoming.length + summary.incomingPicks.length + inCash.length;
  const empty = outCount === 0 && inCount === 0;

  const removeTitle =
    assetCount > 0
      ? `Retirer ${summary.tricode} — ${assetCount} ${plural(assetCount, "actif")} ${plural(assetCount, "quittera", "quitteront")} l'échange (annulable)`
      : `Retirer ${summary.tricode} de l'échange`;

  return (
    <div className={`flex flex-col border bg-card ${errorCount > 0 ? "border-red-500/60" : "border-rule"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <img src={teamLogoUrl(summary.tricode)} alt="" className="h-9 w-9 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg uppercase leading-none text-text-primary">
            {summary.tricode}
          </p>
          <p className="kicker mt-0.5 truncate text-text-faint">
            {summary.city} {summary.name}
          </p>
        </div>

        {/* Chaque panneau dit son propre état : avec cinq équipes, remonter au
            bandeau pour savoir laquelle bloque est une gymnastique inutile. */}
        {errorCount > 0 && (
          <span
            className="flex shrink-0 items-center gap-1 border border-red-500 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-500"
            title={`${errorCount} règle${errorCount > 1 ? "s" : ""} enfreinte${errorCount > 1 ? "s" : ""}`}
          >
            <AlertTriangle size={9} />
            <span className="tnum">{errorCount}</span>
          </span>
        )}
        {summary.hardCap && (
          <span
            className="flex shrink-0 items-center gap-1 border border-amber-500 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-500"
            title={`Hard cap au ${summary.hardCap === "first" ? "premier" : "second"} apron : ${summary.hardCapReasons.join(", ")}`}
          >
            <Lock size={9} />
            {summary.hardCap === "first" ? "A1" : "A2"}
          </span>
        )}
        <span
          className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${statusAfter.badge}`}
        >
          {statusAfter.label}
        </span>

        {canRemove && (
          // Détaché des badges par une règle verticale : c'est le seul geste
          // destructeur du panneau, il ne doit pas se confondre avec eux.
          <span className="ml-1 flex shrink-0 items-center border-l border-rule pl-2">
            <button
              type="button"
              onClick={onRemove}
              aria-label={removeTitle}
              title={removeTitle}
              className="flex h-7 w-7 items-center justify-center text-text-faint transition-colors hover:bg-input hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>

      {/* Un seul bloc de chiffres : les flux, la masse, l'échelle et les marges. */}
      <div className="border-t border-rule px-4 py-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              label: "Sortant",
              value: formatMoney(summary.outgoingPayrollImpact),
              tone: "text-text-primary",
            },
            {
              label: "Entrant",
              value: formatMoney(summary.incomingPayrollImpact),
              tone: "text-text-primary",
            },
            { label: "Écart", value: formatMoneyDelta(netSalary), tone: deltaColor(netSalary, false) },
            {
              label: "Masse après",
              value: formatMoney(summary.payrollAfter),
              tone: statusAfter.color,
            },
          ].map((c) => (
            <div key={c.label}>
              <p className="kicker text-text-faint">{c.label}</p>
              <p className={`tnum mt-0.5 text-sm font-bold ${c.tone}`}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3">
          <CapLadder payroll={summary.payrollAfter} thresholds={thresholds} />
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <span className="kicker text-text-faint">
            Marge A1{" "}
            <span
              className={`tnum ${summary.firstApronRoomAfter < 0 ? "text-red-500" : "text-text-secondary"}`}
            >
              {formatMoneyDelta(summary.firstApronRoomAfter)}
            </span>
          </span>
          <span className="kicker text-text-faint">
            Marge A2{" "}
            <span
              className={`tnum ${summary.secondApronRoomAfter < 0 ? "text-red-500" : "text-text-secondary"}`}
            >
              {formatMoneyDelta(summary.secondApronRoomAfter)}
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

      {/* Ce que l'équipe envoie. Un liseré rouge à gauche, une flèche montante :
          la direction se lit sans lire le titre. */}
      {outCount > 0 && (
        <div className="border-t border-rule border-l-2 border-l-red-500/50">
          <p className="kicker flex items-center gap-1.5 border-b border-rule/60 px-4 py-2 text-text-faint">
            <ArrowUpRight size={11} className="text-red-500" />
            Envoie · <span className="tnum">{outCount}</span>
          </p>
          {summary.outgoing.map((p) => (
            <PlayerRow
              key={p.player_id}
              player={p}
              direction="out"
              counterparty={moves.find((m) => m.playerId === p.player_id)?.to}
              teams={teams}
              flags={flags[p.player_id]}
              highlighted={sameHover(hovered, { kind: "player", id: p.player_id })}
              onHover={onHover}
              onDestination={(to) => onPlayerDestination(p.player_id, to)}
              onRemove={() => onTogglePlayer(p)}
              onFlags={(next) => onPlayerFlags(p.player_id, next)}
            />
          ))}
          {summary.outgoingPicks.map((pick) => (
            <PickRow
              key={pick.id}
              pick={pick}
              direction="out"
              holder={summary.tricode}
              destination={pickMoves.find((m) => m.pickId === pick.id)?.to}
              teams={teams}
              highlighted={sameHover(hovered, { kind: "pick", id: pick.id })}
              onHover={onHover}
              onDestination={(to) => onPickDestination(pick.id, to)}
              onRemove={() => onTogglePick(pick)}
            />
          ))}
          {outCash.map((c) => (
            <CashRow
              key={`${c.from}-${c.to}`}
              amount={c.amount}
              counterparty={c.to}
              direction="out"
              onRemove={() => onCash(c.from, c.to, 0)}
            />
          ))}
        </div>
      )}

      {/* Ce que l'équipe reçoit. Fond accentué, liseré vert, flèche descendante. */}
      {inCount > 0 && (
        <div className="border-t border-rule border-l-2 border-l-emerald-500/50 bg-accent-light/30">
          <p className="kicker flex items-center gap-1.5 border-b border-rule/60 px-4 py-2 text-accent-text">
            <ArrowDownLeft size={11} className="text-emerald-500" />
            Reçoit · <span className="tnum">{inCount}</span>
          </p>
          {summary.incoming.map((p) => (
            <PlayerRow
              key={p.player_id}
              player={p}
              direction="in"
              counterparty={p.team_tricode}
              teams={teams}
              flags={flags[p.player_id]}
              highlighted={sameHover(hovered, { kind: "player", id: p.player_id })}
              onHover={onHover}
              onRemove={() => onTogglePlayer(p)}
              onFlags={(next) => onPlayerFlags(p.player_id, next)}
            />
          ))}
          {summary.incomingPicks.map((pick) => (
            <PickRow
              key={pick.id}
              pick={pick}
              direction="in"
              holder={pick.owner}
              teams={teams}
              highlighted={sameHover(hovered, { kind: "pick", id: pick.id })}
              onHover={onHover}
              onRemove={() => onTogglePick(pick)}
            />
          ))}
          {inCash.map((c) => (
            <CashRow
              key={`${c.from}-${c.to}`}
              amount={c.amount}
              counterparty={c.from}
              direction="in"
            />
          ))}
        </div>
      )}

      {/* Rien encore : le dire vaut mieux qu'un blanc entre deux blocs. */}
      {empty && (
        <p className="border-t border-rule px-4 py-3 text-xs text-text-muted">
          {summary.tricode} n&apos;a rien dans l&apos;échange — choisissez ci-dessous ce qu&apos;elle
          envoie.
        </p>
      )}

      {/* Le raisonnement salarial, replié : la ligne de résumé suffit le plus souvent. */}
      <Collapsible
        title="Concordance salariale"
        summary={
          <>
            {formatMoney(summary.incomingAllowance)} entrant max
            {summary.tradeExceptionUsed > 0 && " · TPE"}
          </>
        }
      >
        <ul className="space-y-1.5 px-4 py-2.5">
          {summary.paths.map((path) => {
            const chosen = path.key === summary.matchRule.key;
            return (
              <li key={path.key} className="flex items-start gap-2 text-[11px] leading-snug">
                <CircleDot
                  size={11}
                  className={`mt-0.5 shrink-0 ${chosen ? "text-accent-text" : "text-text-faint"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={chosen ? "text-text-primary" : "text-text-muted"}>
                    {path.label}
                  </span>
                  {path.blockedBy && <span className="text-text-faint"> — {path.blockedBy}</span>}
                  {path.hardCap === "first" && !path.blockedBy && (
                    <span className="text-amber-500"> — hard cap au premier apron</span>
                  )}
                </span>
                <span
                  className={`tnum shrink-0 ${chosen ? "font-bold text-text-primary" : "text-text-faint"}`}
                >
                  {formatMoney(path.limit)}
                </span>
              </li>
            );
          })}
          {summary.exemptIncoming > 0 && (
            <li className="flex items-start gap-2 border-t border-rule/60 pt-1.5 text-[11px] leading-snug">
              <CircleDot size={11} className="mt-0.5 shrink-0 text-accent-text" />
              <span className="min-w-0 flex-1 text-text-muted">
                Hors concordance : contrats au minimum et two-way
              </span>
              <span className="tnum shrink-0 text-text-faint">
                {formatMoney(summary.exemptIncoming)}
              </span>
            </li>
          )}
        </ul>

        {/* La trade exception vit ici : c'est elle qui déplace le plafond entrant. */}
        <label className="flex items-center gap-2 border-t border-rule/60 px-4 py-2.5">
          <span className="kicker shrink-0 text-text-faint">Trade exception</span>
          <input
            type="text"
            inputMode="numeric"
            value={tradeException ? String(tradeException) : ""}
            onChange={(e) => onTradeException(parseAmount(e.target.value))}
            placeholder="Aucune — à saisir, aucune source ne les publie"
            className="min-w-0 flex-1 border border-rule bg-input px-2 py-1 font-mono text-[11px] text-text-primary placeholder:text-text-faint outline-none transition-colors hover:border-border-hover"
          />
          {tradeException > 0 && (
            <span className="tnum shrink-0 text-[11px] text-text-faint">
              {formatMoney(tradeException)}
            </span>
          )}
        </label>
      </Collapsible>

      {/* Remarques propres à l'équipe */}
      {localIssues.length > 0 && (
        <Collapsible
          title="Remarques"
          summary={`${localIssues.length}`}
          accent={localIssues.some((i) => i.level === "warning") ? "text-amber-500" : undefined}
        >
          <ul className="space-y-1.5 px-4 py-2.5">
            {localIssues.map((issue, i) => (
              <li key={i} className="flex gap-2 text-[11px] leading-snug">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 ${ISSUE_DOT[issue.level]}`} />
                <span className={ISSUE_TEXT[issue.level]}>{issue.message}</span>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      {/* Le geste principal reste ouvert, et poussé en bas de colonne : on y
          revient à chaque ajout, autant qu'il soit toujours au même endroit. */}
      <div className="mt-auto border-t border-rule">
        <AssetBrowser
          tricode={summary.tricode}
          teams={teams}
          roster={roster}
          movedIds={movedIds}
          picks={picks}
          pickedIds={pickedIds}
          amounts={amounts}
          thresholds={thresholds}
          payrollBefore={summary.payrollBefore}
          season={season}
          onAddPlayer={onTogglePlayer}
          onAddPick={onTogglePick}
          onCash={(to, amount) => onCash(summary.tricode, to, amount)}
          cashByTarget={cashByTarget}
        />
      </div>
    </div>
  );
}

/* ─────────────────────── Balance ─────────────────────── */

/**
 * Bilan de l'échange, en deux tableaux plutôt qu'un.
 *
 * Onze colonnes côte à côte ne se lisaient pas, et débordaient. L'argent d'un
 * côté, le sportif de l'autre : chacun tient dans la largeur, et on compare
 * vraiment.
 */
function BalanceTables({
  summaries,
  statsFromSeason,
  thresholds,
}: {
  summaries: TeamTradeSummary[];
  statsFromSeason?: string | null;
  thresholds: CapThresholds;
}) {
  const th = "px-3 py-2.5 kicker text-text-faint whitespace-nowrap";
  const teamCell = (tricode: string) => (
    <td className="px-3 py-2.5">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <img src={teamLogoUrl(tricode)} alt="" className="h-5 w-5 object-contain" />
        <span className="font-display text-sm uppercase text-text-primary">{tricode}</span>
      </div>
    </td>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Finances */}
      <div className="border border-rule bg-card">
        <p className="kicker border-b border-rule px-4 py-3 text-text-faint">Bilan financier</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className={`${th} text-left`}>Équipe</th>
                <th className={`${th} text-right`}>Salaire net</th>
                <th className={`${th} text-right`}>Masse après</th>
                <th className={`${th} text-center`}>Statut</th>
                <th className={`${th} text-center`}>Picks</th>
                <th className={`${th} text-right`}>Cash</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const netSalary = s.incomingPayrollImpact - s.outgoingPayrollImpact;
                const netPicks = s.incomingPicks.length - s.outgoingPicks.length;
                const netCash = s.cashIn - s.cashOut;
                const status = capStatus(s.payrollAfter, thresholds);
                return (
                  <tr
                    key={s.tricode}
                    className="border-b border-rule transition-colors last:border-b-0 hover:bg-card-hover"
                  >
                    {teamCell(s.tricode)}
                    <td
                      className={`tnum px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap ${deltaColor(netSalary, false)}`}
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
                    <td className={`tnum px-3 py-2.5 text-center text-xs ${deltaColor(netPicks)}`}>
                      {netPicks > 0 ? "+" : ""}
                      {netPicks}
                    </td>
                    <td
                      className={`tnum px-3 py-2.5 text-right text-xs whitespace-nowrap ${deltaColor(netCash)}`}
                    >
                      {netCash === 0 ? "—" : formatMoneyDelta(netCash)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sportif */}
      <div className="border border-rule bg-card">
        <p className="kicker border-b border-rule px-4 py-3 text-text-faint">Bilan sportif</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className={`${th} text-left`}>Équipe</th>
                <th className={`${th} text-right`}>PTS</th>
                <th className={`${th} text-right`}>REB</th>
                <th className={`${th} text-right`}>AST</th>
                <th className={`${th} text-right`}>Indice prod.</th>
                <th className={`${th} text-right`}>Âge moyen</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const nets = [s.ptsIn - s.ptsOut, s.rebIn - s.rebOut, s.astIn - s.astOut];
                const netProd = s.productionIn - s.productionOut;
                const ageDelta =
                  s.ageBefore != null && s.ageAfter != null ? s.ageAfter - s.ageBefore : null;
                return (
                  <tr
                    key={s.tricode}
                    className="border-b border-rule transition-colors last:border-b-0 hover:bg-card-hover"
                  >
                    {teamCell(s.tricode)}
                    {nets.map((v, i) => (
                      <td key={i} className={`tnum px-3 py-2.5 text-right text-xs ${deltaColor(v)}`}>
                        {v > 0 ? "+" : ""}
                        {v.toFixed(1)}
                      </td>
                    ))}
                    <td
                      className={`tnum px-3 py-2.5 text-right text-xs font-bold ${deltaColor(netProd)}`}
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
          Variation du total des moyennes par match des joueurs échangés. Indice de production = PTS
          + 1,2 × REB + 1,5 × AST — repère indicatif, pas une valeur de marché.
          {statsFromSeason && <> Moyennes {statsFromSeason}.</>}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── Rules panel ─────────────────────── */

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-accent" />
      <span>{children}</span>
    </li>
  );
}

function Amounts({ items }: { items: { label: string; val: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((t) => (
        <div key={t.label} className="border border-rule px-3 py-2">
          <p className="kicker text-text-faint">{t.label}</p>
          <p className="tnum mt-0.5 text-sm font-bold text-text-primary">{formatMoney(t.val)}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Les règles, rubrique par rubrique et chacune repliable.
 *
 * Le texte est long parce que la convention l'est ; le lire d'un bloc n'aidait
 * personne. On ouvre la rubrique qui intéresse.
 */
function RulesPanel({
  season,
  thresholds,
  amounts,
}: {
  season: string;
  thresholds: SeasonThresholds;
  amounts: TradeAmounts;
}) {
  return (
    <div className="border border-rule bg-card">
      <p className="kicker px-4 py-3 text-text-faint">
        Règles appliquées · Convention 2023 · Saison {season}
      </p>

      <Collapsible title="Seuils et montants" summary={`Cap ${formatMoney(thresholds.salaryCap)}`}>
        <div className="space-y-3 px-4 py-3">
          <Amounts
            items={[
              { label: "Salary Cap", val: thresholds.salaryCap },
              { label: "Luxury Tax", val: thresholds.luxuryTax },
              { label: "1er Apron", val: thresholds.firstApron },
              { label: "2nd Apron", val: thresholds.secondApron },
            ]}
          />
          <Amounts
            items={[
              { label: "Marge de concordance", val: TRADE_CUSHION },
              { label: "Exception élargie", val: amounts.expandedTpe },
              { label: "Cash / saison", val: amounts.cashLimit },
              { label: "Minimum rookie", val: amounts.rookieMinimum },
            ]}
          />
          {thresholds.isEstimated && (
            <p className="text-[11px] leading-snug text-amber-500">
              Montants estimés : la ligue n&apos;a pas encore publié ses seuils pour {season}. La
              projection applique la hausse maximale prévue par la convention, soit 10 % par an. Les
              verdicts sont donc indicatifs près des lignes.
            </p>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Concordance salariale" summary="Trois tranches, plus les exceptions">
        <ul className="space-y-1.5 px-4 py-3 text-sm text-text-muted">
          <Bullet>
            Sous le plafond après l&apos;échange : l&apos;équipe absorbe le salaire entrant dans son
            espace disponible, plus {formatMoney(TRADE_CUSHION)}.
          </Bullet>
          <Bullet>
            Sous les deux aprons : trois tranches, selon le salaire envoyé — 200 % +{" "}
            {formatMoney(TRADE_CUSHION)} pour les petits contrats, salaire sortant +{" "}
            {formatMoney(amounts.expandedTpe)} au milieu, 125 % + {formatMoney(TRADE_CUSHION)} pour
            les gros. Les bornes tombent là où les formules se croisent, si bien que le barème est
            continu.
          </Bullet>
          <Bullet>
            Aller au-delà de 125 % emploie l&apos;exception élargie, et pose un hard cap au premier
            apron pour le reste de la saison.
          </Bullet>
          <Bullet>
            Au-dessus du premier apron après l&apos;échange : dollar pour dollar, pas un centime de
            plus que ce qui sort. Corollaire : aucune tranche ne peut faire franchir cette ligne.
          </Bullet>
          <Bullet>
            Un contrat au minimum s&apos;acquiert par son exception dédiée, hors concordance. Idem
            pour un contrat two-way, qui ne compte ni au départ ni à l&apos;arrivée.
          </Bullet>
        </ul>
      </Collapsible>

      <Collapsible title="Aprons et hard cap" summary="Ce que le second apron interdit">
        <ul className="space-y-1.5 px-4 py-3 text-sm text-text-muted">
          <Bullet>
            Second apron : interdiction d&apos;agréger plusieurs contrats sortants pour absorber un
            salaire entrant.
          </Bullet>
          <Bullet>Second apron : interdiction de verser du cash.</Bullet>
          <Bullet>
            Second apron : le pick de premier tour situé sept ans plus loin (
            {frozenPickYear(season)}) est gelé.
          </Bullet>
          <Bullet>
            Agréger des contrats ou verser du cash pose un hard cap au second apron pour toute
            équipe, même celle qui était en dessous.
          </Bullet>
        </ul>
      </Collapsible>

      <Collapsible title="Picks" summary={`Jusqu'à ${lastTradeableDraftYear(season)}`}>
        <ul className="space-y-1.5 px-4 py-3 text-sm text-text-muted">
          <Bullet>Règle des sept ans : rien au-delà de {lastTradeableDraftYear(season)}.</Bullet>
          <Bullet>
            Règle Stepien : jamais deux drafts consécutives sans pick de premier tour. Détenir celui
            d&apos;une autre franchise suffit à régulariser.
          </Bullet>
          <Bullet>
            Le stock de départ est reconstitué — chaque franchise avec ses deux picks sur les{" "}
            {DRAFT_HORIZON} drafts, {tradeableDraftYears(season)[0]} à{" "}
            {lastTradeableDraftYear(season)} — faute de source publiant la propriété réelle, ses
            protections et ses droits de swap. La mécanique des règles, elle, est exacte.
          </Bullet>
        </ul>
      </Collapsible>

      <Collapsible title="Cash" summary={formatMoney(amounts.cashLimit)}>
        <p className="px-4 py-3 text-sm text-text-muted">
          Une équipe peut verser {formatMoney(amounts.cashLimit)} et en recevoir autant sur une
          saison, les deux compteurs étant indépendants. Le montant ne compte pas dans la concordance
          salariale. Le moteur suppose les compteurs vierges : il ne sait pas ce que chaque équipe a
          déjà versé cette saison.
        </p>
      </Collapsible>

      <Collapsible title="Clauses de contrat" summary="À déclarer à la main">
        <div className="px-4 py-3 text-sm text-text-muted">
          <p className="mb-2">
            Aucune source automatisable ne publie ces clauses : elles se déclarent contrat par
            contrat, via l&apos;engrenage à côté de chaque joueur envoyé.
          </p>
          <ul className="space-y-1.5">
            <Bullet>
              Trade kicker, jusqu&apos;à {MAX_TRADE_BONUS_PCT} % du salaire restant : l&apos;équipe
              qui reçoit le joueur le compte majoré d&apos;autant, sans dépasser le salaire maximal.
            </Bullet>
            <Bullet>
              Base year compensation : le joueur part pour le plus élevé de son ancien salaire ou de
              la moitié du nouveau, alors que celle qui le reçoit le compte plein.
            </Bullet>
            <Bullet>
              Poison pill : une extension rookie non entrée en vigueur s&apos;acquiert à la moyenne
              des années à venir.
            </Bullet>
            <Bullet>
              Délais de carence — 15 décembre, 15 janvier, trois mois, six mois — et clauses de
              non-échange, qui rendent l&apos;échange conditionnel à l&apos;accord du joueur.
            </Bullet>
          </ul>
        </div>
      </Collapsible>

      <Collapsible title="Effectifs, fenêtre et limites" summary="Ce qui n'est pas couvert">
        <div className="space-y-3 px-4 py-3 text-sm text-text-muted">
          <p>
            Limite de {ROSTER_MAX} contrats standard, minimum de {ROSTER_MIN} — treize étant toléré
            deux semaines. Les effectifs listés ici recensent tous les joueurs passés par la
            franchise sur la saison : les écarts de limite ne sont signalés que si l&apos;échange en
            est la cause. Rien ne se signe entre la trade deadline et la fin de la saison.
          </p>
          <p>
            Non pris en compte : les exceptions mi-niveau et bi-annuelles employées dans un échange,
            les sign-and-trades, les protections et droits de swap sur les picks, le détail des
            minimums vétérans, et l&apos;origine d&apos;une trade exception — une équipe au-dessus du
            premier apron ne peut pas se servir de celle créée la saison précédente. Les masses
            salariales proviennent des contrats de l&apos;effectif et incluent le dead money quand la
            donnée est disponible.
          </p>
        </div>
      </Collapsible>
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
  initialPickMoves,
  initialCash,
  initialFlags,
  initialTradeExceptions,
  statsFromSeason,
  thresholds,
  window: tradeWindow,
}: Props) {
  const { draft, commit, undo, redo, canUndo, canRedo } = useTradeHistory({
    teams: initialTeams,
    moves: initialMoves,
    pickMoves: initialPickMoves,
    cash: initialCash,
    flags: initialFlags,
    tradeExceptions: initialTradeExceptions,
  });
  const { teams, moves, pickMoves, cash, flags, tradeExceptions } = draft;

  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState<Hover>(null);

  // Ctrl+Z / Ctrl+Maj+Z, le réflexe de tout éditeur. On ne l'intercepte pas
  // pendant une saisie : dans un champ de recherche ou de montant, l'annulation
  // du navigateur est celle que l'utilisateur attend.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Toutes les franchises présentes dans les effectifs, pour le sélecteur.
  const allTeams = useMemo(() => {
    const map = new Map<string, TeamOption>();
    for (const p of roster) {
      if (!map.has(p.team_tricode)) {
        map.set(p.team_tricode, { tricode: p.team_tricode, city: p.team_city, name: p.team_name });
      }
    }
    return [...map.values()].sort((a, b) => a.tricode.localeCompare(b.tricode));
  }, [roster]);

  // Stock de picks reconstitué côté client : le déduire des effectifs évite
  // d'expédier quatre cents objets dans le HTML de la page.
  const picks = useMemo(
    () => buildPickInventory(allTeams.map((t) => t.tricode), season),
    [allTeams, season]
  );

  /* ── Actions ── */

  const addTeam = useCallback(
    (tricode: string) => {
      commit((d) =>
        d.teams.includes(tricode) || d.teams.length >= MAX_TEAMS
          ? d
          : { ...d, teams: [...d.teams, tricode] }
      );
      setAdding(false);
    },
    [commit]
  );

  const removeTeam = useCallback(
    (tricode: string) => {
      // Retirer une équipe emporte tout ce qui la touchait, y compris les
      // mouvements que les autres avaient vers elle. C'est ce que l'historique
      // rend acceptable : un Ctrl+Z et l'échange revient.
      commit((d) => ({
        ...d,
        teams: d.teams.filter((t) => t !== tricode),
        moves: d.moves.filter((m) => m.from !== tricode && m.to !== tricode),
        pickMoves: d.pickMoves.filter((m) => m.from !== tricode && m.to !== tricode),
        cash: d.cash.filter((c) => c.from !== tricode && c.to !== tricode),
        tradeExceptions: Object.fromEntries(
          Object.entries(d.tradeExceptions).filter(([t]) => t !== tricode)
        ),
      }));
    },
    [commit]
  );

  const togglePlayer = useCallback(
    (p: TradeRosterPlayer) => {
      commit((d) => {
        if (d.moves.some((m) => m.playerId === p.player_id)) {
          return { ...d, moves: d.moves.filter((m) => m.playerId !== p.player_id) };
        }
        const to = defaultDestination(p.team_tricode, d.teams);
        if (!to) return d;
        return {
          ...d,
          moves: [...d.moves, { playerId: p.player_id, from: p.team_tricode, to }],
        };
      });
    },
    [commit]
  );

  const setPlayerDestination = useCallback(
    (playerId: number, to: string) => {
      commit((d) => ({
        ...d,
        moves: d.moves.map((m) => (m.playerId === playerId ? { ...m, to } : m)),
      }));
    },
    [commit]
  );

  const setPlayerFlags = useCallback(
    (playerId: number, next: PlayerTradeFlags) => {
      commit((d) => {
        // Une déclaration vidée disparaît : l'URL de partage reste courte.
        const cleaned = Object.fromEntries(
          Object.entries(next).filter(([, v]) => v !== undefined && v !== false && v !== 0)
        ) as PlayerTradeFlags;
        const rest = Object.fromEntries(
          Object.entries(d.flags).filter(([id]) => Number(id) !== playerId)
        );
        return {
          ...d,
          flags:
            Object.keys(cleaned).length === 0 ? rest : { ...rest, [playerId]: cleaned },
        };
      });
    },
    [commit]
  );

  const togglePick = useCallback(
    (pick: DraftPickAsset) => {
      commit((d) => {
        if (d.pickMoves.some((m) => m.pickId === pick.id)) {
          return { ...d, pickMoves: d.pickMoves.filter((m) => m.pickId !== pick.id) };
        }
        const to = defaultDestination(pick.owner, d.teams);
        if (!to) return d;
        return { ...d, pickMoves: [...d.pickMoves, { pickId: pick.id, from: pick.owner, to }] };
      });
    },
    [commit]
  );

  const setPickDestination = useCallback(
    (pickId: string, to: string) => {
      commit((d) => ({
        ...d,
        pickMoves: d.pickMoves.map((m) => (m.pickId === pickId ? { ...m, to } : m)),
      }));
    },
    [commit]
  );

  const setCashAmount = useCallback(
    (from: string, to: string, amount: number) => {
      commit((d) => {
        const rest = d.cash.filter((c) => !(c.from === from && c.to === to));
        return { ...d, cash: amount > 0 ? [...rest, { from, to, amount }] : rest };
      });
    },
    [commit]
  );

  const setTradeException = useCallback(
    (tricode: string, amount: number) => {
      commit((d) => {
        const rest = Object.fromEntries(
          Object.entries(d.tradeExceptions).filter(([t]) => t !== tricode)
        );
        return { ...d, tradeExceptions: amount > 0 ? { ...rest, [tricode]: amount } : rest };
      });
    },
    [commit]
  );

  /** Vide l'échange sans toucher aux équipes : on garde le plateau, on rejoue. */
  const clearAssets = useCallback(() => {
    commit((d) => ({ ...d, moves: [], pickMoves: [], cash: [], flags: {} }));
    setCopied(false);
  }, [commit]);

  const copyLink = useCallback(async () => {
    const query = encodeTrade(teams, moves, { pickMoves, cash, flags, tradeExceptions });
    const url = `${globalThis.location.origin}${globalThis.location.pathname}${query ? `?${query}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Presse-papiers indisponible : on remplace l'URL, l'utilisateur peut la copier.
      globalThis.history.replaceState(null, "", url);
    }
  }, [teams, moves, pickMoves, cash, flags, tradeExceptions]);

  /* ── Évaluation ── */

  const evaluation = useMemo(
    () =>
      evaluateTrade({
        season,
        teams,
        moves,
        roster,
        payrollBase,
        flags,
        pickMoves,
        picks,
        cash,
        tradeExceptions,
        window: tradeWindow,
        thresholds,
      }),
    [
      season,
      teams,
      moves,
      roster,
      payrollBase,
      flags,
      pickMoves,
      picks,
      cash,
      tradeExceptions,
      tradeWindow,
      thresholds,
    ]
  );

  // Le bandeau porte les erreurs ; sans erreur il remonte les avertissements,
  // sinon un verdict « incomplet » ou « sous conditions » resterait muet.
  const bannerIssues = useMemo(() => {
    const all = [...evaluation.globalIssues, ...evaluation.teams.flatMap((t) => t.issues)];
    const errors = all.filter((i) => i.level === "error");
    return errors.length > 0 ? errors : all.filter((i) => i.level === "warning");
  }, [evaluation]);

  const assetCount = moves.length + pickMoves.length + cash.filter((c) => c.amount > 0).length;
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

  /* ── Écran de départ ── */

  // Sans équipe, la page n'a qu'une chose à proposer : en choisir une. Tout le
  // reste — barre d'outils, verdict vide, règles — ne ferait que brouiller.
  if (teams.length === 0) {
    return (
      <div className="space-y-5">
        <div className="border border-rule bg-card px-5 py-6 text-center sm:px-6">
          <ArrowLeftRight size={24} className="mx-auto text-accent" />
          <h2 className="mt-3 font-display text-xl uppercase leading-none text-text-primary sm:text-2xl">
            Composez un échange
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-text-muted">
            Choisissez une première franchise, puis une deuxième. Vous pourrez ensuite y placer des
            joueurs, des picks et du cash — et voir en direct ce que la convention collective en
            dit.
          </p>
        </div>
        <TeamPicker teams={allTeams} taken={teams} layout="grid" onSelect={addTeam} />
        <RulesPanel season={season} thresholds={thresholds} amounts={evaluation.amounts} />
      </div>
    );
  }

  /* ── Rendu ── */

  const canAddTeam = teams.length < MAX_TEAMS;

  return (
    <div className="space-y-5">
      {/* Trade window */}
      {!tradeWindow.open && (
        <div className="flex items-start gap-3 border border-amber-500/60 bg-card px-4 py-3 text-sm text-text-muted">
          <Lock size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{tradeWindow.label}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex">
          <ToolbarButton
            onClick={undo}
            disabled={!canUndo}
            title="Annuler la dernière action"
          >
            <Undo2 size={13} />
            Annuler
          </ToolbarButton>
          <span className="-ml-px">
            <ToolbarButton onClick={redo} disabled={!canRedo} title="Rétablir">
              <Redo2 size={13} />
            </ToolbarButton>
          </span>
        </div>

        <ToolbarButton
          onClick={clearAssets}
          disabled={assetCount === 0}
          title="Retirer tous les actifs, en gardant les équipes"
        >
          <Trash2 size={13} />
          Vider
        </ToolbarButton>

        <ToolbarButton onClick={copyLink} title="Copier un lien vers cet échange">
          <Link2 size={13} />
          {copied ? "Lien copié" : "Partager"}
        </ToolbarButton>

        {assetCount > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="kicker text-text-faint">
              <span className="tnum text-text-secondary">{moves.length}</span>{" "}
              {plural(moves.length, "joueur")}
              {pickMoves.length > 0 && (
                <>
                  {" · "}
                  <span className="tnum text-text-secondary">{pickMoves.length}</span>{" "}
                  {plural(pickMoves.length, "pick")}
                </>
              )}
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

      {/* Un échange à une équipe n'a pas de verdict à rendre : la seule chose à
          dire est qu'il manque une contrepartie. Empiler là-dessus un bandeau
          « échange vide » et un reproche « sélectionnez deux équipes » revenait à
          dire trois fois la même chose. */}
      {teams.length === 1 ? (
        <div className="flex items-center gap-3 border border-rule bg-card px-4 py-3 text-sm text-text-muted">
          <ArrowLeftRight size={16} className="shrink-0 text-accent" />
          Ajoutez une deuxième équipe pour composer l&apos;échange.
        </div>
      ) : (
        <VerdictBanner verdict={evaluation.verdict} issues={bannerIssues} />
      )}

      {/* Panneaux, plus le créneau d'ajout à la suite : la nouvelle équipe
          apparaît exactement là où l'on a cliqué. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {evaluation.teams.map((summary) => (
          <TeamPanel
            key={summary.tricode}
            summary={summary}
            teams={teams}
            roster={roster}
            moves={moves}
            pickMoves={pickMoves}
            picks={picks}
            flags={flags}
            cash={cash}
            tradeException={tradeExceptions[summary.tricode] ?? 0}
            thresholds={evaluation.thresholds}
            amounts={evaluation.amounts}
            season={season}
            assetCount={assetsInvolving(draft, summary.tricode)}
            hovered={hovered}
            errorCount={summary.issues.filter((i) => i.level === "error").length}
            canRemove
            onHover={setHovered}
            onRemove={() => removeTeam(summary.tricode)}
            onTogglePlayer={togglePlayer}
            onPlayerDestination={setPlayerDestination}
            onPlayerFlags={setPlayerFlags}
            onTogglePick={togglePick}
            onPickDestination={setPickDestination}
            onCash={setCashAmount}
            onTradeException={(amount) => setTradeException(summary.tricode, amount)}
          />
        ))}

        {canAddTeam &&
          (adding ? (
            <TeamPicker
              teams={allTeams}
              taken={teams}
              layout="list"
              onSelect={addTeam}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <AddTeamSlot count={teams.length} onClick={() => setAdding(true)} />
          ))}
      </div>

      {/* Balance */}
      {assetCount > 0 && (
        <BalanceTables
          summaries={evaluation.teams}
          statsFromSeason={statsFromSeason}
          thresholds={evaluation.thresholds}
        />
      )}

      {/* Rules */}
      <RulesPanel season={season} thresholds={thresholds} amounts={evaluation.amounts} />
    </div>
  );
}
