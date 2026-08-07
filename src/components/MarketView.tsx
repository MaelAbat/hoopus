"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { teamLogoUrl, teamNickname } from "@/lib/nba-teams";
import {
  assetLabel,
  busiestDays,
  CONTRACT_LABELS,
  countByKind,
  eventAction,
  flowContents,
  formatEventDate,
  isMinorMove,
  KIND_LABELS,
  KIND_ORDER,
  MINOR_KINDS,
  mostMovedPlayers,
  resolveEventPhases,
  rosterMoves,
  teamBalances,
  tradeFlows,
  type EventKind,
  type EventPlayer,
  type MarketEvent,
  type MovedPlayer,
  type RosterMoves,
  type TeamBalance,
} from "@/lib/market";
import {
  formatPhaseDate,
  PHASE_DESCRIPTIONS,
  PHASE_LABELS,
  PHASE_ORDER,
  type PhaseKey,
  type SeasonPhase,
} from "@/lib/season-phases";

/** Nombre de mouvements affichés d'un coup dans la chronologie. */
const PAGE_SIZE = 60;

interface Props {
  season: string;
  events: MarketEvent[];
  phases: SeasonPhase[];
  initialKind?: string;
  initialTeam?: string;
  initialPhase?: string;
  /**
   * Effectifs de la saison précédente, par joueur. Ils servent à distinguer une
   * prolongation d'une arrivée : la source ne fait pas la différence.
   */
  previousRoster: Record<string, string>;
  /**
   * Termes des contrats en cours, par nom normalisé : « 3 ans · 120,8 M$ ».
   *
   * Aucune source de transactions ne chiffre ses lignes ; les montants viennent
   * des pages de contrats, et ne concernent donc que les contrats en cours. Une
   * signature ancienne reste sans montant — ce serait afficher le contrat
   * d'aujourd'hui à côté d'un mouvement d'hier.
   */
  contractTerms: Record<string, string>;
  /**
   * Faux quand l'effectif précédent est inconnu — la première saison de
   * l'historique. Les prolongations ne sont alors pas identifiables, et
   * l'interface le dit plutôt que de les ranger ailleurs.
   */
  canDetectExtensions: boolean;
  /**
   * Période sur laquelle ouvrir, calculée côté serveur pour que le rendu initial
   * ne dépende pas de l'horloge du navigateur.
   */
  defaultPhase: PhaseKey;
}

/** Les trois lectures d'une même période. */
type ViewKey = "timeline" | "rosters" | "balance";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "timeline", label: "Chronologie" },
  { key: "rosters", label: "Effectifs" },
  { key: "balance", label: "Bilan" },
];

/** Valeur du sélecteur de période qui lève la restriction. */
const ALL_PHASES = "";

export default function MarketView({
  season,
  events,
  phases,
  initialKind,
  initialTeam,
  initialPhase,
  previousRoster,
  canDetectExtensions,
  contractTerms,
  defaultPhase,
}: Props) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState(isKind(initialKind) ? initialKind : "");
  const [team, setTeam] = useState(initialTeam?.toUpperCase() ?? "");
  // La période n'est pas un filtre parmi d'autres mais la navigation principale :
  // la page s'ouvre sur une période, jamais sur la saison entière. Tout empiler
  // donnait une page où l'on ne savait plus ce qu'on regardait.
  const [phase, setPhase] = useState<string>(initialPhase ?? defaultPhase);
  const [view, setView] = useState<ViewKey>("timeline");
  const [showMinor, setShowMinor] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [sortKey, setSortKey] = useState<SortKey>("total");

  const dated = useMemo(() => resolveEventPhases(events, phases), [events, phases]);

  /**
   * Les allers-retours en G League sont écartés d'emblée, sauf demande
   * explicite : plusieurs centaines par saison, ils noieraient tout le reste. Un
   * filtre par type les fait réapparaître sans avoir à cocher quoi que ce soit.
   */
  const visible = useMemo(() => {
    const wantsMinor = showMinor || MINOR_KINDS.includes(kind as EventKind);
    return wantsMinor ? dated : dated.filter((e) => !MINOR_KINDS.includes(e.kind));
  }, [dated, showMinor, kind]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visible.filter((event) => {
      if (kind && event.kind !== kind) return false;
      if (team && !event.teams.includes(team)) return false;
      if (phase && event.phase !== phase) return false;
      if (needle) {
        const haystack = [
          ...event.players.map((p) => p.name),
          ...event.teams,
          event.raw,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [visible, kind, team, phase, search]);

  /**
   * Un joueur qui signe là où il était la saison précédente prolonge. Le
   * rapprochement passe par l'identifiant NBA : les noms non résolus ne peuvent
   * pas être tranchés, et comptent donc comme des arrivées.
   */
  const moves = useMemo(
    () =>
      rosterMoves(filtered, (player, team) =>
        player.player_id ? previousRoster[String(player.player_id)] === team : false
      ),
    [filtered, previousRoster]
  );

  const balances = useMemo(() => teamBalances(filtered), [filtered]);
  const kinds = useMemo(() => countByKind(visible), [visible]);
  const days = useMemo(() => busiestDays(filtered, 5), [filtered]);
  const movers = useMemo(() => mostMovedPlayers(filtered, 8), [filtered]);
  const teamOptions = useMemo(
    () => [...new Set(dated.flatMap((e) => e.teams))].sort((a, b) => teamNickname(a).localeCompare(teamNickname(b))),
    [dated]
  );

  const phaseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of visible) {
      if (!event.phase) continue;
      counts.set(event.phase, (counts.get(event.phase) || 0) + 1);
    }
    return counts;
  }, [visible]);

  const grouped = useMemo(() => {
    const shown = filtered.slice(0, limit);
    const map = new Map<string, MarketEvent[]>();
    for (const event of shown) {
      const list = map.get(event.event_date) || [];
      list.push(event);
      map.set(event.event_date, list);
    }
    return [...map.entries()];
  }, [filtered, limit]);

  const playersInvolved = useMemo(() => {
    const names = new Set<string>();
    for (const event of filtered) {
      for (const player of event.players) names.add(player.player_id?.toString() ?? player.name);
    }
    return names.size;
  }, [filtered]);

  // La période ne compte pas comme un filtre : elle est toujours posée, et la
  // remettre à zéro voudrait dire « toute la saison », ce qui n'est pas ce
  // qu'attend quelqu'un qui efface une recherche.
  const hasFilter = !!(kind || team || search);

  function reset() {
    setKind("");
    setTeam("");
    setSearch("");
    setLimit(PAGE_SIZE);
  }

  function goToPhase(next: string) {
    setPhase(next);
    setLimit(PAGE_SIZE);
  }

  if (events.length === 0) {
    return (
      <div className="border border-rule bg-card px-6 py-16 text-center">
        <p className="font-display text-2xl text-text-primary">Aucun mouvement enregistré</p>
        <p className="mt-2 text-sm text-text-muted">
          La saison {season} n&apos;a pas encore été synchronisée.
        </p>
      </div>
    );
  }

  const activeDefinition = phase ? phases.find((p) => p.phase === phase) : undefined;
  const activeLabel = phase ? PHASE_LABELS[phase as PhaseKey] : "Toute la saison";

  return (
    <div className="space-y-5">
      {/* ── Navigation par période ──
          Une saison se lit par temps forts : draft, free agency, saison
          régulière… Les cumuler produisait une page où l'on ne savait plus de
          quoi on parlait. On en montre donc un à la fois, et « toute la saison »
          reste accessible en dernier onglet, pour qui le demande. */}
      <nav className="border border-rule bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-rule bg-input/50 px-4 py-2.5">
          <h2 className="kicker text-text-muted">Les temps de la saison</h2>
          {phases.some((p) => p.isEstimated) && (
            <span
              className="font-mono text-[10px] uppercase tracking-wider text-text-faint"
              title="La ligue ne publie pas ces dates de façon exploitable : celles-ci sont estimées d'après ses usages."
            >
              Dates estimées
            </span>
          )}
        </div>

        <div className="flex overflow-x-auto">
          {PHASE_ORDER.map((key) => {
            const count = phaseCounts.get(key) || 0;
            const active = phase === key;
            const definition = phases.find((p) => p.phase === key);
            // Une période sans mouvement ne mène nulle part : la loterie, par
            // construction, n'en produit aucun. On la montre — elle fait partie
            // de la saison — mais on n'y envoie pas l'utilisateur pour rien.
            const reachable = count > 0;
            return (
              <button
                key={key}
                type="button"
                disabled={!reachable}
                onClick={() => goToPhase(key)}
                title={PHASE_DESCRIPTIONS[key]}
                className={`min-w-[7.5rem] flex-1 border-r border-rule px-3 py-2.5 text-left transition-colors last:border-r-0 ${
                  active
                    ? "bg-accent-light"
                    : reachable
                      ? "hover:bg-card-hover"
                      : "cursor-not-allowed opacity-40"
                }`}
              >
                <p
                  className={`truncate font-mono text-[10px] font-bold uppercase tracking-wider ${
                    active ? "text-accent" : "text-text-muted"
                  }`}
                >
                  {PHASE_LABELS[key]}
                </p>
                <p
                  className={`tnum mt-0.5 font-display text-lg leading-none ${
                    reachable ? "text-text-primary" : "text-text-faint"
                  }`}
                >
                  {reachable ? count : "—"}
                </p>
                {definition && (
                  <p className="tnum mt-1 truncate font-mono text-[10px] text-text-faint">
                    {formatPhaseDate(definition.startsOn)}
                  </p>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => goToPhase(ALL_PHASES)}
            title="Tous les mouvements de la saison, toutes périodes confondues."
            className={`min-w-[7.5rem] flex-1 border-l-2 border-rule px-3 py-2.5 text-left transition-colors ${
              phase === ALL_PHASES ? "bg-accent-light" : "hover:bg-card-hover"
            }`}
          >
            <p
              className={`truncate font-mono text-[10px] font-bold uppercase tracking-wider ${
                phase === ALL_PHASES ? "text-accent" : "text-text-muted"
              }`}
            >
              Toute la saison
            </p>
            <p className="tnum mt-0.5 font-display text-lg leading-none text-text-primary">
              {visible.length}
            </p>
            <p className="mt-1 truncate font-mono text-[10px] text-text-faint">{season}</p>
          </button>
        </div>

        {/* Ce qu'on regarde, dit en une phrase — l'onglet seul ne suffit pas. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule px-4 py-2.5">
          <h3 className="font-display text-base uppercase leading-none text-text-primary">
            {activeLabel}
          </h3>
          {activeDefinition && (
            <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-faint">
              {formatPhaseDate(activeDefinition.startsOn)}
              {activeDefinition.endsOn !== activeDefinition.startsOn && (
                <> → {formatPhaseDate(activeDefinition.endsOn)}</>
              )}
            </span>
          )}
          <p className="min-w-0 flex-1 text-xs text-text-muted">
            {phase
              ? PHASE_DESCRIPTIONS[phase as PhaseKey]
              : "Tous les mouvements de la saison, toutes périodes confondues."}
          </p>
        </div>
      </nav>

      {/* ── Synthèse de la période ── */}
      <div className="flex flex-wrap gap-3">
        <StatCard value={filtered.length} label="Mouvements" accent />
        <StatCard value={filtered.filter((e) => e.kind === "trade").length} label="Échanges" />
        <StatCard value={filtered.filter((e) => e.kind === "signature").length} label="Signatures" />
        <StatCard value={filtered.filter((e) => e.kind === "waiver").length} label="Waivers" />
        <StatCard value={playersInvolved} label="Joueurs concernés" />
      </div>

      {/* ── Filtres ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Rechercher un joueur, une équipe..."
            className="w-full border border-rule bg-input py-2 pl-9 pr-3 text-xs text-text-primary outline-none transition-colors placeholder:text-text-faint focus:border-border-hover"
          />
        </div>

        <Dropdown
          value={kind}
          onChange={(v) => {
            setKind(v);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Type"
          options={KIND_ORDER.filter((k) => kinds.some((c) => c.kind === k) || MINOR_KINDS.includes(k)).map((k) => ({
            value: k,
            label: `${KIND_LABELS[k]}${kinds.find((c) => c.kind === k) ? ` (${kinds.find((c) => c.kind === k)!.count})` : ""}`,
          }))}
        />

        <Dropdown
          value={team}
          onChange={(v) => {
            setTeam(v);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Équipe"
          options={teamOptions.map((t) => ({ value: t, label: `${t} — ${teamNickname(t)}` }))}
        />

        <button
          onClick={() => setShowMinor(!showMinor)}
          className={`border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            showMinor
              ? "border-accent bg-accent-light text-accent"
              : "border-rule bg-input text-text-muted hover:border-border-hover hover:text-text-primary"
          }`}
          title="Les allers-retours en G League sont nombreux et masqués par défaut."
        >
          G League
        </button>

        {hasFilter && (
          <button
            onClick={reset}
            className="border border-rule bg-input px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
          >
            Tout afficher
          </button>
        )}
      </div>

      {/* ── Une seule lecture à la fois ──
          Chronologie, effectifs et bilan répondent à trois questions
          différentes ; les empiler faisait défiler trois grands tableaux pour en
          consulter un. Les onglets vivent dans l'en-tête de la section, ce qui
          évite un bloc de plus. */}
      <section className="border border-rule bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-input/50">
          <div className="flex">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`border-r border-rule px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  view === v.key
                    ? "bg-card text-text-primary"
                    : "text-text-faint hover:text-text-muted"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <span className="tnum px-4 font-mono text-[10px] uppercase tracking-wider text-text-faint">
            {filtered.length} mouvement{filtered.length > 1 ? "s" : ""}
          </span>
        </header>

        {view === "rosters" && (
          <RosterMovesTable moves={moves} canDetectExtensions={canDetectExtensions} embedded />
        )}

        {view === "balance" && (
          <BalanceView
            balances={balances}
            days={days}
            movers={movers}
            sortKey={sortKey}
            onSort={setSortKey}
            team={team}
            onTeam={(t) => {
              setTeam(t);
              setLimit(PAGE_SIZE);
            }}
          />
        )}

        {view === "timeline" &&
          (grouped.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-text-muted">
            Aucun mouvement ne correspond à ces filtres
          </p>
        ) : (
          <div>
            {grouped.map(([date, list]) => (
              <div key={date}>
                <div className="flex items-center gap-3 border-t border-rule bg-input/30 px-4 py-1.5">
                  <span className="tnum text-xs font-semibold text-text-primary">
                    {formatEventDate(date)}
                  </span>
                  {list[0].phase && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                      {PHASE_LABELS[list[0].phase]}
                    </span>
                  )}
                  <span className="tnum ml-auto font-mono text-[10px] text-text-faint">
                    {list.length}
                  </span>
                </div>
                {list.map((event) => (
                  <EventRow key={event.event_key} event={event} contractTerms={contractTerms} />
                ))}
              </div>
            ))}
          </div>
          ))}

        {view === "timeline" && filtered.length > limit && (
          <button
            onClick={() => setLimit(limit + PAGE_SIZE * 2)}
            className="w-full border-t border-rule px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary"
          >
            Afficher {Math.min(PAGE_SIZE * 2, filtered.length - limit)} mouvements de plus
          </button>
        )}
      </section>
    </div>
  );
}

/* ─── Bilan chiffré d'une période ─── */

/**
 * Les volumes, quand on les cherche : combien d'arrivées, quels jours, quels
 * joueurs. C'est la troisième lecture d'une période, et elle ne s'impose pas —
 * on y vient par son onglet.
 */
function BalanceView({
  balances,
  days,
  movers,
  sortKey,
  onSort,
  team,
  onTeam,
}: {
  balances: TeamBalance[];
  days: { date: string; count: number; phase: PhaseKey | null }[];
  movers: { name: string; player_id: number | null; teams: string[]; moves: number }[];
  sortKey: SortKey;
  onSort: (key: SortKey) => void;
  team: string;
  onTeam: (team: string) => void;
}) {
  if (balances.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-text-muted">
        Aucun mouvement à comptabiliser sur cette période.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-rule bg-input/30 text-left">
              <th className="px-4 py-1.5 kicker text-text-faint">Équipe</th>
              <SortableHeader label="Arrivées" name="arrivals" sortKey={sortKey} onSort={onSort} />
              <SortableHeader label="Départs" name="departures" sortKey={sortKey} onSort={onSort} />
              <SortableHeader label="Échanges" name="trades" sortKey={sortKey} onSort={onSort} />
              <SortableHeader label="Signatures" name="signatures" sortKey={sortKey} onSort={onSort} />
              <SortableHeader label="Waivers" name="waivers" sortKey={sortKey} onSort={onSort} />
              <SortableHeader label="Picks" name="pickBalance" sortKey={sortKey} onSort={onSort} />
              <SortableHeader label="Total" name="total" sortKey={sortKey} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sortBalances(balances, sortKey).map((row) => (
              <tr key={row.team} className="border-t border-rule transition-colors hover:bg-card-hover">
                <td className="px-4 py-2">
                  <button
                    onClick={() => onTeam(team === row.team ? "" : row.team)}
                    className="flex items-center gap-2 text-left"
                  >
                    <img src={teamLogoUrl(row.team)} alt="" className="h-5 w-5 object-contain" />
                    <span
                      className={`text-sm ${
                        team === row.team ? "font-semibold text-accent" : "text-text-primary"
                      }`}
                    >
                      {teamNickname(row.team)}
                    </span>
                  </button>
                </td>
                <Cell value={row.arrivals} />
                <Cell value={row.departures} />
                <Cell value={row.trades} />
                <Cell value={row.signatures} />
                <Cell value={row.waivers} />
                <td className="px-3 py-2 text-right">
                  <span
                    className={`tnum font-mono text-xs ${
                      row.pickBalance > 0
                        ? "text-accent-text"
                        : row.pickBalance < 0
                          ? "text-text-muted"
                          : "text-text-faint"
                    }`}
                  >
                    {row.pickBalance > 0 ? `+${row.pickBalance}` : row.pickBalance}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="tnum font-mono text-xs font-bold text-text-primary">
                    {row.total}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-rule px-4 py-2 text-[11px] text-text-faint">
        Le solde de picks compte les tours de draft reçus moins ceux cédés sur la période affichée.
        Les allers-retours en G League n&apos;entrent pas dans ce bilan.
      </p>

      <div className="grid border-t border-rule lg:grid-cols-2 lg:divide-x lg:divide-rule">
        <div>
          <p className="kicker border-b border-rule bg-input/30 px-4 py-2 text-text-muted">
            Journées les plus chargées
          </p>
          {days.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Rien à signaler</p>
          ) : (
            <ul>
              {days.map((day) => (
                <li
                  key={day.date}
                  className="flex items-center gap-3 border-b border-rule/60 px-4 py-2 last:border-b-0"
                >
                  <span className="tnum text-sm text-text-primary">{formatEventDate(day.date)}</span>
                  {day.phase && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                      {PHASE_LABELS[day.phase]}
                    </span>
                  )}
                  <span className="tnum ml-auto font-mono text-xs font-bold text-text-primary">
                    {day.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-rule lg:border-t-0">
          <p className="kicker border-b border-rule bg-input/30 px-4 py-2 text-text-muted">
            Joueurs les plus déplacés
          </p>
          {movers.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Rien à signaler</p>
          ) : (
            <ul>
              {movers.map((mover) => (
                <li
                  key={mover.player_id ?? mover.name}
                  className="flex items-center gap-3 border-b border-rule/60 px-4 py-2 last:border-b-0"
                >
                  <PlayerName
                    player={{
                      name: mover.name,
                      player_id: mover.player_id,
                      br_slug: null,
                      from: null,
                      to: null,
                    }}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
                    {mover.teams.join(" · ")}
                  </span>
                  <span className="tnum ml-auto font-mono text-xs font-bold text-text-primary">
                    {mover.moves}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Mouvements d'effectif ─── */

/** Noms affichés d'emblée dans une colonne, avant dépliage. */
const NAMES_SHOWN = 6;

/**
 * Ce que devient chaque effectif : qui arrive, qui part, qui prolonge.
 *
 * C'est la lecture qu'un lecteur cherche en premier — des noms, pas des volumes.
 * Les compteurs restent disponibles plus bas, dans la section des statistiques.
 */
function RosterMovesTable({
  moves,
  canDetectExtensions,
  /** Rendu à l'intérieur d'une section qui porte déjà son cadre et son en-tête. */
  embedded = false,
}: {
  moves: RosterMoves[];
  canDetectExtensions: boolean;
  embedded?: boolean;
}) {
  if (moves.length === 0) {
    return (
      <p className={`text-center text-sm text-text-muted ${embedded ? "px-4 py-12" : "border border-rule bg-card px-6 py-10"}`}>
        Aucun mouvement d&apos;effectif sur cette période
      </p>
    );
  }

  const Wrapper = embedded ? "div" : "section";

  return (
    <Wrapper className={embedded ? "" : "border border-rule bg-card"}>
      {!embedded && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rule bg-input/50 px-4 py-2.5">
          <h2 className="kicker text-text-muted">Qui arrive, qui part, qui prolonge</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
            {moves.length} équipe{moves.length > 1 ? "s" : ""}
          </span>
        </header>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-rule bg-input/30 text-left align-bottom">
              <th className="w-40 px-4 py-1.5 kicker text-text-faint">Équipe</th>
              <th className="px-3 py-1.5 kicker text-text-faint">Arrivées</th>
              <th className="px-3 py-1.5 kicker text-text-faint">Départs</th>
              <th className="px-3 py-1.5 kicker text-text-faint">
                Extensions
                {!canDetectExtensions && (
                  <span
                    className="ml-1 normal-case text-text-faint"
                    title="Les extensions se déduisent de l'effectif de la saison précédente, absent de la base pour cette saison."
                  >
                    (indisponible)
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {moves.map((row) => (
              <tr key={row.team} className="border-t border-rule align-top transition-colors hover:bg-card-hover">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <img src={teamLogoUrl(row.team)} alt="" className="h-5 w-5 shrink-0 object-contain" />
                    <span className="text-sm font-semibold text-text-primary">{teamNickname(row.team)}</span>
                  </span>
                </td>
                <PlayerCell players={row.arrivals} tone="in" />
                <PlayerCell players={row.departures} tone="out" />
                <PlayerCell players={row.extensions} tone="stay" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-rule px-4 py-2 text-[11px] leading-relaxed text-text-faint">
        Les contrats two-way, 10 jours et Exhibit 10 sont comptés à part : une équipe en signe une
        dizaine par saison, souvent pour quelques jours. Une prolongation est une signature dans
        l&apos;équipe où le joueur évoluait déjà la saison précédente — la source ne les distingue pas
        des arrivées, elles sont déduites des effectifs. Les allers-retours en G League sont exclus.
      </p>
    </Wrapper>
  );
}

/**
 * Une colonne de noms, les vrais mouvements devant.
 *
 * Les deux-way, dix jours et Exhibit 10 sont relégués derrière une ligne à
 * déplier : une équipe en signe une dizaine par saison, et les mêler aux vraies
 * arrivées ferait disparaître celle qui compte.
 */
function PlayerCell({ players, tone }: { players: MovedPlayer[]; tone: "in" | "out" | "stay" }) {
  const [expanded, setExpanded] = useState(false);
  const [showMinor, setShowMinor] = useState(false);

  if (players.length === 0) {
    return (
      <td className="px-3 py-3">
        <span className="font-mono text-[11px] text-text-faint">—</span>
      </td>
    );
  }

  const major = players.filter((p) => !isMinorMove(p));
  const minor = players.filter(isMinorMove);
  const shown = expanded ? major : major.slice(0, NAMES_SHOWN);
  const hidden = major.length - shown.length;
  const marker = tone === "in" ? "text-accent-text" : tone === "out" ? "text-text-muted" : "text-text-primary";

  return (
    <td className="px-3 py-3">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider">
        <span className={`tnum font-bold ${marker}`}>{major.length}</span>
        {minor.length > 0 && (
          <span
            className="tnum ml-1 text-text-faint"
            title="Contrats two-way, 10 jours ou Exhibit 10"
          >
            +{minor.length}
          </span>
        )}
      </span>

      {major.length === 0 ? (
        <span className="font-mono text-[11px] text-text-faint">aucun contrat ferme</span>
      ) : (
        <ul className="space-y-0.5">
          {shown.map((player) => (
            <li key={`${player.player_id ?? player.name}-${player.date}`} className="leading-snug">
              <PlayerName
                player={{
                  name: player.name,
                  player_id: player.player_id,
                  br_slug: null,
                  from: null,
                  to: null,
                }}
              />
              {movedTag(player) && (
                <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-text-faint">
                  {movedTag(player)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-text-faint transition-colors hover:text-accent"
        >
          et {hidden} autre{hidden > 1 ? "s" : ""}
        </button>
      )}
      {expanded && major.length > NAMES_SHOWN && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-text-faint transition-colors hover:text-accent"
        >
          réduire
        </button>
      )}

      {minor.length > 0 && (
        <div className="mt-2 border-t border-rule/60 pt-1.5">
          <button
            onClick={() => setShowMinor(!showMinor)}
            className="font-mono text-[10px] uppercase tracking-wider text-text-faint transition-colors hover:text-accent"
          >
            {showMinor ? "masquer" : `+ ${minor.length} two-way, 10 jours ou Exhibit 10`}
          </button>
          {showMinor && (
            <ul className="mt-1 space-y-0.5">
              {minor.map((player) => (
                <li
                  key={`${player.player_id ?? player.name}-${player.date}`}
                  className="text-[11px] leading-snug text-text-muted"
                >
                  {player.name}
                  <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-text-faint">
                    {movedTag(player)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </td>
  );
}

/**
 * La précision qui accompagne un nom : d'où il vient, où il va, ou la nature du
 * contrat. Deux mots au plus — la chronologie porte le détail.
 */
function movedTag(player: MovedPlayer): string {
  if (player.counterpart) return player.counterpart;
  if (player.kind === "waiver") return "coupé";
  if (player.kind === "conversion") return "converti";
  if (player.kind === "option") return "option";
  if (player.contract) return CONTRACT_LABELS[player.contract.type];
  // Rien à préciser : la colonne dit déjà s'il arrive, part ou prolonge.
  return "";
}

/* ─── Ligne de mouvement ─── */

function EventRow({
  event,
  contractTerms,
}: {
  event: MarketEvent;
  contractTerms: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const subject = event.from_team || event.to_team || event.teams[0];
  const hasDetail = event.assets.length > 0 || event.raw.length > 90;

  // Le montant n'a de sens que pour une arrivée ou une prolongation : personne ne
  // signe en étant coupé.
  const money =
    event.kind === "signature" || event.kind === "extension"
      ? event.players.map((p) => contractTerms[normalizeForMoney(p.name)]).find(Boolean)
      : undefined;

  return (
    <div className="border-t border-rule">
      <div className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-card-hover">
        <span
          className="mt-0.5 w-[86px] shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted"
          title={KIND_LABELS[event.kind]}
        >
          {KIND_LABELS[event.kind]}
        </span>

        <span className="mt-0.5 w-6 shrink-0">
          {subject && <img src={teamLogoUrl(subject)} alt={subject} className="h-5 w-5 object-contain" />}
        </span>

        <p className="min-w-0 flex-1 text-sm leading-relaxed text-text-primary">
          <RichAction event={event} />
          {money && (
            <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-accent-text">
              {money}
            </span>
          )}
        </p>

        {hasDetail && (
          <button
            onClick={() => setOpen(!open)}
            className="mt-0.5 shrink-0 text-text-faint transition-colors hover:text-text-primary"
            aria-label="Détail du mouvement"
          >
            <ChevronRight size={14} className={open ? "rotate-90 transition-transform" : "transition-transform"} />
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-rule bg-input/30 px-4 py-3 sm:pl-[122px]">
          {/* Un échange se lit flux par flux : qui envoie quoi à qui. C'est la
              seule façon de rendre un échange à trois équipes sans le déformer. */}
          {event.kind === "trade" && (
            <ul className="mb-2 space-y-1.5">
              {tradeFlows(event).map((flow, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-text-faint">
                    {flow.from ? teamNickname(flow.from) : "?"} → {flow.to ? teamNickname(flow.to) : "?"}
                  </span>
                  <span className="text-text-primary">{flowContents(flow).join(", ")}</span>
                  {flow.assets.some((a) => a.detail) && (
                    <span className="text-[11px] text-text-faint">
                      ({flow.assets.filter((a) => a.detail).map((a) => a.detail).join(" · ")})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {event.kind !== "trade" && event.assets.length > 0 && (
            <ul className="mb-2 space-y-1">
              {event.assets.map((asset, i) => (
                <li key={i} className="text-[11px] text-text-muted">
                  <span className="font-mono uppercase tracking-wider text-text-faint">
                    {asset.from ?? "?"} → {asset.to ?? "?"}
                  </span>{" "}
                  {assetLabel(asset)}
                  {asset.detail && <span className="text-text-faint"> — {asset.detail}</span>}
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] italic leading-relaxed text-text-faint">{event.raw}</p>
        </div>
      )}
    </div>
  );
}

/**
 * La phrase française, avec les joueurs rendus cliquables.
 *
 * Le texte vient de `eventAction` : on ne le reconstruit pas ici, on y réinjecte
 * les liens. Ainsi la formulation reste au même endroit pour tout le site.
 */
function RichAction({ event }: { event: MarketEvent }) {
  const sentence = eventAction(event);
  const linkable = event.players.filter((p) => p.player_id && p.role !== "coach");
  if (linkable.length === 0) return <>{sentence}</>;

  const pattern = new RegExp(`(${linkable.map((p) => escapeRegExp(p.name)).join("|")})`, "g");
  const parts = sentence.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const player = linkable.find((p) => p.name === part);
        if (!player) return <span key={i}>{part}</span>;
        return (
          <Link
            key={i}
            href={`/joueurs/${player.player_id}`}
            className="text-text-primary underline decoration-rule underline-offset-2 transition-colors hover:text-accent hover:decoration-accent"
          >
            {part}
          </Link>
        );
      })}
      {event.kind === "trade" && <TradeMachineLink event={event} />}
    </>
  );
}

/**
 * Rejouer un échange réel dans la trade machine. Le lien n'apparaît que si tous
 * les joueurs concernés ont été reliés à leur fiche — sans identifiants, la
 * machine ne saurait pas quoi déplacer.
 */
function TradeMachineLink({ event }: { event: MarketEvent }) {
  const moves = event.players.filter((p) => p.player_id && p.from && p.to);
  if (moves.length === 0 || moves.length !== event.players.length || event.teams.length !== 2) {
    return null;
  }
  const query = new URLSearchParams({
    season: event.season,
    teams: event.teams.join(","),
    moves: moves.map((p) => `${p.player_id}-${p.to}`).join(","),
  });
  return (
    <Link
      href={`/trades?${query}`}
      className="ml-2 font-mono text-[10px] uppercase tracking-wider text-text-faint transition-colors hover:text-accent"
    >
      Rejouer
    </Link>
  );
}

function PlayerName({ player }: { player: EventPlayer }) {
  if (!player.player_id || player.role === "coach") {
    return <span className="text-sm text-text-primary">{player.name}</span>;
  }
  return (
    <Link
      href={`/joueurs/${player.player_id}`}
      className="text-sm text-text-primary transition-colors hover:text-accent"
    >
      {player.name}
    </Link>
  );
}

/* ─── Tri du bilan ─── */

type SortKey = "arrivals" | "departures" | "trades" | "signatures" | "waivers" | "pickBalance" | "total";

function sortBalances(rows: ReturnType<typeof teamBalances>, key: SortKey) {
  return [...rows].sort((a, b) => b[key] - a[key] || a.team.localeCompare(b.team));
}

function SortableHeader({
  label,
  name,
  sortKey,
  onSort,
}: {
  label: string;
  name: SortKey;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === name;
  return (
    <th className="px-3 py-1.5 text-right">
      <button
        onClick={() => onSort(name)}
        className={`kicker transition-colors ${active ? "text-accent" : "text-text-faint hover:text-text-primary"}`}
      >
        {label}
      </button>
    </th>
  );
}

function Cell({ value }: { value: number }) {
  return (
    <td className="px-3 py-2 text-right">
      <span className={`tnum font-mono text-xs ${value > 0 ? "text-text-primary" : "text-text-faint"}`}>
        {value}
      </span>
    </td>
  );
}

/* ─── Briques d'interface ─── */

function StatCard({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="relative min-w-[130px] flex-1 overflow-hidden border border-rule bg-card px-4 py-3">
      {accent && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
      <p className={`tnum font-display text-3xl ${accent ? "text-accent-text" : "text-text-primary"}`}>
        {value}
      </p>
      <p className="kicker mt-0.5 text-text-muted">{label}</p>
    </div>
  );
}

interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}

function Dropdown({ value, onChange, placeholder, options }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${
          value
            ? "border-accent bg-accent-light text-accent"
            : "border-rule bg-input text-text-muted hover:border-border-hover hover:text-text-primary"
        }`}
      >
        {selected?.label || placeholder}
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
          />
          <div className="absolute left-0 top-full z-40 mt-1 max-h-64 min-w-[180px] overflow-y-auto border border-rule bg-card shadow-xl">
            <button
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider transition-colors ${
                !value ? "bg-accent-light font-semibold text-accent" : "text-text-muted hover:bg-card-hover hover:text-text-primary"
              }`}
            >
              {placeholder} (tous)
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                  value === option.value
                    ? "bg-accent-light font-semibold text-accent"
                    : "text-text-primary hover:bg-card-hover"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}

    </div>
  );
}

/* ─── Utilitaires ─── */

function isKind(value: string | undefined): value is EventKind {
  return !!value && (KIND_ORDER as string[]).includes(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Même normalisation que côté synchronisation : les contrats sont indexés par nom,
 * la page de contrats ne portant aucun identifiant NBA.
 */
function normalizeForMoney(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ (jr|sr|ii|iii|iv|v)$/, "")
    .trim();
}
