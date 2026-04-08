"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { RotateCcw, Trophy, Clock, LogIn, Check, Search, Flag } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NameEntry {
  name: string;
  team: string;
}

interface LeaderboardEntry {
  display_name: string;
  words_found: number;
  total_words: number;
  time_seconds: number;
  won: boolean;
}

interface PlacedWord {
  word: string;
  team: string;
  startRow: number;
  startCol: number;
  dRow: number;
  dCol: number;
}

type Cell = { letter: string; wordIndices: number[] };

const DEFAULT_GRID_SIZE = 10;

// Directions: horizontal, vertical, diagonal (all 8)
const DIRECTIONS = [
  [0, 1], [0, -1], [1, 0], [-1, 0],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

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

function getDaySeed(offset = 0): number {
  const now = new Date();
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate() + offset;
}

interface Puzzle {
  grid: Cell[][];
  words: PlacedWord[];
  mystery: NameEntry;
  gridSize: number;
}

/* ─── Grid generation ─── */

function generateGrid(
  allNames: NameEntry[],
  seed: number,
  gridSize: number = DEFAULT_GRID_SIZE
): Puzzle | null {
  const rand = mulberry32(seed);
  const maxWordLen = Math.min(gridSize, 9);

  const shuffled = [...allNames].sort(() => rand() - 0.5);
  const wordPool = shuffled.filter((n) => n.name.length >= 3 && n.name.length <= maxWordLen);

  // Index mystery candidates by name length for fast lookup
  const mysteryByLen = new Map<number, NameEntry[]>();
  for (const n of shuffled) {
    if (n.name.length < 4 || n.name.length > 20) continue;
    const arr = mysteryByLen.get(n.name.length) || [];
    arr.push(n);
    mysteryByLen.set(n.name.length, arr);
  }

  // Strategy: place words first, then find a mystery player whose name
  // length matches the leftover cells. Add/remove words to adjust.
  for (let attempt = 0; attempt < 200; attempt++) {
    const grid: string[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => "")
    );
    const placed: PlacedWord[] = [];
    const candidates = [...wordPool].sort(() => rand() - 0.5);
    const usedNames = new Set<string>();

    for (const entry of candidates) {
      if (placed.length >= 25) break;
      if (usedNames.has(entry.name)) continue;
      const result = tryPlaceWord(grid, entry.name, entry.team, rand, gridSize);
      if (result) {
        placed.push(result);
        usedNames.add(entry.name);
      }
    }

    if (placed.length < 4) continue;

    for (let keep = placed.length; keep >= 4; keep--) {
      const testGrid: string[][] = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => "")
      );
      const keptWords = placed.slice(0, keep);
      for (const w of keptWords) {
        for (let i = 0; i < w.word.length; i++) {
          testGrid[w.startRow + i * w.dRow][w.startCol + i * w.dCol] = w.word[i];
        }
      }

      let emptyCells = 0;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!testGrid[r][c]) emptyCells++;
        }
      }

      const candidates2 = mysteryByLen.get(emptyCells);
      if (!candidates2 || candidates2.length === 0) continue;
      const mystery = candidates2.find((n) => !usedNames.has(n.name));
      if (!mystery) continue;

      const shuffledLetters = mystery.name.split("");
      for (let i = shuffledLetters.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffledLetters[i], shuffledLetters[j]] = [shuffledLetters[j], shuffledLetters[i]];
      }
      let mi = 0;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!testGrid[r][c]) {
            testGrid[r][c] = shuffledLetters[mi++];
          }
        }
      }

      const cellGrid: Cell[][] = testGrid.map((row) =>
        row.map((letter) => ({ letter, wordIndices: [] }))
      );
      for (let wi = 0; wi < keptWords.length; wi++) {
        const w = keptWords[wi];
        for (let i = 0; i < w.word.length; i++) {
          cellGrid[w.startRow + i * w.dRow][w.startCol + i * w.dCol].wordIndices.push(wi);
        }
      }

      return { grid: cellGrid, words: keptWords, mystery, gridSize };
    }
  }

  return null;
}

function tryPlaceWord(
  grid: string[][],
  word: string,
  team: string,
  rand: () => number,
  size: number
): PlacedWord | null {
  for (let a = 0; a < 150; a++) {
    const dirIdx = Math.floor(rand() * DIRECTIONS.length);
    const [dRow, dCol] = DIRECTIONS[dirIdx];
    const maxRow = dRow === 0 ? size - 1 : dRow > 0 ? size - word.length : word.length - 1;
    const maxCol = dCol === 0 ? size - 1 : dCol > 0 ? size - word.length : word.length - 1;
    const minRow = dRow === 0 ? 0 : dRow > 0 ? 0 : word.length - 1;
    const minCol = dCol === 0 ? 0 : dCol > 0 ? 0 : word.length - 1;

    if (minRow > maxRow || minCol > maxCol) continue;

    const startRow = minRow + Math.floor(rand() * (maxRow - minRow + 1));
    const startCol = minCol + Math.floor(rand() * (maxCol - minCol + 1));

    let fits = true;
    for (let i = 0; i < word.length; i++) {
      const r = startRow + i * dRow;
      const c = startCol + i * dCol;
      if (r < 0 || r >= size || c < 0 || c >= size) { fits = false; break; }
      const existing = grid[r][c];
      if (existing && existing !== word[i]) { fits = false; break; }
    }
    if (!fits) continue;

    for (let i = 0; i < word.length; i++) {
      grid[startRow + i * dRow][startCol + i * dCol] = word[i];
    }
    return { word, team, startRow, startCol, dRow, dCol };
  }
  return null;
}

/* ─── Helpers ─── */

function getStorageKey(): string {
  const now = new Date();
  return `hoopgrid-${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function cellKey(r: number, c: number) {
  return `${r}-${c}`;
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

export default function HoopGridGame({ allNames }: { allNames: NameEntry[] }) {
  const pathname = usePathname();
  const [foundWords, setFoundWords] = useState<number[]>([]);
  const [selecting, setSelecting] = useState<{ row: number; col: number }[]>([]);
  const [mysteryGuess, setMysteryGuess] = useState("");
  const [mysteryFound, setMysteryFound] = useState(false);
  const [mysteryWrong, setMysteryWrong] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const mysteryInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const [debugSeed, setDebugSeed] = useState(0);
  const [debugGridSize, setDebugGridSize] = useState<number | null>(null);

  const gameDate = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }, []);

  // Generate today's grid (or debug grid)
  const puzzle = useMemo(() => {
    if (allNames.length < 30) return null;
    const baseSeed = getDaySeed(5555) + debugSeed;
    // Daily grid size: deterministic from day seed, between 8 and 11
    const dailySize = debugGridSize ?? (8 + (baseSeed % 4));
    for (let i = 0; i < 50; i++) {
      const result = generateGrid(allNames, baseSeed + i, dailySize);
      if (result) return result;
    }
    return null;
  }, [allNames, debugSeed, debugGridSize]);

  const actualGridSize = puzzle?.gridSize ?? DEFAULT_GRID_SIZE;
  const grid = puzzle?.grid;
  const words = puzzle?.words || [];
  const mystery = puzzle?.mystery;
  const allWordsFound = foundWords.length === words.length && words.length > 0;
  const won = allWordsFound && mysteryFound;
  const gameOver = won || gaveUp;

  function handleDebugNewGrid() {
    setDebugSeed((s) => s + 1000);
    setFoundWords([]);
    setMysteryGuess("");
    setMysteryFound(false);
    setMysteryWrong(false);
    setGaveUp(false);
    setSubmitted(false);
    setStartTime(Date.now());
    setElapsed(0);
    setShowConfetti(false);
    localStorage.removeItem(getStorageKey());
  }

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

  // Load state
  useEffect(() => {
    if (!grid) return;
    const key = getStorageKey();
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const data = JSON.parse(saved);
        setFoundWords(data.foundWords || []);
        setMysteryFound(data.mysteryFound || false);
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
  }, [grid]);

  // Save state
  useEffect(() => {
    if (!loaded || !grid) return;
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify({ foundWords, mysteryFound, gaveUp, elapsed, submitted, startTime }));
  }, [foundWords, mysteryFound, gaveUp, elapsed, submitted, startTime, loaded, grid]);

  // Timer
  useEffect(() => {
    if (!loaded || gameOver || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [loaded, gameOver, startTime]);

  // Leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("hoopgrid_scores")
      .select("display_name, words_found, total_words, time_seconds, won")
      .eq("game_date", gameDate)
      .eq("won", true)
      .order("time_seconds", { ascending: true })
      .limit(15);
    setLeaderboard(data || []);
  }, [gameDate]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Submit score
  const submitScore = useCallback(async (wordsFound: number, didWin: boolean) => {
    if (submitted || !userId) return;
    const supabase = createClient();
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    setElapsed(finalTime);
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
    await supabase.from("hoopgrid_scores").upsert({
      user_id: userId,
      display_name: profile?.display_name || "Anonyme",
      game_date: gameDate,
      words_found: wordsFound,
      total_words: words.length,
      time_seconds: finalTime,
      won: didWin,
    }, { onConflict: "user_id,game_date" });
    setSubmitted(true);
    fetchLeaderboard();
  }, [submitted, userId, startTime, gameDate, words.length, fetchLeaderboard]);

  // Auto-submit on login
  useEffect(() => {
    if (!userId || submitted || !loaded || !gameOver) return;
    submitScore(foundWords.length, won);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loaded]);

  // Selection logic — get cells along a line
  function getCellsInLine(start: { row: number; col: number }, end: { row: number; col: number }) {
    const dr = end.row - start.row;
    const dc = end.col - start.col;
    const len = Math.max(Math.abs(dr), Math.abs(dc));
    if (len === 0) return [start];

    // Snap to valid direction (horizontal, vertical, diagonal)
    const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
    const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;

    // Only allow straight lines
    if (Math.abs(dr) !== Math.abs(dc) && dr !== 0 && dc !== 0) return [start];

    const cells: { row: number; col: number }[] = [];
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    for (let i = 0; i <= steps; i++) {
      const r = start.row + i * stepR;
      const c = start.col + i * stepC;
      if (r < 0 || r >= actualGridSize || c < 0 || c >= actualGridSize) break;
      cells.push({ row: r, col: c });
    }
    return cells;
  }

  function checkSelection(cells: { row: number; col: number }[]) {
    if (cells.length < 3) return;
    const selectedWord = cells.map((c) => grid![c.row][c.col].letter).join("");

    for (let wi = 0; wi < words.length; wi++) {
      if (foundWords.includes(wi)) continue;
      const w = words[wi];
      if (selectedWord === w.word || selectedWord === w.word.split("").reverse().join("")) {
        const newFound = [...foundWords, wi];
        setFoundWords(newFound);
        // Focus mystery input when all words found
        if (newFound.length === words.length) {
          setTimeout(() => mysteryInputRef.current?.focus(), 300);
        }
        return;
      }
    }
  }

  // Touch/mouse handlers for grid
  function getCellFromEvent(e: React.TouchEvent | React.MouseEvent): { row: number; col: number } | null {
    const gridEl = gridRef.current;
    if (!gridEl) return null;
    const rect = gridEl.getBoundingClientRect();
    const cellSize = rect.width / actualGridSize;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
      clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const col = Math.floor((clientX - rect.left) / cellSize);
    const row = Math.floor((clientY - rect.top) / cellSize);
    if (row < 0 || row >= actualGridSize || col < 0 || col >= actualGridSize) return null;
    return { row, col };
  }

  function handleStart(e: React.TouchEvent | React.MouseEvent) {
    if (gameOver) return;
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (!cell) return;
    isDragging.current = true;
    setSelecting([cell]);
  }

  function handleMove(e: React.TouchEvent | React.MouseEvent) {
    if (!isDragging.current || gameOver) return;
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (!cell || selecting.length === 0) return;
    const line = getCellsInLine(selecting[0], cell);
    setSelecting(line);
  }

  function handleEnd(e: React.TouchEvent | React.MouseEvent) {
    if (!isDragging.current) return;
    e.preventDefault();
    isDragging.current = false;
    checkSelection(selecting);
    setSelecting([]);
  }

  // Determine highlighted cells
  const selectingSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of selecting) set.add(cellKey(c.row, c.col));
    return set;
  }, [selecting]);

  const foundCells = useMemo(() => {
    const set = new Set<string>();
    for (const wi of foundWords) {
      const w = words[wi];
      for (let i = 0; i < w.word.length; i++) {
        set.add(cellKey(w.startRow + i * w.dRow, w.startCol + i * w.dCol));
      }
    }
    return set;
  }, [foundWords, words]);

  // Cells that are NOT part of any word = mystery letter cells
  const mysteryCells = useMemo(() => {
    if (!grid) return new Set<string>();
    const allWordCells = new Set<string>();
    for (const w of words) {
      for (let i = 0; i < w.word.length; i++) {
        allWordCells.add(cellKey(w.startRow + i * w.dRow, w.startCol + i * w.dCol));
      }
    }
    const set = new Set<string>();
    for (let r = 0; r < actualGridSize; r++) {
      for (let c = 0; c < actualGridSize; c++) {
        if (!allWordCells.has(cellKey(r, c))) set.add(cellKey(r, c));
      }
    }
    return set;
  }, [grid, words]);

  // Mystery guess
  function handleMysterySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mystery || mysteryFound) return;
    const guess = mysteryGuess.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (guess === mystery.name) {
      setMysteryFound(true);
      setShowConfetti(true);
      submitScore(foundWords.length, true);
    } else {
      setMysteryWrong(true);
      setTimeout(() => setMysteryWrong(false), 1500);
    }
  }

  // Give up
  function handleGiveUp() {
    if (gameOver) return;
    setGaveUp(true);
    setFoundWords(words.map((_, i) => i));
    submitScore(foundWords.length, false);
  }

  // Share
  function buildShareText(): string {
    const today = new Date();
    const dateStr = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    return `HoopGrid \u{1F50E} ${dateStr}\n\n\u{2705} ${foundWords.length}/${words.length} mots barr\u00e9s\n\u{1F3C0} Joueur myst\u00e8re trouv\u00e9\n\u{23F1}\u{FE0F} ${formatTime(elapsed)}\n\nhttps://www.hoopus.fr/mini-jeux/hoopgrid`;
  }

  function handleShare() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(buildShareText())}`, "_blank", "width=550,height=420");
  }

  if (!puzzle || !grid) {
    return <div className="mx-auto max-w-4xl px-4 py-16 text-center text-text-muted">Pas assez de joueurs pour g&eacute;n&eacute;rer la grille.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 sm:px-0 pb-8">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/mini-jeux" className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors">
            <RotateCcw size={12} /> Tous les mini-jeux
          </Link>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <select
                value={debugGridSize ?? ""}
                onChange={(e) => { setDebugGridSize(e.target.value ? Number(e.target.value) : null); handleDebugNewGrid(); }}
                className="rounded-lg bg-input px-2 py-1.5 text-xs font-medium text-text-muted outline-none"
              >
                <option value="">Auto</option>
                {[7, 8, 9, 10, 11, 12].map((s) => (
                  <option key={s} value={s}>{s}x{s}</option>
                ))}
              </select>
              <button
                onClick={handleDebugNewGrid}
                className="inline-flex items-center gap-1.5 rounded-lg bg-input px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
              >
                <RotateCcw size={12} /> Nouvelle grille
              </button>
            </div>
          )}
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Hoop<span className="text-accent">Grid</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            {gaveUp
              ? "Partie abandonn\u00e9e"
              : won
                ? `Joueur myst\u00e8re trouv\u00e9 en ${formatTime(elapsed)} !`
                : allWordsFound
                  ? "Devine le joueur myst\u00e8re !"
                  : "Barre les noms pour r\u00e9v\u00e9ler le joueur myst\u00e8re"
            }
          </p>
        </div>

        {!userId && (
          <div className="rounded-lg bg-input/50 border border-border-t px-4 py-2.5 text-center text-xs text-text-muted">
            <LogIn size={12} className="inline mr-1.5 -mt-0.5" />
            <Link href={`/auth/login?redirect=${encodeURIComponent(pathname)}`} className="text-accent-text hover:underline">Connecte-toi</Link> pour enregistrer ton score au classement
          </div>
        )}

        {/* Progress */}
        {loaded && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-text-faint">{foundWords.length}/{words.length} mots</span>
              <div className="flex items-center gap-2">
                {!gameOver && (
                  <button
                    onClick={handleGiveUp}
                    className="flex items-center gap-1 text-text-faint hover:text-red-400 transition-colors"
                  >
                    <Flag size={10} />
                    Abandonner
                  </button>
                )}
                <span className="flex items-center gap-1 text-text-faint">
                  <Clock size={10} />
                  {formatTime(elapsed)}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-input overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${gaveUp ? "bg-red-500/60" : "bg-gradient-to-r from-accent to-accent-hover"}`}
                style={{ width: `${(foundWords.length / words.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid + word lists layout */}
      {(() => {
        const half = Math.ceil(words.length / 2);
        const leftWords = words.slice(0, half);
        const rightWords = words.slice(half);

        function WordItem({ w, i }: { w: PlacedWord; i: number }) {
          const found = foundWords.includes(i);
          return (
            <div
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all ${
                found ? "bg-emerald-500/10 border-emerald-500/30" : "bg-input/50 border-border-t"
              }`}
            >
              {found ? (
                <>
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-emerald-400 truncate">{w.word}</span>
                  <img src={teamLogoUrl(w.team)} alt="" className="h-3.5 w-3.5 object-contain ml-auto" />
                </>
              ) : (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-text-faint/30 shrink-0" />
                  <span className="text-xs font-medium text-text-muted truncate">{w.word}</span>
                  <img src={teamLogoUrl(w.team)} alt="" className="h-3.5 w-3.5 object-contain ml-auto opacity-40" />
                </>
              )}
            </div>
          );
        }

        return (
          <div className="flex flex-col lg:flex-row gap-3 items-start">
            {/* Left word list — desktop only */}
            <div className="hidden lg:flex flex-col gap-1.5 w-44 shrink-0">
              <span className="text-[10px] font-bold text-text-faint uppercase tracking-wider px-1 mb-1">
                <Search size={10} className="inline mr-1 -mt-0.5" />Mots &agrave; barrer
              </span>
              {leftWords.map((w, i) => (
                <WordItem key={i} w={w} i={i} />
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1 min-w-0 w-full lg:w-auto">
              <div
                ref={gridRef}
                className="rounded-2xl bg-card border border-border-t p-2 sm:p-3 select-none touch-none"
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
              >
                <div
                  className="grid gap-[1px] sm:gap-[2px]"
                  style={{ gridTemplateColumns: `repeat(${actualGridSize}, 1fr)` }}
                >
                  {grid.map((row, r) =>
                    row.map((cell, c) => {
                      const key = cellKey(r, c);
                      const isSelecting = selectingSet.has(key);
                      const isFound = foundCells.has(key);
                      const isMystery = mysteryCells.has(key);
                      const revealMystery = (allWordsFound || gameOver) && isMystery;

                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-center aspect-square rounded-md sm:rounded-lg text-[11px] sm:text-sm font-bold transition-all duration-300 select-none ${
                            isSelecting
                              ? "bg-accent/30 text-accent-text scale-110 z-10"
                              : revealMystery
                                ? "bg-accent/25 text-accent-text ring-1 ring-accent/40"
                                : isFound
                                  ? "bg-emerald-500/20 text-emerald-400/60"
                                  : "bg-input text-text-primary hover:bg-card-hover"
                          }`}
                        >
                          {cell.letter}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right word list — desktop only */}
            <div className="hidden lg:flex flex-col gap-1.5 w-44 shrink-0">
              <span className="text-[10px] font-bold text-text-faint uppercase tracking-wider px-1 mb-1">&nbsp;</span>
              {rightWords.map((w, i) => (
                <WordItem key={half + i} w={w} i={half + i} />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Mobile word list — below grid */}
      <div className="lg:hidden rounded-2xl bg-card border border-border-t p-3">
        <div className="flex items-center gap-2 mb-2">
          <Search size={12} className="text-text-faint" />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Mots &agrave; barrer</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {words.map((w, i) => {
            const found = foundWords.includes(i);
            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all ${
                  found ? "bg-emerald-500/10 border-emerald-500/30" : "bg-input/50 border-border-t"
                }`}
              >
                {found ? (
                  <>
                    <Check size={12} className="text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-emerald-400 truncate">{w.word}</span>
                    <img src={teamLogoUrl(w.team)} alt="" className="h-3.5 w-3.5 object-contain ml-auto" />
                  </>
                ) : (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-text-faint/30 shrink-0" />
                    <span className="text-xs font-medium text-text-muted truncate">{w.word}</span>
                    <img src={teamLogoUrl(w.team)} alt="" className="h-3.5 w-3.5 object-contain ml-auto opacity-40" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mystery hint */}
      {mystery && !mysteryFound && !allWordsFound && !gaveUp && (
        <div className="rounded-xl bg-accent/10 border border-accent/20 px-4 py-3 text-center">
          <p className="text-xs text-text-muted">
            Joueur myst&egrave;re : <span className="font-bold text-accent-text">{mystery.name.length} lettres</span>
            <span className="text-text-faint"> — les lettres restantes forment son nom</span>
          </p>
        </div>
      )}

      {/* Mystery guess input — appears when all words are found */}
      {allWordsFound && !mysteryFound && !gaveUp && mystery && (
        <div className="rounded-2xl bg-accent/10 border border-accent/30 p-5 space-y-3">
          <p className="text-center text-sm font-bold text-accent-text">
            Devine le joueur myst&egrave;re !
          </p>
          <div className="flex justify-center">
            <div className="flex gap-1">
              {mystery.name.split("").map((_, i) => (
                <span key={i} className="flex h-8 w-6 sm:h-9 sm:w-7 items-center justify-center rounded-md bg-accent/20 text-sm font-bold text-accent-text border border-accent/30">
                  {mysteryGuess.toUpperCase()[i] || ""}
                </span>
              ))}
            </div>
          </div>
          <form onSubmit={handleMysterySubmit} className="flex gap-2 max-w-xs mx-auto">
            <input
              ref={mysteryInputRef}
              type="text"
              value={mysteryGuess}
              onChange={(e) => setMysteryGuess(e.target.value)}
              maxLength={mystery.name.length}
              placeholder={`${mystery.name.length} lettres...`}
              className={`flex-1 rounded-xl bg-card border pl-4 pr-4 py-2.5 text-sm font-bold text-text-primary placeholder:text-text-faint outline-none uppercase tracking-widest text-center transition-colors ${
                mysteryWrong ? "border-red-500 bg-red-500/10" : "border-border-t focus:border-accent"
              }`}
            />
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
            >
              <Check size={18} />
            </button>
          </form>
          {mysteryWrong && (
            <p className="text-center text-xs text-red-400 font-medium animate-[fadeIn_0.2s_ease-out]">
              Ce n'est pas le bon joueur !
            </p>
          )}
        </div>
      )}

      {/* Reveal mystery player — win or give up */}
      {gameOver && mystery && (
        <div className={`rounded-2xl overflow-hidden border p-5 sm:p-6 text-center space-y-3 ${
          gaveUp
            ? "border-red-500/30 bg-gradient-to-r from-red-500/10 via-red-500/5 to-card"
            : "border-accent/30 bg-gradient-to-r from-accent/10 via-accent/5 to-card"
        }`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${gaveUp ? "text-red-400" : "text-accent-text"}`}>
            {gaveUp ? "Joueur myst\u00e8re" : "Joueur myst\u00e8re"}
          </p>
          <div className="flex items-center justify-center gap-3">
            <img src={teamLogoUrl(mystery.team)} alt="" className="h-8 w-8 object-contain" />
            <p className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-wide">
              {mystery.name}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              gaveUp ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"
            }`}>
              {gaveUp ? <><Flag size={11} /> Abandonn&eacute;</> : <><Trophy size={11} /> {words.length} mots</>}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent-text">
              <Clock size={11} /> {formatTime(elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* Share */}
      {gameOver && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={handleShare} className="inline-flex items-center gap-2 rounded-xl bg-[#1DA1F2] px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#1a8cd8] hover:scale-[1.03] active:scale-[0.98]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            Partager
          </button>
          <button onClick={() => { navigator.clipboard.writeText(buildShareText()); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="inline-flex items-center gap-2 rounded-xl bg-input border border-border-t px-5 py-2.5 text-sm font-bold text-text-primary transition-all hover:bg-card-hover hover:scale-[1.03] active:scale-[0.98]">
            {copied ? <><Check size={14} className="text-emerald-400" /> Copi&eacute; !</> : "Copier"}
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
                <span className="text-xs text-text-muted tabular-nums">{entry.words_found}/{entry.total_words}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
