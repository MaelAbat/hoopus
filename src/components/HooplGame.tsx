"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ArrowUp, ArrowDown, Check, RotateCcw, Trophy, Clock, LogIn, Flag, Gauge } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth, getDisplayName, isAnonymousName } from "@/lib/anonymous-auth";
import { useAchievementNotifier } from "@/components/AchievementProvider";
import { computeVisibleLeaderboard, type LeaderboardRow } from "@/lib/leaderboard-utils";
import PlayerSearchDropdown from "./PlayerSearchDropdown";
import { getDailyRanking } from "@/lib/daily-player";
import SignupBanner from "./SignupBanner";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HooplPlayer {
  id: number;
  name: string;
  team: string;
  teamName: string;
  conference: string;
  division: string;
  position: string;
  age: number;
  height: string;
  country: string;
  jersey: string;
  draft: string;
  pts: number;
  reb: number;
  ast: number;
}

type ClueStatus = "correct" | "higher" | "lower" | "partial" | "wrong";

interface GuessResult {
  player: HooplPlayer;
  clues: {
    team: ClueStatus;
    conference: ClueStatus;
    division: ClueStatus;
    position: ClueStatus;
    age: ClueStatus;
    height: ClueStatus;
    pts: ClueStatus;
    reb: ClueStatus;
    ast: ClueStatus;
  };
}

const COLUMNS = [
  { key: "team", label: "Équipe" },
  { key: "conference", label: "Conf." },
  { key: "division", label: "Div." },
  { key: "position", label: "Pos" },
  { key: "age", label: "Age" },
  { key: "height", label: "Taille" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
] as const;

function heightToInches(h: string): number {
  const match = h.match(/(\d+)-(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 12 + parseInt(match[2]);
}

function getStorageKey(): string {
  const now = new Date();
  return `hoopl-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function compareNumeric(guess: number, target: number): ClueStatus {
  if (guess === target) return "correct";
  return guess > target ? "lower" : "higher";
}

function compareExact(guess: string, target: string): ClueStatus {
  return guess === target ? "correct" : "wrong";
}

function comparePosition(guess: string, target: string): ClueStatus {
  if (guess === target) return "correct";
  // Partial match: both contain G, both contain F, etc.
  const gParts = guess.split("-");
  const tParts = target.split("-");
  if (gParts.some((p) => tParts.includes(p))) return "partial";
  return "wrong";
}

function clueClass(status: ClueStatus): string {
  switch (status) {
    case "correct":
      return "bg-emerald-600/20 text-emerald-300 border-emerald-600/40";
    case "higher":
    case "lower":
      return "bg-accent-light text-accent-text border-accent/40";
    case "partial":
      return "bg-input text-text-secondary border-border-hover";
    case "wrong":
      return "bg-red-600/15 text-red-300 border-red-600/30";
  }
}

/** Difficulté du joueur du jour, dérivée de ses statistiques.
 *  Plus un joueur affiche de grosses stats, plus il est connu et donc
 *  facile à deviner. Le score combine points, rebonds et passes. */
function getDifficulty(player: HooplPlayer): {
  label: "Facile" | "Intermédiaire" | "Difficile";
  className: string;
} {
  const score = player.pts + player.reb * 0.7 + player.ast * 0.7;
  if (score >= 28)
    return { label: "Facile", className: "bg-emerald-600/15 text-emerald-300 border-emerald-600/30" };
  if (score >= 15)
    return { label: "Intermédiaire", className: "bg-accent-light text-accent-text border-accent/30" };
  return { label: "Difficile", className: "bg-red-600/15 text-red-300 border-red-600/30" };
}

function ClueIcon({ status }: { status: ClueStatus }) {
  if (status === "correct") return <Check size={14} className="text-emerald-300" />;
  if (status === "higher") return <ArrowUp size={14} />;
  if (status === "lower") return <ArrowDown size={14} />;
  if (status === "partial") return <span className="text-xs font-bold">~</span>;
  return null;
}

/* ─── Confetti explosion ─── */

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#f97316", "#10b981", "#3b82f6", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
    const particles: { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string; rot: number; vr: number; life: number }[] = [];

    // Create particles from multiple burst points
    const burstPoints = [
      { x: canvas.width * 0.3, y: canvas.height * 0.3 },
      { x: canvas.width * 0.7, y: canvas.height * 0.3 },
      { x: canvas.width * 0.5, y: canvas.height * 0.2 },
    ];

    for (const bp of burstPoints) {
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        particles.push({
          x: bp.x,
          y: bp.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          w: 4 + Math.random() * 6,
          h: 6 + Math.random() * 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          life: 1,
        });
      }
    }

    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;

      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.vx *= 0.99;
        p.rot += p.vr;
        p.life -= 0.008;

        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = Math.min(p.life * 2, 1);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }

      if (alive) {
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-50 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  guesses: number;
  time_seconds: number;
  won: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export default function HooplGame({ players }: { players: HooplPlayer[] }) {
  const pathname = usePathname();
  const { triggerCheck } = useAchievementNotifier();
  const [guessIds, setGuessIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Daily player via rendezvous hashing, with recent days' winners excluded so
  // the same player can't recur within the no-repeat window.
  const target = useMemo(() => getDailyRanking(players, new Date(), 0)[0] ?? null, [players]);

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  // Check auth state + listen for login
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load saved state from localStorage
  useEffect(() => {
    if (!target) return;
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setGuessIds(data.guesses || []);
        setWon(data.won || false);
        setGaveUp(data.gaveUp || false);
        setElapsed(data.elapsed || 0);
        setSubmitted(data.submitted || false);
        setStartTime(data.startTime || Date.now());
      } else {
        setStartTime(Date.now());
      }
    } catch {
      setStartTime(Date.now());
    }
    setLoaded(true);
  }, [target]);

  // Save state to localStorage (only after initial load)
  useEffect(() => {
    if (!target || !loaded) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ guesses: guessIds, won, gaveUp, elapsed, submitted, startTime }));
  }, [guessIds, won, gaveUp, target, loaded, elapsed, submitted, startTime]);

  // Timer tick
  useEffect(() => {
    if (!loaded || won || gaveUp || (guessIds.length >= 10) || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded, won, gaveUp, guessIds.length, startTime]);

  // Submit score when user logs in after finishing the game
  useEffect(() => {
    if (!userId || submitted || !loaded) return;
    const gameOver = won || gaveUp || guessIds.length >= 10;
    if (!gameOver) return;
    submitScore(guessIds.length, won);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loaded]);

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hoopl_scores")
      .select("user_id, display_name, guesses, time_seconds, won")
      .eq("game_date", gameDate)
      .eq("won", true)
      .order("guesses", { ascending: true })
      .order("time_seconds", { ascending: true })
      .limit(500);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Submit score
  const submitScore = useCallback(async (guessCount: number, didWin: boolean) => {
    if (submitted) return;
    const supabase = createClient();
    const uid = userId || await ensureAuth(supabase);
    if (!uid) return;

    const isOver = won || guessIds.length >= 10;
    const finalTime = isOver ? elapsed : Math.floor((Date.now() - startTime) / 1000);
    if (!isOver) setElapsed(finalTime);

    const displayName = await getDisplayName(supabase, uid);

    await supabase.from("hoopl_scores").upsert({
      user_id: uid,
      display_name: displayName,
      game_date: gameDate,
      guesses: guessCount,
      time_seconds: finalTime,
      won: didWin,
    }, { onConflict: "user_id,game_date" });

    setSubmitted(true);
    fetchLeaderboard();
    triggerCheck();
  }, [submitted, userId, startTime, elapsed, won, guessIds.length, gameDate, fetchLeaderboard, triggerCheck]);

  const guessResults: GuessResult[] = useMemo(() => {
    if (!target) return [];
    return guessIds.map((id) => {
      const player = players.find((p) => p.id === id);
      if (!player) return null;

      const targetInches = heightToInches(target.height);
      const guessInches = heightToInches(player.height);

      return {
        player,
        clues: {
          team: compareExact(player.team, target.team),
          conference: compareExact(player.conference, target.conference),
          division: compareExact(player.division, target.division),
          position: comparePosition(player.position, target.position),
          age: compareNumeric(player.age, target.age),
          height: compareNumeric(guessInches, targetInches),
          pts: compareNumeric(Math.round(player.pts * 10), Math.round(target.pts * 10)),
          reb: compareNumeric(Math.round(player.reb * 10), Math.round(target.reb * 10)),
          ast: compareNumeric(Math.round(player.ast * 10), Math.round(target.ast * 10)),
        },
      };
    }).filter(Boolean) as GuessResult[];
  }, [guessIds, players, target]);

  // Scroll target after a guess on mobile: the clues live below the search.
  const resultsRef = useRef<HTMLDivElement>(null);

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalize(search);
    return players
      .filter((p) => normalize(p.name).includes(q) && !guessIds.includes(p.id))
      .slice(0, 8);
  }, [search, players, guessIds]);

  const MAX_GUESSES = 10;
  const lost = !won && (guessIds.length >= MAX_GUESSES || gaveUp);
  const difficulty = target ? getDifficulty(target) : null;

  function handleGuess(player: HooplPlayer) {
    if (won || lost || !target || guessIds.includes(player.id)) return;
    const newGuesses = [...guessIds, player.id];
    setGuessIds(newGuesses);
    setSearch("");
    if (player.id === target.id) {
      setWon(true);
      setShowConfetti(true);
      submitScore(newGuesses.length, true);
    } else if (newGuesses.length >= MAX_GUESSES) {
      submitScore(newGuesses.length, false);
    }
  }

  function handleAbandon() {
    if (won || lost || !target) return;
    if (!confirmAbandon) {
      setConfirmAbandon(true);
      return;
    }
    setConfirmAbandon(false);
    setGaveUp(true);
    submitScore(guessIds.length, false);
  }

  function handleReset() {
    const key = getStorageKey();
    localStorage.removeItem(key);
    setGuessIds([]);
    setWon(false);
    setGaveUp(false);
    setConfirmAbandon(false);
    setSearch("");
  }

  function buildShareText(): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const emojiMap: Record<ClueStatus, string> = {
      correct: "\u{1F7E9}",  // green
      higher: "\u{1F7E7}",   // orange
      lower: "\u{1F7E7}",    // orange
      partial: "\u{1F7E8}",  // yellow
      wrong: "\u{1F7E5}",    // red
    };

    const grid = guessResults.map((r) =>
      COLUMNS.map((col) => emojiMap[r.clues[col.key as keyof typeof r.clues]]).join("")
    ).join("\n");

    const result = won
      ? `Trouvé en ${guessIds.length} essai${guessIds.length > 1 ? "s" : ""} (${formatTime(elapsed)})`
      : gaveUp
      ? `Abandonné après ${guessIds.length} essai${guessIds.length > 1 ? "s" : ""}`
      : `Pas trouvé en ${MAX_GUESSES} essais`;

    return `Hoopl \u{1F3C0} ${dateStr}\n\n${grid}\n\n${result}\n\nhttps://www.hoopus.fr/mini-jeux/hoopl`;
  }

  function handleShare() {
    const text = buildShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "width=550,height=420");
  }

  function handleCopyResult() {
    const text = buildShareText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function renderClueValue(result: GuessResult, key: string): string {
    const p = result.player;
    switch (key) {
      case "team": return p.team;
      case "conference": return p.conference;
      case "division": return p.division;
      case "position": return p.position;
      case "age": return String(p.age);
      case "height": return p.height;
      case "pts": return p.pts.toFixed(1);
      case "reb": return p.reb.toFixed(1);
      case "ast": return p.ast.toFixed(1);
      default: return "";
    }
  }

  if (!target) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">
        Aucun joueur disponible. Synchronisez les données.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="pt-4 space-y-4">
        <Link
          href="/mini-jeux"
          className="inline-flex items-center gap-2 sm:gap-1.5 border border-rule bg-card px-4 py-2.5 sm:px-3 sm:py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary"
        >
          <RotateCcw size={12} />
          Tous les mini-jeux
        </Link>

        {/* Game banner */}
        <div className="relative overflow-hidden border border-rule bg-card">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />

          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Mystery silhouette */}
              <div className="relative shrink-0">
                <div className={`flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center border border-border-hover bg-input ${won ? "" : "animate-pulse"}`}>
                  {won || lost ? (
                    <img src={playerPhotoUrl(target.id)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-3xl sm:text-4xl text-accent-text">?</span>
                  )}
                </div>
                {won && (
                  <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center bg-emerald-600">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="font-display text-3xl sm:text-4xl text-text-primary">
                  Hoop<span className="text-accent">l</span>
                </h1>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  {won ? `Trouvé en ${guessIds.length} essai${guessIds.length > 1 ? "s" : ""} !`
                    : lost ? "Partie terminée"
                    : "Devine le joueur NBA du jour"}
                </p>

                {/* Difficulté du jour */}
                {difficulty && (
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${difficulty.className}`}
                    title="Difficulté estimée d'après les statistiques du joueur"
                  >
                    <Gauge size={11} />
                    {difficulty.label}
                  </span>
                )}

                {/* Progress bar */}
                {!won && !lost && loaded && (
                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                      <span className="tnum text-text-faint">{guessIds.length}/{MAX_GUESSES} essais</span>
                      <span className="flex items-center gap-1 text-text-faint">
                        <Clock size={10} />
                        <span className="tnum">{formatTime(elapsed)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-input overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${(guessIds.length / MAX_GUESSES) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Win stats */}
                {won && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 border border-emerald-600/40 bg-emerald-600/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                      <Trophy size={11} /> <span className="tnum">{guessIds.length}</span> essai{guessIds.length > 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 border border-accent/40 bg-accent-light px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-text">
                      <Clock size={11} /> <span className="tnum">{formatTime(elapsed)}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Hint after 5 guesses */}
      {!won && !lost && guessIds.length >= 5 && (
        <div className="border border-accent/30 bg-accent-light px-4 py-3 text-center text-sm animate-[fadeIn_0.5s_ease-out]">
          <span className="text-text-muted">Indice : il joue pour les </span>
          <span className="font-bold text-accent-text">{target.teamName}</span>
          <img src={teamLogoUrl(target.team)} alt="" className="inline h-5 w-5 ml-1.5 -mt-0.5 object-contain" />
        </div>
      )}

      {/* Search input */}
      {!won && !lost && (
        <PlayerSearchDropdown
          value={search}
          onChange={setSearch}
          onSelect={handleGuess}
          results={filteredPlayers}
          revealRef={resultsRef}
        />
      )}

      {/* Abandon button */}
      {!won && !lost && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          {confirmAbandon ? (
            <>
              <span className="text-xs text-text-muted text-center">Révéler la réponse et terminer la partie ?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAbandon}
                  className="inline-flex items-center gap-1.5 border border-red-600/40 bg-red-600/15 px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-600/25 active:scale-95"
                >
                  <Flag size={13} />
                  Confirmer
                </button>
                <button
                  onClick={() => setConfirmAbandon(false)}
                  className="border border-rule bg-card px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary active:scale-95"
                >
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handleAbandon}
              className="inline-flex items-center gap-1.5 border border-rule bg-card px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:border-border-hover hover:text-text-primary active:scale-95"
            >
              <Flag size={13} />
              Abandonner
            </button>
          )}
        </div>
      )}

      {/* Win reveal */}
      {won && (
        <div className="relative overflow-hidden border border-emerald-600/40 bg-card p-5 sm:p-6">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600" />
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img src={playerPhotoUrl(target.id)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 object-cover bg-input" />
              <img src={teamLogoUrl(target.team)} alt="" className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card p-0.5" />
            </div>
            <div className="min-w-0">
              <p className="kicker text-emerald-300">Bravo !</p>
              <p className="font-display text-2xl sm:text-3xl text-text-primary mt-0.5">{target.name}</p>
              <p className="text-sm text-text-muted">{target.teamName} -- {target.position}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-text-faint">
                <span className="tnum font-bold text-text-secondary">{target.pts.toFixed(1)} <span className="kicker font-normal text-text-faint">PTS</span></span>
                <span className="tnum font-bold text-text-secondary">{target.reb.toFixed(1)} <span className="kicker font-normal text-text-faint">REB</span></span>
                <span className="tnum font-bold text-text-secondary">{target.ast.toFixed(1)} <span className="kicker font-normal text-text-faint">AST</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lost reveal */}
      {lost && (
        <div className="relative overflow-hidden border border-red-600/30 bg-card p-5 sm:p-6">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <img src={playerPhotoUrl(target.id)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 object-cover bg-input" />
              <img src={teamLogoUrl(target.team)} alt="" className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card p-0.5" />
            </div>
            <div className="min-w-0">
              <p className="kicker text-red-300">{gaveUp ? "Abandonné" : "Perdu !"}</p>
              <p className="font-display text-2xl sm:text-3xl text-text-primary mt-0.5">{target.name}</p>
              <p className="text-sm text-text-muted">{target.teamName} -- {target.position}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-text-faint">
                <span className="tnum font-bold text-text-secondary">{target.pts.toFixed(1)} <span className="kicker font-normal text-text-faint">PTS</span></span>
                <span className="tnum font-bold text-text-secondary">{target.reb.toFixed(1)} <span className="kicker font-normal text-text-faint">REB</span></span>
                <span className="tnum font-bold text-text-secondary">{target.ast.toFixed(1)} <span className="kicker font-normal text-text-faint">AST</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share buttons */}
      {(won || lost) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-2 bg-accent px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-accent-hover"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            Partager
          </button>
          <button
            onClick={handleCopyResult}
            className="inline-flex items-center justify-center gap-2 border border-border-hover bg-card px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-widest text-text-primary transition-colors hover:bg-input"
          >
            {copied ? <><Check size={14} className="text-emerald-300" /> Copié !</> : "Copier"}
          </button>
        </div>
      )}

      {/* Results — cards on mobile, table on desktop */}
      {guessResults.length > 0 && (
        <div ref={resultsRef} className="space-y-6 scroll-mt-20">
          {/* Mobile: card layout (newest first so the latest guess shows up top) */}
          <div className="space-y-3 sm:hidden">
            {[...guessResults].reverse().map((result) => (
              <div key={result.player.id} className="border border-rule bg-card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={playerPhotoUrl(result.player.id)}
                    alt=""
                    className="h-8 w-8 object-cover bg-input"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-sm font-bold text-text-primary">{result.player.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {COLUMNS.map((col) => {
                    const status = result.clues[col.key as keyof typeof result.clues];
                    return (
                      <div
                        key={col.key}
                        className={`flex flex-col items-center border px-1.5 py-2 ${clueClass(status)}`}
                      >
                        <span className="kicker opacity-70">{col.label}</span>
                        <div className="tnum flex items-center gap-0.5 text-sm font-bold">
                          {col.key === "team" ? (
                            <img src={teamLogoUrl(result.player.team)} alt="" className="h-3.5 w-3.5 object-contain" />
                          ) : (
                            <ClueIcon status={status} />
                          )}
                          <span>{renderClueValue(result, col.key)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block border border-rule bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left"><span className="kicker text-text-faint">Joueur</span></th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="px-2 py-2 text-center whitespace-nowrap">
                        <span className="kicker text-text-faint">{col.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guessResults.map((result, i) => (
                    <tr key={result.player.id} className="border-b border-rule">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={playerPhotoUrl(result.player.id)}
                            alt=""
                            className="h-7 w-7 object-cover bg-input"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <span className="text-xs font-medium text-text-primary whitespace-nowrap">{result.player.name}</span>
                        </div>
                      </td>
                      {COLUMNS.map((col) => {
                        const status = result.clues[col.key as keyof typeof result.clues];
                        return (
                          <td key={col.key} className="px-1.5 py-2">
                            <div
                              className={`tnum flex items-center justify-center gap-1 border px-2 py-1.5 text-xs font-medium whitespace-nowrap ${clueClass(status)}`}
                            >
                              {col.key === "team" ? (
                                <img src={teamLogoUrl(result.player.team)} alt="" className="h-4 w-4 object-contain" />
                              ) : (
                                <ClueIcon status={status} />
                              )}
                              <span>{renderClueValue(result, col.key)}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (() => {
        const rows = computeVisibleLeaderboard(leaderboard, userId);
        return (
          <div className="border border-rule bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-rule">
              <h2 className="font-display text-lg text-text-primary flex items-center gap-2">
                <Trophy size={16} className="text-accent-text" />
                Classement du jour
              </h2>
            </div>
            <div className="divide-y divide-rule">
              {rows.map((row, i) =>
                row.type === "separator" ? (
                  <div key="sep" className="flex items-center gap-3 px-4 py-1.5">
                    <div className="flex-1 border-t border-dashed border-rule" />
                    <span className="text-[10px] text-text-faint">...</span>
                    <div className="flex-1 border-t border-dashed border-rule" />
                  </div>
                ) : (
                  <div key={`${row.entry.display_name}-${row.rank}`} className={`flex items-center gap-3 px-4 py-2.5 ${row.isUser ? "relative bg-accent-light" : ""}`}>
                    {row.isUser && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
                    <span className={`tnum flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                      row.rank === 1 ? "bg-accent text-white"
                      : row.rank <= 3 ? "bg-input text-text-primary"
                      : "text-text-faint"
                    }`}>
                      {row.rank}
                    </span>
                    <span className={`flex-1 text-sm truncate ${row.isUser ? "font-bold text-accent-text" : isAnonymousName(row.entry.display_name) ? "italic text-text-muted" : "font-medium text-text-primary"}`}>
                      {row.entry.display_name}{row.isUser ? " (toi)" : ""}
                    </span>
                    <span className="tnum text-xs text-text-muted">{row.entry.guesses} essai{row.entry.guesses > 1 ? "s" : ""}</span>
                    <span className="tnum text-xs text-text-faint w-12 text-right">{formatTime(row.entry.time_seconds)}</span>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })()}

      <SignupBanner show={submitted} />

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-wider text-text-faint pb-4">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 bg-emerald-600/40" />
          Correct
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 bg-accent/40" />
          <ArrowUp size={10} /> Plus haut / <ArrowDown size={10} /> Plus bas
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 bg-border-hover" />
          <span className="font-bold">~</span> Poste proche
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 bg-red-600/40" />
          Incorrect
        </div>
      </div>
    </div>
  );
}
