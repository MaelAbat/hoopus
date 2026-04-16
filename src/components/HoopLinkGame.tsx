"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Trophy, Clock, LogIn, Check, Search, Link2, Flag, ArrowRight } from "lucide-react";
import { teamLogoUrl, playerPhotoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import { ensureAuth, getDisplayName, isAnonymousName } from "@/lib/anonymous-auth";
import { useAchievementNotifier } from "@/components/AchievementProvider";
import { computeVisibleLeaderboard } from "@/lib/leaderboard-utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface HoopLinkPlayer {
  id: number;
  name: string;
  team: string;
  teamName: string;
  season: string;
}

export interface HoopLinkPuzzle {
  startId: number;
  endId: number;
  optimalLength: number;
  optimalPath: number[];
}

/** playerTeams: Record<playerId, "season|team"[]> */
export type PlayerTeamsMap = Record<number, string[]>;

/** adjacencyList: Record<playerId, playerId[]> (serializable version of Map<number, Set<number>>) */
export type AdjacencyList = Record<number, number[]>;

const MAX_CHAIN = 8;

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
  return `hooplink-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

/* ─── Connection logic ─── */

function findSharedTeams(aId: number, bId: number, playerTeams: PlayerTeamsMap): { season: string; team: string }[] {
  const aEntries = playerTeams[aId] || [];
  const bEntries = new Set(playerTeams[bId] || []);
  const shared: { season: string; team: string }[] = [];
  for (const entry of aEntries) {
    if (bEntries.has(entry)) {
      const [season, team] = entry.split("|");
      shared.push({ season, team });
    }
  }
  return shared;
}

/* ─── BFS + puzzle generation (client-side) ─── */

function bfs(startId: number, adj: AdjacencyList): { dist: Map<number, number>; parent: Map<number, number> } {
  const dist = new Map<number, number>();
  const parent = new Map<number, number>();
  dist.set(startId, 0);
  const queue = [startId];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist.get(cur)!;
    if (d >= 6) continue;
    for (const neighbor of adj[cur] || []) {
      if (!dist.has(neighbor)) {
        dist.set(neighbor, d + 1);
        parent.set(neighbor, cur);
        queue.push(neighbor);
      }
    }
  }
  return { dist, parent };
}

function reconstructPath(startId: number, endId: number, parent: Map<number, number>): number[] {
  const path: number[] = [];
  let cur = endId;
  while (parent.has(cur) && cur !== startId) {
    path.push(cur);
    cur = parent.get(cur)!;
  }
  path.reverse();
  if (path.length > 0 && path[path.length - 1] === endId) path.pop();
  return path;
}

function generatePuzzle(players: HoopLinkPlayer[], adj: AdjacencyList, seed: number): HoopLinkPuzzle | null {
  const rand = mulberry32(seed + 3333);
  const shuffled = [...players].sort(() => rand() - 0.5);

  for (const start of shuffled.slice(0, 40)) {
    if (!adj[start.id] || adj[start.id].length === 0) continue;
    const { dist, parent } = bfs(start.id, adj);

    // Tier 1: distance 2-3, different team
    let candidates = shuffled.filter(
      (p) => p.id !== start.id && p.team !== start.team &&
             dist.has(p.id) && dist.get(p.id)! >= 2 && dist.get(p.id)! <= 3
    );
    // Tier 2: distance 2+, any team
    if (!candidates.length) {
      candidates = shuffled.filter(
        (p) => p.id !== start.id && dist.has(p.id) && dist.get(p.id)! >= 2
      );
    }
    // Tier 3: distance 1, different team
    if (!candidates.length) {
      candidates = shuffled.filter(
        (p) => p.id !== start.id && p.team !== start.team &&
               dist.has(p.id) && dist.get(p.id)! >= 1
      );
    }
    // Tier 4: any connection
    if (!candidates.length) {
      candidates = shuffled.filter(
        (p) => p.id !== start.id && dist.has(p.id)
      );
    }

    if (candidates.length > 0) {
      const end = candidates[Math.floor(rand() * candidates.length)];
      const optimalPath = reconstructPath(start.id, end.id, parent);
      return { startId: start.id, endId: end.id, optimalLength: dist.get(end.id)!, optimalPath };
    }
  }

  // Absolute fallback: same team
  if (players.length >= 2) {
    return { startId: shuffled[0].id, endId: shuffled[1].id, optimalLength: 1, optimalPath: [] };
  }
  return null;
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

/* ─── Main ─── */

interface ChainLink {
  playerId: number;
  sharedTeams: { season: string; team: string }[];
}

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  chain_length: number;
  time_seconds: number;
  won: boolean;
}

interface Props {
  players: HoopLinkPlayer[];
  playerTeams: PlayerTeamsMap;
  adjacencyList: AdjacencyList;
}

export default function HoopLinkGame({ players, playerTeams, adjacencyList }: Props) {
  const pathname = usePathname();
  const { triggerCheck } = useAchievementNotifier();

  const baseDaySeed = useMemo(() => getDaySeed(), []);
  const [debugSeed, setDebugSeed] = useState(0);
  const activeSeed = baseDaySeed + debugSeed;

  const puzzle = useMemo(() =>
    generatePuzzle(players, adjacencyList, activeSeed) ?? { startId: 0, endId: 0, optimalLength: 0, optimalPath: [] as number[] },
  [players, adjacencyList, activeSeed]);

  const puzzleValid = puzzle.startId !== 0 && puzzle.endId !== 0;

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  const dummyPlayer: HoopLinkPlayer = { id: 0, name: "", team: "", teamName: "", season: "" };
  const startPlayer = useMemo(() => players.find((p) => p.id === puzzle.startId) ?? dummyPlayer, [players, puzzle.startId]);
  const endPlayer = useMemo(() => players.find((p) => p.id === puzzle.endId) ?? dummyPlayer, [players, puzzle.endId]);

  const playerMap = useMemo(() => {
    const map: Record<number, HoopLinkPlayer> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);

  // State
  const [chain, setChain] = useState<ChainLink[]>([]);
  const [won, setWon] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState("");
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const gameOver = won || gaveUp;
  const lastLinkId = chain.length > 0 ? chain[chain.length - 1].playerId : puzzle?.startId ?? 0;
  const usedIds = useMemo(() => {
    const ids = new Set(puzzle ? [puzzle.startId, puzzle.endId] : []);
    for (const link of chain) ids.add(link.playerId);
    return ids;
  }, [chain, puzzle]);

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

  // Admin reset (new puzzle)
  function handleAdminReset() {
    setDebugSeed((s) => s + 1);
    setChain([]);
    setWon(false);
    setGaveUp(false);
    setSearch("");
    setError("");
    setSubmitted(false);
    setShowConfetti(false);
    setCopied(false);
    setStartTime(Date.now());
    setElapsed(0);
    localStorage.removeItem(getStorageKey());
  }

  // Load saved state
  useEffect(() => {
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setChain(data.chain || []);
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
  }, []);

  // Save state
  useEffect(() => {
    if (!loaded) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ chain, won, gaveUp, elapsed, submitted, startTime }));
  }, [chain, won, gaveUp, loaded, elapsed, submitted, startTime]);

  // Timer
  useEffect(() => {
    if (!loaded || gameOver || !startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [loaded, gameOver, startTime]);

  // Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hooplink_scores")
      .select("user_id, display_name, chain_length, time_seconds, won")
      .eq("game_date", gameDate)
      .eq("won", true)
      .order("chain_length", { ascending: true })
      .order("time_seconds", { ascending: true })
      .limit(500);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Submit
  const submitScore = useCallback(async (chainLen: number, didWin: boolean) => {
    if (submitted) return;
    const supabase = createClient();
    const uid = userId || await ensureAuth(supabase);
    if (!uid) return;

    const finalTime = gameOver ? elapsed : Math.floor((Date.now() - startTime) / 1000);
    if (!gameOver) setElapsed(finalTime);

    const displayName = await getDisplayName(supabase, uid);

    await supabase.from("hooplink_scores").upsert({
      user_id: uid,
      display_name: displayName,
      game_date: gameDate,
      chain_length: chainLen,
      time_seconds: finalTime,
      won: didWin,
    }, { onConflict: "user_id,game_date" });

    setSubmitted(true);
    fetchLeaderboard();
    triggerCheck();
  }, [submitted, userId, startTime, elapsed, gameOver, gameDate, fetchLeaderboard, triggerCheck]);

  // Auto-submit on login
  useEffect(() => {
    if (!userId || submitted || !loaded || !gameOver) return;
    submitScore(chain.length, won);
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

  // Search filter
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredPlayers = useMemo(() => {
    if (!search.trim()) return [];
    const q = normalize(search);
    return players
      .filter((p) => normalize(p.name).includes(q) && !usedIds.has(p.id))
      .slice(0, 8);
  }, [search, players, usedIds]);

  // Handle guess
  function handleGuess(player: HoopLinkPlayer) {
    if (gameOver) return;
    setSearch("");
    setShowDropdown(false);
    setError("");

    // Check connection with last link
    const shared = findSharedTeams(lastLinkId, player.id, playerTeams);
    if (shared.length === 0) {
      const lastPlayer = playerMap[lastLinkId];
      const lastTeams = (playerTeams[lastLinkId] || []).map((e) => e.split("|")[1]);
      const guessTeams = (playerTeams[player.id] || []).map((e) => e.split("|")[1]);
      const debugInfo = isAdmin
        ? ` [DEBUG: ${lastPlayer?.name || lastLinkId} = ${lastTeams.join(",")||"vide"} | ${player.name} = ${guessTeams.join(",")||"vide"}]`
        : "";
      setError(`${player.name} n'a jamais été coéquipier de ${lastPlayer?.name || "ce joueur"}${debugInfo}`);
      return;
    }

    const newLink: ChainLink = { playerId: player.id, sharedTeams: shared };
    const newChain = [...chain, newLink];
    setChain(newChain);

    // Check if this player connects to the end
    const endShared = findSharedTeams(player.id, puzzle.endId, playerTeams);
    if (endShared.length > 0) {
      setWon(true);
      setShowConfetti(true);
      submitScore(newChain.length, true);
    } else if (newChain.length >= MAX_CHAIN) {
      setGaveUp(true);
      submitScore(newChain.length, false);
    }
  }

  function handleGiveUp() {
    setGaveUp(true);
    submitScore(chain.length, false);
  }

  // Share
  function buildShareText(): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const result = won
      ? `\u{1F517} ${chain.length} maillon${chain.length > 1 ? "s" : ""} (optimal : ${puzzle.optimalLength})`
      : "Pas trouvé";
    return `HoopLink \u{1F3C0} ${dateStr}\n\n${startPlayer.name} \u2192 ${endPlayer.name}\n${result} (${formatTime(elapsed)})\n\nhttps://www.hoopus.fr/mini-jeux/hooplink`;
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

  if (!puzzleValid || !startPlayer.id || !endPlayer.id) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">
        Pas assez de données pour générer un puzzle. Synchronisez les rosters.
      </div>
    );
  }

  // Connection info for the last chain link to end player (shown on win)
  const finalConnection = won && chain.length > 0
    ? findSharedTeams(chain[chain.length - 1].playerId, puzzle.endId, playerTeams)
    : [];

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
              Recommencer
            </button>
          )}
        </div>

        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border-t bg-gradient-to-br from-violet-500/10 via-card to-card">
          <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 opacity-[0.07]">
            <Link2 className="w-full h-full text-violet-500" />
          </div>
          <div className="relative px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-violet-500/30 to-violet-500/10 border-2 border-violet-500/40 flex items-center justify-center">
                <Link2 size={32} className="text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                  Hoop<span className="text-violet-500">Link</span>
                </h1>
                <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                  {won ? `Chaîne complétée en ${chain.length} maillon${chain.length > 1 ? "s" : ""} !`
                    : gaveUp ? "Partie terminée"
                    : "Trouve le chemin le plus court entre ces deux joueurs"}
                </p>
                {loaded && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold text-violet-400">
                      <Link2 size={11} /> {chain.length}/{MAX_CHAIN}
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

      </div>

      {/* Chain visualization */}
      <div className="space-y-0">
        {/* Start player */}
        <PlayerNode
          player={startPlayer}
          label="Départ"
          color="violet"
        />

        {/* Chain links */}
        {chain.map((link, i) => {
          const player = playerMap[link.playerId];
          if (!player) return null;
          return (
            <div key={link.playerId}>
              <ConnectionLine sharedTeams={link.sharedTeams} />
              <PlayerNode
                player={player}
                label={`Maillon ${i + 1}`}
                color="violet"
              />
            </div>
          );
        })}

        {/* Final connection to end (on win) */}
        {won && finalConnection.length > 0 && (
          <ConnectionLine sharedTeams={finalConnection} />
        )}

        {/* Pending slots */}
        {!gameOver && chain.length < MAX_CHAIN && (
          <>
            <div className="flex justify-center py-1">
              <div className="w-0.5 h-6 bg-border-t" />
            </div>
            <div className="flex justify-center">
              <div className="rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 px-6 py-3 text-center">
                <p className="text-xs text-violet-400/60 font-medium">?</p>
              </div>
            </div>
          </>
        )}

        {/* End player */}
        <div className="flex justify-center py-1">
          <div className={`w-0.5 h-6 ${won ? "bg-emerald-500" : "bg-border-t"}`} />
        </div>
        <PlayerNode
          player={endPlayer}
          label="Arrivée"
          color={won ? "emerald" : "slate"}
        />
      </div>

      {/* Rules + team hint */}
      {loaded && !gameOver && (
        <div className="rounded-xl bg-input/50 border border-border-t px-4 py-3 space-y-3">
          {chain.length === 0 ? (
            <>
              <p className="text-xs text-text-primary text-center font-bold">Comment jouer ?</p>
              <p className="text-xs text-text-muted text-center leading-relaxed">
                Trouve des joueurs intermédiaires pour relier le <span className="font-bold text-violet-400">départ</span> à l'<span className="font-bold text-text-primary">arrivée</span>.
                Chaque maillon doit partager la <span className="font-bold text-text-primary">même équipe</span> que le précédent (même saison).
              </p>
              <div className="text-[11px] text-text-faint text-center leading-relaxed italic">
                Ex : LeBron (LAL) → Anthony Davis (LAL/NOP) → Zion (NOP)
              </div>
            </>
          ) : (
            <LastLinkTeamsHint lastLinkId={lastLinkId} players={players} />
          )}
          <p className="text-[11px] text-text-faint text-center">
            Chemin le plus court : {puzzle.optimalLength} maillon{puzzle.optimalLength > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Search input */}
      {!gameOver && loaded && (
        <div className="relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setError(""); }}
              onFocus={(e) => {
                setShowDropdown(true);
                setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
              }}
              placeholder="Tape le nom d'un joueur..."
              className="w-full rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {showDropdown && filteredPlayers.length > 0 && (
            <div ref={dropdownRef} className="absolute z-50 mt-1 w-full rounded-xl bg-card border border-border-t shadow-xl overflow-hidden">
              {filteredPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleGuess(p)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-card-hover transition-colors"
                >
                  <img
                    src={playerPhotoUrl(p.id)}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover bg-input"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                  </div>
                  <img src={teamLogoUrl(p.team)} alt={p.team} className="h-5 w-5 object-contain" />
                  <span className="text-xs text-text-faint">{p.team}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-center text-xs text-red-400 animate-[shakeX_0.4s_ease-out]">
          {error}
        </div>
      )}

      {/* Give up button */}
      {!gameOver && loaded && (
        <div className="text-center">
          <button
            onClick={handleGiveUp}
            className="inline-flex items-center gap-1.5 text-xs text-text-faint hover:text-red-400 transition-colors"
          >
            <Flag size={12} />
            Abandonner
          </button>
        </div>
      )}

      {/* Win/lose result */}
      {gameOver && loaded && (
        <>
          <div className={`rounded-2xl overflow-hidden border p-5 sm:p-6 ${
            won
              ? "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-card"
              : "border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-card"
          }`}>
            <div className="text-center space-y-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${won ? "text-emerald-400" : "text-red-400"}`}>
                {won
                  ? chain.length <= puzzle.optimalLength ? "Chemin optimal !" : "Chaîne complétée !"
                  : "Abandonné"}
              </p>
              {won && (
                <div className="flex items-center justify-center gap-2">
                  <Link2 size={28} className="text-violet-400" />
                  <span className="text-4xl sm:text-5xl font-black text-text-primary">{chain.length}</span>
                  <span className="text-xl text-text-faint font-bold">maillon{chain.length > 1 ? "s" : ""}</span>
                </div>
              )}
              <div className="flex items-center justify-center gap-4 text-xs text-text-faint">
                <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(elapsed)}</span>
                <span>Optimal : {puzzle.optimalLength}</span>
              </div>
            </div>
          </div>

          {/* Optimal path reveal on give up */}
          {gaveUp && puzzle.optimalPath.length > 0 && (
            <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
              <div className="px-4 py-3 border-b border-border-t">
                <h2 className="text-sm font-bold text-text-primary">Un chemin possible</h2>
              </div>
              <div className="px-4 py-3 space-y-0">
                {/* Start */}
                <div className="flex items-center gap-2.5 py-1.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">D</div>
                  <img src={playerPhotoUrl(startPlayer.id)} alt="" className="h-7 w-7 rounded-full object-cover bg-input" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-sm font-medium text-text-primary">{startPlayer.name}</span>
                  <img src={teamLogoUrl(startPlayer.team)} alt="" className="h-4 w-4 object-contain ml-auto" />
                </div>
                {/* Path intermediaries */}
                {puzzle.optimalPath.map((pid, i) => {
                  const p = playerMap[pid];
                  if (!p) return null;
                  const connFrom = i === 0 ? startPlayer.id : puzzle.optimalPath[i - 1];
                  const shared = findSharedTeams(connFrom, pid, playerTeams);
                  const bestShared = shared.sort((a, b) => b.season.localeCompare(a.season))[0];
                  return (
                    <div key={pid}>
                      {bestShared && (
                        <div className="flex items-center gap-1.5 pl-8 py-0.5">
                          <div className="w-0.5 h-3 bg-violet-500/30 mr-1" />
                          <img src={teamLogoUrl(bestShared.team)} alt="" className="h-3 w-3 object-contain" />
                          <span className="text-[10px] text-text-faint">{bestShared.team} {bestShared.season}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 py-1.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-bold text-violet-400">{i + 1}</div>
                        <img src={playerPhotoUrl(p.id)} alt="" className="h-7 w-7 rounded-full object-cover bg-input" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <span className="text-sm font-medium text-text-primary">{p.name}</span>
                        <img src={teamLogoUrl(p.team)} alt="" className="h-4 w-4 object-contain ml-auto" />
                      </div>
                    </div>
                  );
                })}
                {/* Connection to end */}
                {(() => {
                  const lastPathId = puzzle.optimalPath.length > 0 ? puzzle.optimalPath[puzzle.optimalPath.length - 1] : startPlayer.id;
                  const shared = findSharedTeams(lastPathId, endPlayer.id, playerTeams);
                  const bestShared = shared.sort((a, b) => b.season.localeCompare(a.season))[0];
                  return bestShared ? (
                    <div className="flex items-center gap-1.5 pl-8 py-0.5">
                      <div className="w-0.5 h-3 bg-violet-500/30 mr-1" />
                      <img src={teamLogoUrl(bestShared.team)} alt="" className="h-3 w-3 object-contain" />
                      <span className="text-[10px] text-text-faint">{bestShared.team} {bestShared.season}</span>
                    </div>
                  ) : null;
                })()}
                {/* End */}
                <div className="flex items-center gap-2.5 py-1.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">A</div>
                  <img src={playerPhotoUrl(endPlayer.id)} alt="" className="h-7 w-7 rounded-full object-cover bg-input" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-sm font-medium text-text-primary">{endPlayer.name}</span>
                  <img src={teamLogoUrl(endPlayer.team)} alt="" className="h-4 w-4 object-contain ml-auto" />
                </div>
              </div>
            </div>
          )}

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
                    <span className="text-xs text-text-muted tabular-nums flex items-center gap-1">
                      <Link2 size={11} className="text-violet-400" /> {row.entry.chain_length}
                    </span>
                    <span className="text-xs text-text-faint tabular-nums w-12 text-right">{formatTime(row.entry.time_seconds)}</span>
                  </div>
                )
              )}
            </div>
          </div>
        );
      })()}

      <style jsx global>{`
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Sub-components ─── */

function PlayerNode({ player, label, color }: { player: HoopLinkPlayer; label: string; color: string }) {
  const colorClasses: Record<string, string> = {
    violet: "border-violet-500/30 bg-violet-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    slate: "border-border-t bg-card",
  };

  return (
    <div className="flex justify-center">
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${colorClasses[color] || colorClasses.slate}`}>
        <div className="relative shrink-0">
          <img
            src={playerPhotoUrl(player.id)}
            alt=""
            className="h-12 w-12 rounded-full object-cover bg-input"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <img
            src={teamLogoUrl(player.team)}
            alt=""
            className="absolute -bottom-0.5 -right-0.5 h-5 w-5 object-contain bg-card rounded-full p-0.5"
          />
        </div>
        <div>
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-wider">{label}</p>
          <p className="text-sm font-bold text-text-primary">{player.name}</p>
          <p className="text-xs text-text-faint">{player.teamName}</p>
        </div>
      </div>
    </div>
  );
}

function ConnectionLine({ sharedTeams }: { sharedTeams: { season: string; team: string }[] }) {
  const best = sharedTeams.sort((a, b) => b.season.localeCompare(a.season))[0];

  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-0.5 h-3 bg-violet-500/40" />
      <div className="flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5">
        {teamLogoUrl(best.team) && <img src={teamLogoUrl(best.team)} alt="" className="h-3.5 w-3.5 object-contain" />}
        <span className="text-[10px] font-bold text-violet-400">{best.team}</span>
        <span className="text-[10px] text-text-faint">{best.season}</span>
      </div>
      <div className="w-0.5 h-3 bg-violet-500/40" />
    </div>
  );
}

function LastLinkTeamsHint({ lastLinkId, players }: { lastLinkId: number; players: HoopLinkPlayer[] }) {
  const player = players.find((p) => p.id === lastLinkId);
  if (!player) return null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-xs text-text-muted text-center">
        Trouve un coéquipier (actuel ou passé) de <span className="font-bold text-text-primary">{player.name}</span>
      </p>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-3 py-1">
        <img src={teamLogoUrl(player.team)} alt="" className="h-4 w-4 object-contain" />
        <span className="text-xs font-bold text-violet-400">{player.teamName}</span>
      </span>
    </div>
  );
}
