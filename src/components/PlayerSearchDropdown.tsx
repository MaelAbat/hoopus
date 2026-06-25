"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { playerPhotoUrl, teamLogoUrl } from "@/lib/nba-teams";

export interface SearchablePlayer {
  id: number;
  name: string;
  team: string;
}

interface Props<T extends SearchablePlayer> {
  value: string;
  onChange: (value: string) => void;
  onSelect: (player: T) => void;
  results: T[];
  placeholder?: string;
  /** Tailwind border class applied on focus, e.g. "focus:border-accent". */
  focusBorderClass?: string;
  /**
   * Optional content pinned at the top of the mobile search sheet (below the
   * input). Hoopixl uses it to keep the pixelated photo visible while typing —
   * the sheet covers the page, so without this the thing you're guessing about
   * would be hidden.
   */
  sheetHeader?: React.ReactNode;
  /**
   * Optional element to scroll into view after a pick on mobile. Each game's
   * feedback lives in a different place (Hoopl clues below, HoopLink chain
   * above), so the game points us at what the player should see next.
   */
  revealRef?: React.RefObject<HTMLElement | null>;
}

const MOBILE_BREAKPOINT = 640;
// Clears the fixed mobile top bar (h-14) plus a little breathing room.
const TOP_BAR_OFFSET = 72;

/**
 * Shared player autocomplete used by the daily guessing games (Hoopl, Hoopixl,
 * HoopLink).
 *
 * Desktop: a plain inline dropdown below the input.
 *
 * Mobile: the field sits low on the page, so an inline dropdown would render
 * behind the virtual keyboard. Instead, focusing the field turns its wrapper
 * into a full-screen search sheet (the SAME input element stays focused, so the
 * keyboard opens on the first tap), with the input at the top and the results
 * scrolling above the keyboard. After a pick we close the sheet and scroll the
 * game's feedback (revealRef) into view, so you immediately see the result.
 */
export default function PlayerSearchDropdown<T extends SearchablePlayer>({
  value,
  onChange,
  onSelect,
  results,
  placeholder = "Tape le nom d'un joueur...",
  focusBorderClass = "focus:border-accent",
  sheetHeader,
  revealRef,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sheetInset, setSheetInset] = useState<{ top: number; bottom: number }>();

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sheetMode = isMobile && open;

  // Switch between inline dropdown (desktop) and full-screen sheet (mobile).
  // Starts false so the first render matches the server (no hydration mismatch).
  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setOpen(false);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Desktop only: close the inline dropdown on an outside click.
  useEffect(() => {
    if (isMobile) return;
    function handleClick(e: MouseEvent) {
      if (
        rootRef.current && !rootRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobile]);

  // The sheet covers the whole screen (opaque, so nothing behind peeks through),
  // and we pad its content into the visible band — between the top offset and
  // the keyboard — so the input and results never hide behind the keyboard.
  useEffect(() => {
    if (!sheetMode) return;
    const vv = window.visualViewport;
    function update() {
      const top = vv ? vv.offsetTop : 0;
      const bottom = vv ? Math.max(0, window.innerHeight - vv.offsetTop - vv.height) : 0;
      setSheetInset({ top, bottom });
    }
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [sheetMode]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!sheetMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetMode]);

  // After a pick on mobile, bring the game's feedback into view. Only games that
  // opt in (by passing revealRef) get scrolled — others keep their position.
  const revealResult = useCallback(() => {
    if (!isMobile || !revealRef) return;
    // Wait for the keyboard to close and the layout to settle first.
    setTimeout(() => {
      const el = revealRef.current;
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - TOP_BAR_OFFSET;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }, 350);
  }, [isMobile, revealRef]);

  const handleSelect = useCallback((p: T) => {
    inputRef.current?.blur();
    onSelect(p);
    setOpen(false);
    revealResult();
  }, [onSelect, revealResult]);

  const closeSheet = useCallback(() => {
    inputRef.current?.blur();
    setOpen(false);
  }, []);

  function renderRows() {
    return results.map((p) => (
      <button
        key={p.id}
        type="button"
        onClick={() => handleSelect(p)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-card-hover active:bg-card-hover transition-colors"
      >
        <img
          src={playerPhotoUrl(p.id)}
          alt=""
          className="h-9 w-9 shrink-0 object-cover bg-input"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-text-primary">{p.name}</span>
        <img src={teamLogoUrl(p.team)} alt="" className="h-5 w-5 shrink-0 object-contain" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-faint shrink-0">{p.team}</span>
      </button>
    ));
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={sheetMode ? "fixed inset-0 z-[70] flex flex-col bg-bg" : "relative"}
        style={sheetMode && sheetInset ? { paddingTop: sheetInset.top, paddingBottom: sheetInset.bottom } : undefined}
      >
        {/* Input row (the input element is the same node inline or in the sheet,
            so focus — and the keyboard — survives the switch). */}
        <div className={`flex items-center gap-2 ${sheetMode ? "px-3 pt-2" : ""}`}>
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint z-10 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => { onChange(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results.length > 0) { e.preventDefault(); handleSelect(results[0]); }
                else if (e.key === "Escape") closeSheet();
              }}
              placeholder={placeholder}
              autoComplete="off"
              enterKeyHint="search"
              className={`w-full bg-card border border-rule pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors ${focusBorderClass}`}
            />
          </div>
          {sheetMode && (
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Fermer la recherche"
              className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted hover:bg-input active:scale-95 transition"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Mobile: keep the game's visual (e.g. Hoopixl photo) in the sheet */}
        {sheetMode && sheetHeader && (
          <div className="shrink-0 flex justify-center border-b border-rule py-3 mt-2">
            {sheetHeader}
          </div>
        )}

        {/* Results */}
        {sheetMode ? (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-2">
            {value.trim() && results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">Aucun joueur trouvé.</p>
            ) : (
              renderRows()
            )}
          </div>
        ) : (
          open && results.length > 0 && (
            <div
              className="absolute z-50 mt-1 w-full max-h-72 bg-card border border-rule shadow-xl overflow-y-auto overscroll-contain"
            >
              {renderRows()}
            </div>
          )
        )}
      </div>
    </div>
  );
}
