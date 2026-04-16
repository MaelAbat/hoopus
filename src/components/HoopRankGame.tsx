"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Trophy, Clock, LogIn, Check, ChevronUp, ChevronDown, ArrowRight, GripVertical } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth, getDisplayName, isAnonymousName } from "@/lib/anonymous-auth";
import { useAchievementNotifier } from "@/components/AchievementProvider";
import { computeVisibleLeaderboard } from "@/lib/leaderboard-utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HoopRankPlayer {
  id: number;
  name: string;
  team: string;
  teamName: string;
  pts: number;
  reb: number;
  ast: number;
  age: number;
  salary: number | null;
}

interface CategoryDef {
  key: string;
  label: string;
  format: (v: number) => string;
  getValue: (p: HoopRankPlayer) => number | null;
}

const ALL_CATEGORIES: CategoryDef[] = [
  { key: "pts", label: "Points par match", format: (v) => v.toFixed(1), getValue: (p) => p.pts },
  { key: "reb", label: "Rebonds par match", format: (v) => v.toFixed(1), getValue: (p) => p.reb },
  { key: "ast", label: "Passes par match", format: (v) => v.toFixed(1), getValue: (p) => p.ast },
  { key: "age", label: "Âge", format: (v) => `${v}`, getValue: (p) => p.age },
  { key: "salary", label: "Salaire annuel", format: (v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M$` : `${Math.round(v / 1e3)}K$`, getValue: (p) => p.salary },
];

const ROUNDS = 5;
const PLAYERS_PER_ROUND = 5;

/* ─── Seeded RNG ─── */

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function getDaySeed(): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

function getStorageKey(): string {
  const now = new Date();
  return `hooprank-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

/* ─── Round generation ─── */

interface RoundDef {
  category: CategoryDef;
  players: HoopRankPlayer[];
  correctOrder: number[]; // player IDs sorted by stat desc
}

function generateRounds(allPlayers: HoopRankPlayer[], seed: number): RoundDef[] {
  const rand = mulberry32(seed + 7777);
  const rounds: RoundDef[] = [];
  const usedPlayerIds = new Set<number>();

  // Filter available categories (need enough eligible players)
  const viable = ALL_CATEGORIES.filter((cat) => {
    const count = allPlayers.filter((p) => {
      const v = cat.getValue(p);
      return v != null && !isNaN(v);
    }).length;
    return count >= PLAYERS_PER_ROUND * 4; // need enough to split into quintiles
  });

  if (viable.length === 0) return rounds;

  // Pick 5 categories for the 5 rounds (seeded shuffle, cycle if fewer than 5 viable)
  const shuffledCats = [...viable].sort(() => rand() - 0.5);

  for (let r = 0; r < ROUNDS; r++) {
    const cat = shuffledCats[r % shuffledCats.length];

    // Get eligible players sorted by this stat (descending)
    const eligible = allPlayers
      .filter((p) => {
        const v = cat.getValue(p);
        return v != null && !isNaN(v) && !usedPlayerIds.has(p.id);
      })
      .sort((a, b) => cat.getValue(b)! - cat.getValue(a)!);

    if (eligible.length < PLAYERS_PER_ROUND * 3) continue;

    // Pick one player per quintile for well-spaced stats
    // Divide eligible into 5 equal buckets, pick a random player from each
    const bucketSize = Math.floor(eligible.length / PLAYERS_PER_ROUND);
    const cluster: HoopRankPlayer[] = [];

    for (let b = 0; b < PLAYERS_PER_ROUND; b++) {
      const bucketStart = b * bucketSize;
      const bucketEnd = b === PLAYERS_PER_ROUND - 1 ? eligible.length : (b + 1) * bucketSize;
      const idx = bucketStart + Math.floor(rand() * (bucketEnd - bucketStart));
      cluster.push(eligible[idx]);
    }

    // Correct order: sorted by stat descending
    const correctOrder = [...cluster]
      .sort((a, b) => cat.getValue(b)! - cat.getValue(a)!)
      .map((p) => p.id);

    // Shuffle for display
    const shuffled = [...cluster].sort(() => rand() - 0.5);

    for (const p of cluster) usedPlayerIds.add(p.id);

    rounds.push({ category: cat, players: shuffled, correctOrder });
  }

  return rounds;
}

/* ─── Confetti ─── */

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

    for (const bp of [{ x: canvas.width * 0.3, y: canvas.height * 0.3 }, { x: canvas.width * 0.7, y: canvas.height * 0.3 }, { x: canvas.width * 0.5, y: canvas.height * 0.2 }]) {
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        particles.push({
          x: bp.x, y: bp.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4,
          w: 4 + Math.random() * 6, h: 6 + Math.random() * 10,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3, life: 1,
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
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.99;
        p.rot += p.vr; p.life -= 0.008;
        ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot);
        ctx!.globalAlpha = Math.min(p.life * 2, 1); ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx!.restore();
      }
      if (alive) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" style={{ width: "100vw", height: "100vh" }} />;
}

/* ─── Score calculation ─── */

function calcRoundScore(userOrder: number[], correctOrder: number[]): { total: number; perPlayer: number[] } {
  const perPlayer: number[] = [];
  for (let i = 0; i < userOrder.length; i++) {
    const correctIdx = correctOrder.indexOf(userOrder[i]);
    const diff = Math.abs(i - correctIdx);
    if (diff === 0) perPlayer.push(20);
    else if (diff === 1) perPlayer.push(10);
    else perPlayer.push(0);
  }
  return { total: perPlayer.reduce((a, b) => a + b, 0), perPlayer };
}

function scoreColor(pts: number): string {
  if (pts === 20) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (pts === 10) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

/* ─── Main ─── */

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  score: number;
  time_seconds: number;
}

export default function HoopRankGame({ players }: { players: HoopRankPlayer[] }) {
  const pathname = usePathname();
  const { triggerCheck } = useAchievementNotifier();

  const baseDaySeed = useMemo(() => getDaySeed(), []);
  const [debugSeed, setDebugSeed] = useState(0);
  const daySeed = baseDaySeed + debugSeed * 9973;
  const rounds = useMemo(() => generateRounds(players, daySeed), [players, daySeed]);

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  // State
  const [currentRound, setCurrentRound] = useState(0);
  const [userOrders, setUserOrders] = useState<number[][]>(() => rounds.map((r) => r.players.map((p) => p.id)));
  const [roundScores, setRoundScores] = useState<{ total: number; perPlayer: number[] }[]>([]);
  const [phase, setPhase] = useState<"ordering" | "revealing" | "gameover">("ordering");
  const [revealIndex, setRevealIndex] = useState(-1);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Drag state
  const [dragging, setDragging] = useState<{ index: number; offsetY: number } | null>(null);
  const dragRef = useRef<{ startY: number; index: number; offsetY: number; step: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const totalScore = roundScores.reduce((sum, r) => sum + r.total, 0);

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id || null;
      setUserId(uid);
      if (uid) {
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", uid).single();
        setIsAdmin(profile?.is_admin === true);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load saved state
  useEffect(() => {
    if (rounds.length === 0) return;
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setCurrentRound(data.currentRound || 0);
        if (data.userOrders) setUserOrders(data.userOrders);
        if (data.roundScores) setRoundScores(data.roundScores);
        setPhase(data.phase || "ordering");
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
  }, [rounds.length]);

  // Save state
  useEffect(() => {
    if (!loaded) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ currentRound, userOrders, roundScores, phase, elapsed, submitted, startTime }));
  }, [currentRound, userOrders, roundScores, phase, loaded, elapsed, submitted, startTime]);

  // Timer
  useEffect(() => {
    if (!loaded || phase === "gameover" || !startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [loaded, phase, startTime]);

  // Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hooprank_scores")
      .select("user_id, display_name, score, time_seconds")
      .eq("game_date", gameDate)
      .order("score", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(500);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Submit
  const submitScore = useCallback(async (finalScore: number) => {
    if (submitted) return;
    const supabase = createClient();
    const uid = userId || await ensureAuth(supabase);
    if (!uid) return;

    const isOver = phase === "gameover";
    const finalTime = isOver ? elapsed : Math.floor((Date.now() - startTime) / 1000);
    if (!isOver) setElapsed(finalTime);

    const displayName = await getDisplayName(supabase, uid);

    await supabase.from("hooprank_scores").upsert({
      user_id: uid,
      display_name: displayName,
      game_date: gameDate,
      score: finalScore,
      time_seconds: finalTime,
    }, { onConflict: "user_id,game_date" });

    setSubmitted(true);
    fetchLeaderboard();
    triggerCheck();
  }, [submitted, userId, startTime, elapsed, phase, gameDate, fetchLeaderboard, triggerCheck]);

  // Auto-submit on login
  useEffect(() => {
    if (!userId || submitted || !loaded || phase !== "gameover") return;
    submitScore(totalScore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loaded]);

  // Reveal animation
  useEffect(() => {
    if (phase !== "revealing" || revealIndex >= PLAYERS_PER_ROUND) return;
    const timer = setTimeout(() => {
      const next = revealIndex + 1;
      setRevealIndex(next);
      if (next >= PLAYERS_PER_ROUND) {
        // Round complete, move to next or game over
        setTimeout(() => {
          if (currentRound + 1 >= rounds.length) {
            setPhase("gameover");
            const finalScore = roundScores.reduce((s, r) => s + r.total, 0);
            if (finalScore >= 400) setShowConfetti(true);
            submitScore(finalScore);
          } else {
            setCurrentRound((prev) => prev + 1);
            setPhase("ordering");
            setRevealIndex(-1);
          }
        }, 1000);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [phase, revealIndex, currentRound, rounds.length, roundScores, submitScore]);

  // Move player
  function movePlayer(direction: -1 | 1, index: number) {
    if (phase !== "ordering") return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= PLAYERS_PER_ROUND) return;
    setUserOrders((prev) => {
      const next = [...prev];
      const order = [...next[currentRound]];
      [order[index], order[newIndex]] = [order[newIndex], order[index]];
      next[currentRound] = order;
      return next;
    });
  }

  // ─── Drag & drop (live reordering) ───

  function measureCardStep(): number {
    if (!listRef.current) return 64;
    const children = listRef.current.children;
    if (children.length < 2) return 64;
    return (children[1] as HTMLElement).getBoundingClientRect().top -
           (children[0] as HTMLElement).getBoundingClientRect().top;
  }

  function handleDragStart(e: React.PointerEvent, index: number) {
    if (phase !== "ordering") return;
    e.preventDefault();

    // Measure step BEFORE any transforms are applied
    const step = measureCardStep();
    dragRef.current = { startY: e.clientY, index, offsetY: 0, step };
    setDragging({ index, offsetY: 0 });

    function doSwap(from: number, to: number, direction: number) {
      setUserOrders((prev) => {
        const next = [...prev];
        const order = [...next[currentRound]];
        [order[from], order[to]] = [order[to], order[from]];
        next[currentRound] = order;
        return next;
      });

      // Adjust origin so card follows pointer smoothly after swap
      const dr = dragRef.current!;
      dr.startY += dr.step * direction;
      dr.index = to;
      dr.offsetY -= dr.step * direction;
      setDragging({ index: to, offsetY: dr.offsetY });
    }

    function onMove(ev: PointerEvent) {
      const dr = dragRef.current;
      if (!dr) return;
      const offsetY = ev.clientY - dr.startY;
      dr.offsetY = offsetY;

      const threshold = dr.step * 0.35;

      // Swap down
      if (offsetY > threshold && dr.index < PLAYERS_PER_ROUND - 1) {
        doSwap(dr.index, dr.index + 1, 1);
        return;
      }
      // Swap up
      if (offsetY < -threshold && dr.index > 0) {
        doSwap(dr.index, dr.index - 1, -1);
        return;
      }

      setDragging({ index: dr.index, offsetY });
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      dragRef.current = null;
      setDragging(null);
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  function getDragStyle(i: number): React.CSSProperties {
    if (!dragging) return {};

    if (i === dragging.index) {
      return {
        transform: `translateY(${dragging.offsetY}px) scale(1.03)`,
        zIndex: 50,
        position: "relative",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      };
    }

    return {};
  }

  // Admin reset
  function handleAdminReset() {
    const newSeed = debugSeed + 1;
    setDebugSeed(newSeed);
    const newRounds = generateRounds(players, baseDaySeed + newSeed * 9973);
    setCurrentRound(0);
    setUserOrders(newRounds.map((r) => r.players.map((p) => p.id)));
    setRoundScores([]);
    setPhase("ordering");
    setRevealIndex(-1);
    setSubmitted(false);
    setShowConfetti(false);
    setCopied(false);
    setStartTime(Date.now());
    setElapsed(0);
    localStorage.removeItem(getStorageKey());
  }

  // Validate round
  function handleValidate() {
    const round = rounds[currentRound];
    const score = calcRoundScore(userOrders[currentRound], round.correctOrder);
    setRoundScores((prev) => [...prev, score]);
    setPhase("revealing");
    setRevealIndex(0);
  }

  // Share
  function buildShareText(): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const roundSummary = roundScores.map((r, i) => {
      const emoji = r.perPlayer.map((p) => p === 20 ? "\u{1F7E9}" : p === 10 ? "\u{1F7E8}" : "\u{1F7E5}").join("");
      return `R${i + 1}: ${emoji} ${r.total}/100`;
    }).join("\n");
    return `HoopRank \u{1F3C0} ${dateStr}\n\n${roundSummary}\n\nTotal : ${totalScore}/500\n\nhttps://www.hoopus.fr/mini-jeux/hooprank`;
  }

  function handleShare() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}`;
    window.open(url, "_blank", "width=550,height=420");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (rounds.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">
        Pas assez de joueurs disponibles. Synchronisez les données.
      </div>
    );
  }

  const round = rounds[currentRound];
  const currentOrder = userOrders[currentRound] || [];

  // For revealing: find players by ID
  function getPlayer(id: number): HoopRankPlayer {
    return round.players.find((p) => p.id === id)!;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 sm:px-0 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/mini-jeux"
            className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
          >
            <RotateCcw size={12} />
            Tous les mini-jeux
          </Link>
          {isAdmin && (
            <button
              onClick={handleAdminReset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
            >
              <RotateCcw size={12} />
              Nouvelle partie
            </button>
          )}
        </div>

        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border-t bg-gradient-to-br from-amber-500/10 via-card to-card">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 opacity-[0.07]">
            <Trophy className="w-full h-full text-amber-500" />
          </div>
          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center">
                <Trophy size={32} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                  Hoop<span className="text-amber-500">Rank</span>
                </h1>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  {phase === "gameover"
                    ? `Score final : ${totalScore}/500`
                    : `Manche ${currentRound + 1}/${ROUNDS} - ${round.category.label}`}
                </p>
                {loaded && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                      <Trophy size={11} /> {phase === "gameover" ? totalScore : roundScores.reduce((s, r) => s + r.total, 0)}/{phase === "gameover" ? 500 : (currentRound) * 100}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-text">
                      <Clock size={11} /> {formatTime(elapsed)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Round progress */}
        {phase !== "gameover" && loaded && (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: ROUNDS }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-all ${
                  i < currentRound
                    ? "bg-amber-500"
                    : i === currentRound
                    ? "bg-amber-500/50"
                    : "bg-input"
                }`}
              />
            ))}
          </div>
        )}

      </div>

      {/* Game area */}
      {phase !== "gameover" && loaded && (
        <>
          {/* Category */}
          <div className="text-center">
            <span className="inline-block rounded-full bg-amber-500/15 px-4 py-1.5 text-sm font-bold text-amber-400">
              Classe du plus haut au plus bas : {round.category.label}
            </span>
          </div>

          {/* Player list */}
          <div ref={listRef} className="space-y-2">
            {currentOrder.map((playerId, i) => {
              const player = getPlayer(playerId);
              const isRevealing = phase === "revealing";
              const isRevealed = isRevealing && i < revealIndex;
              const isCurrentReveal = isRevealing && i === revealIndex - 1;
              const score = isRevealed && roundScores[currentRound]
                ? roundScores[currentRound].perPlayer[i]
                : null;
              const correctIdx = isRevealed ? round.correctOrder.indexOf(playerId) : -1;
              const stat = category_getValue(round.category, player);
              const isDragged = dragging?.index === i;

              return (
                <div
                  key={playerId}
                  onPointerDown={(e) => handleDragStart(e, i)}
                  className={`flex items-center gap-2 sm:gap-3 rounded-xl border p-3 ${
                    phase === "ordering" ? "cursor-grab active:cursor-grabbing select-none" : ""
                  } ${
                    isDragged ? "" : "transition-all duration-300"
                  } ${
                    isRevealed && score !== null
                      ? scoreColor(score)
                      : isCurrentReveal
                      ? "border-amber-500/50 bg-amber-500/5"
                      : isDragged
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border-t bg-card"
                  }`}
                  style={{
                    touchAction: phase === "ordering" ? "none" : "auto",
                    ...getDragStyle(i),
                  }}
                >
                  {/* Drag handle + rank */}
                  {phase === "ordering" ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <GripVertical size={14} className="text-text-faint/50" />
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-input text-xs font-bold text-text-primary">
                        {i + 1}
                      </span>
                    </div>
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-input text-sm font-bold text-text-primary">
                      {i + 1}
                    </span>
                  )}

                  {/* Player info */}
                  <img
                    src={playerPhotoUrl(player.id)}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover bg-input shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{player.name}</p>
                    <div className="flex items-center gap-1.5">
                      <img src={teamLogoUrl(player.team)} alt="" className="h-3.5 w-3.5 object-contain" />
                      <span className="text-xs text-text-faint">{player.team}</span>
                    </div>
                  </div>

                  {/* Revealed stat */}
                  {isRevealed && stat != null && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums">{round.category.format(stat)}</p>
                      {correctIdx !== i && (
                        <p className="text-[10px] text-text-faint">#{correctIdx + 1} correct</p>
                      )}
                    </div>
                  )}

                  {/* Up/down buttons (secondary control) */}
                  {phase === "ordering" && (
                    <div
                      className="flex flex-col gap-0.5 shrink-0"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => movePlayer(-1, i)}
                        disabled={i === 0}
                        className="p-1 rounded hover:bg-input disabled:opacity-20 transition-colors"
                      >
                        <ChevronUp size={16} className="text-text-muted" />
                      </button>
                      <button
                        onClick={() => movePlayer(1, i)}
                        disabled={i === PLAYERS_PER_ROUND - 1}
                        className="p-1 rounded hover:bg-input disabled:opacity-20 transition-colors"
                      >
                        <ChevronDown size={16} className="text-text-muted" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Validate button */}
          {phase === "ordering" && (
            <div className="text-center">
              <button
                onClick={handleValidate}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-amber-600 hover:scale-[1.03] active:scale-[0.98]"
              >
                Valider
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Round score */}
          {phase === "revealing" && revealIndex >= PLAYERS_PER_ROUND && roundScores[currentRound] && (
            <div className="text-center rounded-xl bg-amber-500/10 border border-amber-500/30 py-4">
              <p className="text-2xl font-black text-amber-400">{roundScores[currentRound].total}/100</p>
              <p className="text-xs text-text-muted mt-1">
                {currentRound + 1 < rounds.length ? "Manche suivante..." : "Résultat final..."}
              </p>
            </div>
          )}
        </>
      )}

      {/* Game over */}
      {phase === "gameover" && loaded && (
        <>
          <div className={`rounded-2xl overflow-hidden border p-5 sm:p-6 ${
            totalScore >= 400
              ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-card"
              : totalScore >= 250
              ? "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-card"
              : "border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-card"
          }`}>
            <div className="text-center space-y-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${
                totalScore >= 400 ? "text-emerald-400" : totalScore >= 250 ? "text-amber-400" : "text-red-400"
              }`}>
                {totalScore >= 450 ? "Parfait !" : totalScore >= 400 ? "Excellent !" : totalScore >= 250 ? "Pas mal !" : "Peut mieux faire"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Trophy size={28} className="text-amber-400" />
                <span className="text-4xl sm:text-5xl font-black text-text-primary">{totalScore}</span>
                <span className="text-xl text-text-faint font-bold">/500</span>
              </div>

              {/* Round breakdown */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {roundScores.map((r, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      r.total >= 80 ? "bg-emerald-500/15 text-emerald-400"
                      : r.total >= 50 ? "bg-amber-500/15 text-amber-400"
                      : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    R{i + 1}: {r.total}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-text-faint">
                <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(elapsed)}</span>
              </div>
            </div>
          </div>

          {/* Share */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1DA1F2] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#1a8cd8] hover:scale-[1.03] active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              Partager
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl bg-input border border-border-t px-5 py-2.5 text-sm font-bold text-text-primary transition-all hover:bg-card-hover hover:scale-[1.03] active:scale-[0.98]"
            >
              {copied ? <><Check size={14} className="text-emerald-400" /> Copié !</> : "Copier"}
            </button>
          </div>
        </>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (() => {
        const rows = computeVisibleLeaderboard(leaderboard, userId);
        return (
          <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
            <div className="px-4 py-3 border-b border-border-t">
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Trophy size={16} className="text-accent-text" />
                Classement du jour
              </h2>
            </div>
            <div className="divide-y divide-border-t/30">
              {rows.map((row, i) =>
                row.type === "separator" ? (
                  <div key="sep" className="flex items-center gap-3 px-4 py-1.5">
                    <div className="flex-1 border-t border-dashed border-border-t" />
                    <span className="text-[10px] text-text-faint">...</span>
                    <div className="flex-1 border-t border-dashed border-border-t" />
                  </div>
                ) : (
                  <div key={`${row.entry.display_name}-${row.rank}`} className={`flex items-center gap-3 px-4 py-2.5 ${row.isUser ? "bg-accent/10 border-l-2 border-l-accent" : ""}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                      row.rank === 1 ? "bg-accent/20 text-accent-text" : row.rank <= 3 ? "bg-input text-text-primary" : "text-text-faint"
                    }`}>
                      {row.rank}
                    </span>
                    <span className={`flex-1 text-sm truncate ${row.isUser ? "font-bold text-accent-text" : isAnonymousName(row.entry.display_name) ? "italic text-text-muted" : "font-medium text-text-primary"}`}>
                      {row.entry.display_name}{row.isUser ? " (toi)" : ""}
                    </span>
                    <span className="text-xs text-text-muted tabular-nums font-bold">{row.entry.score}/500</span>
                    <span className="text-xs text-text-faint tabular-nums w-12 text-right">{formatTime(row.entry.time_seconds)}</span>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-text-faint pb-4">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-emerald-500/30" />
          Position correcte (20 pts)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-amber-500/30" />
          Décalage de 1 (10 pts)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-red-500/30" />
          Décalage de 2+ (0 pts)
        </div>
      </div>
    </div>
  );
}

function category_getValue(cat: CategoryDef, player: HoopRankPlayer): number | null {
  return cat.getValue(player);
}
