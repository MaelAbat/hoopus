"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Trophy, Search, Clock, LogIn, Check, Eye } from "lucide-react";
import { playerPhotoUrl, teamLogoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export interface HoopixlPlayer {
  id: number;
  name: string;
  team: string;
  teamName: string;
  position: string;
}

interface LeaderboardEntry {
  display_name: string;
  guesses: number;
  time_seconds: number;
  won: boolean;
}

const MAX_GUESSES = 5;
const REVEAL_DURATION = 60; // seconds to go from full pixel to clear

function getDailyPlayerIndex(playerCount: number): number {
  const now = new Date();
  // Different seed than Hoopl (offset by 7777)
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate() + 7777;
  let hash = seed;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;
  return Math.abs(hash) % playerCount;
}

function getStorageKey(): string {
  const now = new Date();
  return `hoopixl-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

/* ─── Pixelated image component (CSS-based, no CORS issues) ─── */

function PixelatedImage({ src, pixelSize, size }: { src: string; pixelSize: number; size: number }) {
  // pixelSize 40 = max blur, 1 = fully clear
  // Map pixelSize to blur: 40 → 30px blur, 1 → 0px blur
  const blur = pixelSize <= 1 ? 0 : Math.round((pixelSize / 40) * 30);
  const contrast = pixelSize <= 1 ? 1 : 1 + (pixelSize / 40) * 0.3;
  const saturate = pixelSize <= 1 ? 1 : 1 - (pixelSize / 40) * 0.5;

  return (
    <div
      className="overflow-hidden rounded-2xl bg-input"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover transition-[filter] duration-500"
        style={{
          filter: `blur(${blur}px) contrast(${contrast}) saturate(${saturate})`,
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
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
    const colors = ["#f97316", "#10b981", "#3b82f6", "#eab308", "#ef4444", "#8b5cf6", "#ec4899"];
    const particles: { x: number; y: number; vx: number; vy: number; w: number; h: number; color: string; rot: number; vr: number; life: number }[] = [];
    for (const bp of [{ x: canvas.width * 0.3, y: canvas.height * 0.3 }, { x: canvas.width * 0.7, y: canvas.height * 0.3 }, { x: canvas.width * 0.5, y: canvas.height * 0.2 }]) {
      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 8;
        particles.push({ x: bp.x, y: bp.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4, w: 4 + Math.random() * 6, h: 6 + Math.random() * 10, color: colors[Math.floor(Math.random() * colors.length)], rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.3, life: 1 });
      }
    }
    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.99; p.rot += p.vr; p.life -= 0.008;
        ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot); ctx!.globalAlpha = Math.min(p.life * 2, 1); ctx!.fillStyle = p.color; ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx!.restore();
      }
      if (alive) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-50 pointer-events-none" style={{ width: "100vw", height: "100vh" }} />;
}

/* ─── Main component ─── */

export default function HoopixlGame({ players }: { players: HoopixlPlayer[] }) {
  const [guessIds, setGuessIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [won, setWon] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const target = useMemo(() => {
    if (players.length === 0) return null;
    const idx = getDailyPlayerIndex(players.length);
    return players[idx];
  }, [players]);

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  const lost = !won && guessIds.length >= MAX_GUESSES;
  const gameOver = won || lost;

  // Pixel size: starts at 40, decreases to 1 over REVEAL_DURATION seconds
  // Each wrong guess also reveals more
  const pixelSize = useMemo(() => {
    if (gameOver) return 1; // fully revealed
    const timeProgress = Math.min(elapsed / REVEAL_DURATION, 1);
    const guessProgress = guessIds.length / MAX_GUESSES;
    const progress = Math.max(timeProgress, guessProgress * 0.8);
    // Exponential curve: starts very pixelated, gets clearer faster at the end
    const size = Math.max(1, Math.round(40 * Math.pow(1 - progress, 2)));
    return size;
  }, [elapsed, guessIds.length, gameOver]);

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load state
  useEffect(() => {
    if (!target) return;
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setGuessIds(data.guesses || []);
        setWon(data.won || false);
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

  // Save state
  useEffect(() => {
    if (!target || !loaded) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ guesses: guessIds, won, elapsed, submitted, startTime }));
  }, [guessIds, won, target, loaded, elapsed, submitted, startTime]);

  // Timer
  useEffect(() => {
    if (!loaded || gameOver || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 200); // faster tick for smooth pixelation
    return () => clearInterval(interval);
  }, [loaded, gameOver, startTime]);

  // Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hoopixl_scores")
      .select("display_name, guesses, time_seconds, won")
      .eq("game_date", gameDate)
      .eq("won", true)
      .order("time_seconds", { ascending: true })
      .order("guesses", { ascending: true })
      .limit(15);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Submit score
  const submitScore = useCallback(async (guessCount: number, didWin: boolean) => {
    if (submitted || !userId) return;
    const supabase = createClient();
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    setElapsed(finalTime);
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
    await supabase.from("hoopixl_scores").upsert({
      user_id: userId, display_name: profile?.display_name || "Anonyme",
      game_date: gameDate, guesses: guessCount, time_seconds: finalTime, won: didWin,
    }, { onConflict: "user_id,game_date" });
    setSubmitted(true);
    fetchLeaderboard();
  }, [submitted, userId, startTime, gameDate, fetchLeaderboard]);

  // Auto-submit on login
  useEffect(() => {
    if (!userId || submitted || !loaded) return;
    if (!gameOver) return;
    submitScore(guessIds.length, won);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loaded]);

  // Close dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalize(search);
    return players
      .filter((p) => normalize(p.name).includes(q) && !guessIds.includes(p.id))
      .slice(0, 8);
  }, [search, players, guessIds]);

  function handleGuess(player: HoopixlPlayer) {
    if (gameOver || !target || guessIds.includes(player.id)) return;
    const newGuesses = [...guessIds, player.id];
    setGuessIds(newGuesses);
    setSearch("");
    setShowDropdown(false);
    if (player.id === target.id) {
      setWon(true);
      setShowConfetti(true);
      submitScore(newGuesses.length, true);
    } else if (newGuesses.length >= MAX_GUESSES) {
      submitScore(newGuesses.length, false);
    }
  }

  function buildShareText(): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const result = won
      ? `Trouv\u00e9 en ${guessIds.length} essai${guessIds.length > 1 ? "s" : ""} (${formatTime(elapsed)})`
      : `Pas trouv\u00e9 en ${MAX_GUESSES} essais`;
    const clarity = won ? Math.round((1 - Math.pow(Math.max(0, 1 - elapsed / REVEAL_DURATION), 2)) * 100) : 100;
    return `Hoopixl \u{1F5BC}\u{FE0F} ${dateStr}\n\n\u{1F50D} Clart\u00e9 : ${clarity}%\n${result}\n\nhttps://www.hoopus.fr/mini-jeux/hoopixl`;
  }

  function handleShare() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}`, "_blank", "width=550,height=420");
  }

  if (!target) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">Aucun joueur disponible.</div>;
  }

  const imgSize = typeof window !== "undefined" && window.innerWidth < 640 ? 200 : 280;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-3 sm:px-0 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="pt-4 space-y-4">
        <Link href="/mini-jeux" className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors">
          <RotateCcw size={12} /> Tous les mini-jeux
        </Link>

        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Hoop<span className="text-accent">ixl</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            {gameOver ? (won ? `Trouv\u00e9 en ${formatTime(elapsed)} !` : "Partie termin\u00e9e") : "Qui se cache derri\u00e8re les pixels ?"}
          </p>
        </div>

        {!userId && (
          <div className="rounded-lg bg-input/50 border border-border-t px-4 py-2.5 text-center text-xs text-text-muted">
            <LogIn size={12} className="inline mr-1.5 -mt-0.5" />
            <Link href="/auth/login" className="text-accent-text hover:underline">Connecte-toi</Link> pour enregistrer ton score au classement
          </div>
        )}
      </div>

      {/* Image + timer */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <PixelatedImage
            src={playerPhotoUrl(target.id)}
            pixelSize={pixelSize}
            size={imgSize}
          />
          {/* Clarity indicator */}
          {!gameOver && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-sm px-2 py-1 text-[10px] font-bold text-white">
              <Eye size={10} />
              {Math.round((1 - Math.pow(Math.max(0, 1 - elapsed / REVEAL_DURATION), 2)) * 100)}%
            </div>
          )}
        </div>

        {/* Timer + guess count */}
        {!gameOver && loaded && (
          <div className="flex items-center gap-4 text-xs text-text-faint">
            <span className="flex items-center gap-1"><Clock size={12} />{formatTime(elapsed)}</span>
            <span>{guessIds.length}/{MAX_GUESSES} essais</span>
          </div>
        )}
      </div>

      {/* Search */}
      {!gameOver && (
        <div className="relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Tape le nom d'un joueur..."
              className="w-full rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-accent transition-colors"
            />
          </div>
          {showDropdown && filteredPlayers.length > 0 && (
            <div ref={dropdownRef} className="absolute z-50 mt-1 w-full rounded-xl bg-card border border-border-t shadow-xl overflow-hidden">
              {filteredPlayers.map((p) => (
                <button key={p.id} onClick={() => handleGuess(p)} className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-card-hover transition-colors">
                  <img src={playerPhotoUrl(p.id)} alt="" className="h-8 w-8 rounded-full object-cover bg-input" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="flex-1 text-sm font-medium text-text-primary">{p.name}</span>
                  <img src={teamLogoUrl(p.team)} alt="" className="h-5 w-5 object-contain" />
                  <span className="text-xs text-text-faint">{p.team}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wrong guesses */}
      {guessIds.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {guessIds.map((id) => {
            const p = players.find((pl) => pl.id === id);
            if (!p) return null;
            const isCorrect = id === target.id;
            return (
              <div key={id} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                isCorrect ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}>
                {isCorrect ? <Check size={12} /> : <span>&times;</span>}
                {p.name}
              </div>
            );
          })}
        </div>
      )}

      {/* Win reveal */}
      {won && (
        <div className="rounded-2xl overflow-hidden border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-card p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={playerPhotoUrl(target.id)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover bg-input shadow-lg" />
              <img src={teamLogoUrl(target.team)} alt="" className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card rounded-full p-0.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Bravo !</p>
              <p className="text-xl sm:text-2xl font-extrabold text-text-primary mt-0.5">{target.name}</p>
              <p className="text-sm text-text-muted">{target.teamName} -- {target.position}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                  <Trophy size={11} /> {guessIds.length} essai{guessIds.length > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-text">
                  <Clock size={11} /> {formatTime(elapsed)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lost reveal */}
      {lost && (
        <div className="rounded-2xl overflow-hidden border border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-card p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={playerPhotoUrl(target.id)} alt="" className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl object-cover bg-input shadow-lg" />
              <img src={teamLogoUrl(target.team)} alt="" className="absolute -bottom-1 -right-1 h-7 w-7 object-contain bg-card rounded-full p-0.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Perdu !</p>
              <p className="text-xl sm:text-2xl font-extrabold text-text-primary mt-0.5">{target.name}</p>
              <p className="text-sm text-text-muted">{target.teamName} -- {target.position}</p>
            </div>
          </div>
        </div>
      )}

      {/* Share buttons */}
      {gameOver && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={handleShare} className="inline-flex items-center gap-2 rounded-xl bg-[#1DA1F2] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#1a8cd8] hover:scale-[1.03] active:scale-[0.98]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            Partager
          </button>
          <button onClick={() => navigator.clipboard.writeText(buildShareText())} className="inline-flex items-center gap-2 rounded-xl bg-input border border-border-t px-5 py-2.5 text-sm font-bold text-text-primary transition-all hover:bg-card-hover hover:scale-[1.03] active:scale-[0.98]">
            Copier
          </button>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
          <div className="px-4 py-3 border-b border-border-t">
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Trophy size={16} className="text-accent-text" />
              Classement du jour
            </h2>
          </div>
          <div className="divide-y divide-border-t/30">
            {leaderboard.map((entry, i) => (
              <div key={`${entry.display_name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                  i === 0 ? "bg-accent/20 text-accent-text" : i <= 2 ? "bg-input text-text-primary" : "text-text-faint"
                }`}>{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{entry.display_name}</span>
                <span className="text-xs text-text-faint tabular-nums w-12 text-right">{formatTime(entry.time_seconds)}</span>
                <span className="text-xs text-text-muted tabular-nums">{entry.guesses} essai{entry.guesses > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
