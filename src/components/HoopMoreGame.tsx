"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Trophy, Clock, LogIn, Check, ArrowUp, ArrowDown, Flame, Play } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth, getDisplayName, isAnonymousName } from "@/lib/anonymous-auth";
import { computeVisibleLeaderboard } from "@/lib/leaderboard-utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HoopMorePlayer {
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
  shortLabel: string;
  format: (v: number) => string;
  getValue: (p: HoopMorePlayer) => number | null;
}

const CATEGORIES: CategoryDef[] = [
  { key: "pts", label: "Points par match", shortLabel: "PTS", format: (v) => v.toFixed(1), getValue: (p) => p.pts },
  { key: "reb", label: "Rebonds par match", shortLabel: "REB", format: (v) => v.toFixed(1), getValue: (p) => p.reb },
  { key: "ast", label: "Passes par match", shortLabel: "AST", format: (v) => v.toFixed(1), getValue: (p) => p.ast },
  { key: "age", label: "Âge", shortLabel: "Âge", format: (v) => `${v}`, getValue: (p) => p.age },
  { key: "salary", label: "Salaire annuel", shortLabel: "Salaire", format: (v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M$` : `${Math.round(v / 1e3)}K$`, getValue: (p) => p.salary },
];

const MIN_PLAYERS = 20;

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

function getDailyStorageKey(): string {
  const now = new Date();
  return `hoopmore-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function getEligible(players: HoopMorePlayer[], cat: CategoryDef): HoopMorePlayer[] {
  return players.filter((p) => {
    const v = cat.getValue(p);
    return v != null && !isNaN(v);
  });
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

/* ─── Main component ─── */

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  streak: number;
  time_seconds: number;
}

export default function HoopMoreGame({ players }: { players: HoopMorePlayer[] }) {
  const pathname = usePathname();

  // ─── Mode ───
  const [mode, setMode] = useState<"daily" | "free">("daily");

  // ─── Daily setup ───
  const baseDaySeed = useMemo(() => getDaySeed(), []);
  const [debugSeed, setDebugSeed] = useState(0);

  // Daily category with fallback
  const dailyCategory = useMemo(() => {
    const seed = baseDaySeed + debugSeed * 9973;
    const preferred = CATEGORIES[seed % CATEGORIES.length];
    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = i === 0 ? preferred : CATEGORIES[(seed + i) % CATEGORIES.length];
      if (getEligible(players, cat).length >= MIN_PLAYERS) return cat;
    }
    return CATEGORIES[0];
  }, [players, baseDaySeed, debugSeed]);

  // ─── Free mode setup ───
  const [freeCategoryKey, setFreeCategoryKey] = useState("pts");
  const [freeSeed, setFreeSeed] = useState(() => Date.now());

  // Available categories in free mode (enough eligible players)
  const availableCategories = useMemo(() =>
    CATEGORIES.filter((cat) => getEligible(players, cat).length >= MIN_PLAYERS),
  [players]);

  const freeCategory = useMemo(() =>
    availableCategories.find((c) => c.key === freeCategoryKey) || availableCategories[0] || CATEGORIES[0],
  [availableCategories, freeCategoryKey]);

  // ─── Active category + sequence ───
  const category = mode === "daily" ? dailyCategory : freeCategory;
  const activeSeed = mode === "daily" ? baseDaySeed + debugSeed * 9973 : freeSeed;

  const eligiblePlayers = useMemo(() => getEligible(players, category), [players, category]);

  const playerSequence = useMemo(() => {
    const rand = mulberry32(activeSeed + 9999);
    const shuffled = [...eligiblePlayers].sort(() => rand() - 0.5);
    // Remove consecutive players with the same stat value (especially for age)
    const result: HoopMorePlayer[] = [];
    for (const p of shuffled) {
      if (result.length > 0 && category.getValue(p) === category.getValue(result[result.length - 1])) {
        continue;
      }
      result.push(p);
    }
    return result;
  }, [eligiblePlayers, activeSeed, category]);

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  // ─── Game state ───
  const [currentIndex, setCurrentIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [personalBests, setPersonalBests] = useState<Record<string, number>>({});

  const leftPlayer = playerSequence[currentIndex] || null;
  const rightPlayer = playerSequence[currentIndex + 1] || null;
  const leftVal = leftPlayer ? category.getValue(leftPlayer) : null;
  const rightVal = rightPlayer ? category.getValue(rightPlayer) : null;

  // ─── Auth ───
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

  // ─── Load personal bests ───
  useEffect(() => {
    const bests: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const stored = localStorage.getItem(`hoopmore-best-${cat.key}`);
      if (stored) bests[cat.key] = Number(stored);
    }
    setPersonalBests(bests);
  }, []);

  // ─── Load daily state ───
  useEffect(() => {
    if (mode !== "daily") return;
    const key = getDailyStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setCurrentIndex(data.currentIndex || 0);
        setStreak(data.streak || 0);
        setGameOver(data.gameOver || false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Save daily state ───
  useEffect(() => {
    if (!loaded || mode !== "daily") return;
    const key = getDailyStorageKey();
    localStorage.setItem(key, JSON.stringify({ currentIndex, streak, gameOver, elapsed, submitted, startTime }));
  }, [currentIndex, streak, gameOver, loaded, elapsed, submitted, startTime, mode]);

  // ─── Timer ───
  useEffect(() => {
    if (!loaded || gameOver || !startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [loaded, gameOver, startTime]);

  // ─── Leaderboard (daily only) ───
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hoopmore_scores")
      .select("user_id, display_name, streak, time_seconds")
      .eq("game_date", gameDate)
      .order("streak", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(500);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // ─── Submit score (daily only) ───
  const submitScore = useCallback(async (finalStreak: number) => {
    if (mode !== "daily" || submitted) return;
    const supabase = createClient();
    const uid = userId || await ensureAuth(supabase);
    if (!uid) return;

    const finalTime = gameOver ? elapsed : Math.floor((Date.now() - startTime) / 1000);
    if (!gameOver) setElapsed(finalTime);

    const displayName = await getDisplayName(supabase, uid);

    await supabase.from("hoopmore_scores").upsert({
      user_id: uid,
      display_name: displayName,
      game_date: gameDate,
      streak: finalStreak,
      category: category.key,
      time_seconds: finalTime,
    }, { onConflict: "user_id,game_date" });

    setSubmitted(true);
    fetchLeaderboard();
  }, [mode, submitted, userId, startTime, elapsed, gameOver, gameDate, category.key, fetchLeaderboard]);

  // Auto-submit on login (daily)
  useEffect(() => {
    if (!userId || submitted || !loaded || !gameOver || mode !== "daily") return;
    submitScore(streak);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loaded]);

  // ─── Update personal best (free mode) ───
  function updatePersonalBest(catKey: string, finalStreak: number) {
    const current = personalBests[catKey] || 0;
    if (finalStreak > current) {
      localStorage.setItem(`hoopmore-best-${catKey}`, String(finalStreak));
      setPersonalBests((prev) => ({ ...prev, [catKey]: finalStreak }));
    }
  }

  // ─── Reset game state ───
  function resetGameState() {
    setCurrentIndex(0);
    setStreak(0);
    setGameOver(false);
    setRevealing(false);
    setLastCorrect(null);
    setShowConfetti(false);
    setCopied(false);
    setStartTime(Date.now());
    setElapsed(0);
  }

  // ─── Mode switch ───
  function switchMode(newMode: "daily" | "free") {
    if (newMode === mode) return;
    setMode(newMode);
    resetGameState();
    if (newMode === "daily") {
      // Reload daily state
      const key = getDailyStorageKey();
      try {
        const saved = localStorage.getItem(key);
        if (saved) {
          const data = JSON.parse(saved);
          setCurrentIndex(data.currentIndex || 0);
          setStreak(data.streak || 0);
          setGameOver(data.gameOver || false);
          setElapsed(data.elapsed || 0);
          setSubmitted(data.submitted || false);
          setStartTime(data.startTime || Date.now());
        }
      } catch { /* ignore */ }
    } else {
      setFreeSeed(Date.now());
      setSubmitted(false);
    }
  }

  // ─── Free mode replay ───
  function handleFreeReplay() {
    setFreeSeed(Date.now());
    resetGameState();
  }

  // ─── Free mode category change ───
  function handleFreeCategoryChange(key: string) {
    setFreeCategoryKey(key);
    setFreeSeed(Date.now());
    resetGameState();
  }

  // ─── Admin reset (daily) ───
  function handleAdminReset() {
    setDebugSeed((s) => s + 1);
    resetGameState();
    setSubmitted(false);
    localStorage.removeItem(getDailyStorageKey());
  }

  // ─── Handle guess ───
  function handleGuess(higher: boolean) {
    if (revealing || gameOver || leftVal == null || rightVal == null) return;

    const isCorrect =
      rightVal === leftVal ||
      (higher && rightVal > leftVal) ||
      (!higher && rightVal < leftVal);

    setRevealing(true);
    setLastCorrect(isCorrect);

    setTimeout(() => {
      if (isCorrect) {
        const newStreak = streak + 1;
        setStreak(newStreak);

        if (currentIndex + 2 >= playerSequence.length) {
          setGameOver(true);
          if (newStreak >= 10) setShowConfetti(true);
          if (mode === "daily") submitScore(newStreak);
          else updatePersonalBest(category.key, newStreak);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      } else {
        setGameOver(true);
        if (streak >= 10) setShowConfetti(true);
        if (mode === "daily") submitScore(streak);
        else updatePersonalBest(category.key, streak);
      }
      setRevealing(false);
      setLastCorrect(null);
    }, 1500);
  }

  // ─── Share ───
  function buildShareText(): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const modeLabel = mode === "daily" ? "Défi quotidien" : "Mode libre";
    return `HoopMore \u{1F3C0} ${dateStr}\n${modeLabel} - ${category.label}\n\u{1F525} Série : ${streak}\n\nhttps://www.hoopus.fr/mini-jeux/hoopmore`;
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

  // ─── Render ───

  if (playerSequence.length < 2) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">
        Pas assez de joueurs disponibles. Synchronisez les données.
      </div>
    );
  }

  const currentBest = personalBests[category.key] || 0;

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
          {isAdmin && mode === "daily" && (
            <button
              onClick={handleAdminReset}
              className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
            >
              <RotateCcw size={12} />
              Nouvelle partie
            </button>
          )}
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-xl bg-input p-1 gap-1">
          <button
            onClick={() => switchMode("daily")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              mode === "daily"
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-faint hover:text-text-muted"
            }`}
          >
            Défi quotidien
          </button>
          <button
            onClick={() => switchMode("free")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
              mode === "free"
                ? "bg-card text-text-primary shadow-sm"
                : "text-text-faint hover:text-text-muted"
            }`}
          >
            Mode libre
          </button>
        </div>

        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border-t bg-gradient-to-br from-rose-500/10 via-card to-card">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 opacity-[0.07]">
            <Flame className="w-full h-full text-rose-500" />
          </div>
          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative shrink-0">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-rose-500/30 to-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center">
                  <Flame size={32} className="text-rose-500" />
                </div>
                {gameOver && streak >= 10 && (
                  <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                  Hoop<span className="text-rose-500">More</span>
                </h1>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  {gameOver
                    ? `Série terminée : ${streak} bonne${streak > 1 ? "s" : ""} réponse${streak > 1 ? "s" : ""}`
                    : `${category.label} - Plus ou moins ?`}
                </p>
                {loaded && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-400">
                      <Flame size={11} /> {streak}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-text">
                      <Clock size={11} /> {formatTime(elapsed)}
                    </span>
                    {mode === "free" && currentBest > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                        <Trophy size={11} /> Record : {currentBest}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Free mode: category selector */}
        {mode === "free" && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {availableCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleFreeCategoryChange(cat.key)}
                disabled={gameOver ? false : revealing}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  category.key === cat.key
                    ? "bg-rose-500 text-white shadow-lg"
                    : "bg-input text-text-muted hover:text-text-primary hover:bg-card-hover"
                }`}
              >
                {cat.shortLabel}
                {(personalBests[cat.key] || 0) > 0 && (
                  <span className="ml-1.5 opacity-60">({personalBests[cat.key]})</span>
                )}
              </button>
            ))}
          </div>
        )}

      </div>

      {/* Game area */}
      {!gameOver && loaded && leftPlayer && rightPlayer && (
        <>
          {/* Category label */}
          <div className="text-center">
            <span className="inline-block rounded-full bg-rose-500/15 px-4 py-1.5 text-sm font-bold text-rose-400">
              {category.label}
            </span>
          </div>

          {/* Cards + buttons */}
          <div className="flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6">
            {/* Left card */}
            <div className="flex-1 rounded-2xl border border-border-t bg-card p-5 flex flex-col items-center gap-3">
              <div className="relative">
                <img
                  key={leftPlayer.id}
                  src={playerPhotoUrl(leftPlayer.id)}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover bg-input"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <img
                  key={`team-${leftPlayer.id}`}
                  src={teamLogoUrl(leftPlayer.team)}
                  alt=""
                  className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card rounded-full p-0.5"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-text-primary">{leftPlayer.name}</p>
                <p className="text-xs text-text-faint">{leftPlayer.teamName}</p>
              </div>
              <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-6 py-3 text-center">
                <p className="text-2xl sm:text-3xl font-black text-rose-400 tabular-nums">
                  {category.format(leftVal!)}
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex sm:flex-col items-center justify-center gap-3 py-2">
              <button
                onClick={() => handleGuess(true)}
                disabled={revealing}
                className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-6 py-3 text-sm font-bold text-emerald-400 transition-all hover:bg-emerald-500/25 hover:scale-[1.05] active:scale-[0.95] disabled:opacity-40 disabled:hover:scale-100"
              >
                <ArrowUp size={18} />
                Plus
              </button>
              <span className="text-xs text-text-faint font-medium">ou</span>
              <button
                onClick={() => handleGuess(false)}
                disabled={revealing}
                className="flex items-center gap-2 rounded-xl bg-blue-500/15 border border-blue-500/30 px-6 py-3 text-sm font-bold text-blue-400 transition-all hover:bg-blue-500/25 hover:scale-[1.05] active:scale-[0.95] disabled:opacity-40 disabled:hover:scale-100"
              >
                <ArrowDown size={18} />
                Moins
              </button>
            </div>

            {/* Right card */}
            <div className={`flex-1 rounded-2xl border p-5 flex flex-col items-center gap-3 transition-all duration-500 ${
              revealing
                ? lastCorrect
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-red-500/50 bg-red-500/5"
                : "border-border-t bg-card"
            }`}>
              <div className="relative">
                <img
                  key={rightPlayer.id}
                  src={playerPhotoUrl(rightPlayer.id)}
                  alt=""
                  className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover bg-input"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <img
                  key={`team-${rightPlayer.id}`}
                  src={teamLogoUrl(rightPlayer.team)}
                  alt=""
                  className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card rounded-full p-0.5"
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-text-primary">{rightPlayer.name}</p>
                <p className="text-xs text-text-faint">{rightPlayer.teamName}</p>
              </div>
              <div className={`rounded-xl border px-6 py-3 text-center transition-all duration-500 ${
                revealing
                  ? lastCorrect
                    ? "bg-emerald-500/15 border-emerald-500/30"
                    : "bg-red-500/15 border-red-500/30"
                  : "bg-input/50 border-border-t"
              }`}>
                {revealing ? (
                  <p className={`text-2xl sm:text-3xl font-black tabular-nums animate-[scaleIn_0.3s_ease-out] ${
                    lastCorrect ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {category.format(rightVal!)}
                  </p>
                ) : (
                  <p className="text-2xl sm:text-3xl font-black text-text-faint">???</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Game over */}
      {gameOver && loaded && (
        <>
          <div className={`rounded-2xl overflow-hidden border p-5 sm:p-6 ${
            streak >= 10
              ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-card"
              : streak >= 5
              ? "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-card"
              : "border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-card"
          }`}>
            <div className="text-center space-y-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${
                streak >= 10 ? "text-emerald-400" : streak >= 5 ? "text-amber-400" : "text-red-400"
              }`}>
                {streak >= 15 ? "Légendaire !" : streak >= 10 ? "Impressionnant !" : streak >= 5 ? "Pas mal !" : "Fin de série"}
              </p>
              <div className="flex items-center justify-center gap-2">
                <Flame size={28} className="text-rose-400" />
                <span className="text-4xl sm:text-5xl font-black text-text-primary">{streak}</span>
              </div>
              <p className="text-sm text-text-muted">
                bonne{streak > 1 ? "s" : ""} réponse{streak > 1 ? "s" : ""} consécutive{streak > 1 ? "s" : ""}
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-text-faint">
                <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(elapsed)}</span>
                <span className="font-medium text-text-muted">{category.label}</span>
              </div>
              {mode === "free" && currentBest > 0 && (
                <p className="text-xs text-amber-400 font-bold">
                  {streak > currentBest
                    ? `Nouveau record ! (ancien : ${currentBest})`
                    : streak === currentBest
                    ? "Record égalé !"
                    : `Record : ${currentBest}`}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {mode === "free" && (
              <button
                onClick={handleFreeReplay}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-rose-600 hover:scale-[1.03] active:scale-[0.98]"
              >
                <Play size={14} />
                Rejouer
              </button>
            )}
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

      {/* Leaderboard (daily only) */}
      {mode === "daily" && leaderboard.length > 0 && (() => {
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
                    <span className="text-xs text-text-muted tabular-nums flex items-center gap-1">
                      <Flame size={11} className="text-rose-400" /> {row.entry.streak}
                    </span>
                    <span className="text-xs text-text-faint tabular-nums w-12 text-right">{formatTime(row.entry.time_seconds)}</span>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })()}

      {/* Personal bests (free mode, shown when not playing) */}
      {mode === "free" && gameOver && Object.values(personalBests).some((v) => v > 0) && (
        <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
          <div className="px-4 py-3 border-b border-border-t">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              Tes records personnels
            </h2>
          </div>
          <div className="divide-y divide-border-t/30">
            {availableCategories.map((cat) => {
              const best = personalBests[cat.key] || 0;
              if (best === 0) return null;
              return (
                <div key={cat.key} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm font-medium text-text-primary">{cat.label}</span>
                  <span className="text-xs text-amber-400 tabular-nums font-bold flex items-center gap-1">
                    <Flame size={11} /> {best}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-text-faint pb-4">
        <div className="flex items-center gap-1.5">
          <ArrowUp size={10} className="text-emerald-400" />
          Le joueur a une stat plus haute
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDown size={10} className="text-blue-400" />
          Le joueur a une stat plus basse
        </div>
      </div>

      <style jsx global>{`
        @keyframes scaleIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
