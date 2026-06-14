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
}

const MOBILE_BREAKPOINT = 640;

/**
 * Shared player autocomplete used by the daily guessing games (Hoopl, Hoopixl,
 * HoopLink).
 *
 * Desktop: a plain inline dropdown below the input.
 *
 * Mobile: the input sits low on the page, so an inline dropdown would render
 * behind the virtual keyboard — and trying to lift it with scroll/measure
 * tricks made the list jump around and disappear as you typed. Instead, tapping
 * the field opens a full-screen search sheet pinned to the *visible* viewport
 * (the area above the keyboard, measured via visualViewport): the input stays
 * at the top and the results scroll underneath, so suggestions can never hide
 * behind the keyboard and nothing shifts as the result count changes.
 */
export default function PlayerSearchDropdown<T extends SearchablePlayer>({
  value,
  onChange,
  onSelect,
  results,
  placeholder = "Tape le nom d'un joueur...",
  focusBorderClass = "focus:border-accent",
}: Props<T>) {
  const [openDesktop, setOpenDesktop] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sheetRect, setSheetRect] = useState<{ top: number; height: number }>();

  const inputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Switch between inline dropdown (desktop) and full-screen sheet (mobile).
  // Starts false so the first render matches the server (no hydration mismatch).
  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) setSheetOpen(false);
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
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpenDesktop(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobile]);

  // Keep the mobile sheet glued to the visible viewport (above the keyboard).
  useEffect(() => {
    if (!sheetOpen) return;
    const vv = window.visualViewport;
    function update() {
      setSheetRect({
        top: vv ? vv.offsetTop : 0,
        height: vv ? vv.height : window.innerHeight,
      });
    }
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [sheetOpen]);

  // Focus the sheet's input once it opens (a tick later so it exists and the
  // keyboard animation can begin).
  useEffect(() => {
    if (!sheetOpen) return;
    const id = setTimeout(() => sheetInputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [sheetOpen]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheetOpen]);

  const handleSelect = useCallback((p: T) => {
    onSelect(p);
    setOpenDesktop(false);
    setSheetOpen(false);
  }, [onSelect]);

  const closeSheet = useCallback(() => {
    sheetInputRef.current?.blur();
    setSheetOpen(false);
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
          className="h-9 w-9 shrink-0 rounded-full object-cover bg-input"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-text-primary">{p.name}</span>
        <img src={teamLogoUrl(p.team)} alt="" className="h-5 w-5 shrink-0 object-contain" />
        <span className="text-xs text-text-faint shrink-0">{p.team}</span>
      </button>
    ));
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint z-10 pointer-events-none" />
        {isMobile ? (
          // Trigger styled like the input; tapping it opens the sheet. Using a
          // button (not a readonly input) avoids the keyboard flashing here.
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`flex w-full items-center rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-sm outline-none ${value ? "text-text-primary" : "text-text-faint"}`}
          >
            <span className="truncate">{value || placeholder}</span>
          </button>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpenDesktop(true); }}
            onFocus={() => setOpenDesktop(true)}
            placeholder={placeholder}
            autoComplete="off"
            className={`w-full rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors ${focusBorderClass}`}
          />
        )}
      </div>

      {/* Desktop: inline dropdown */}
      {!isMobile && openDesktop && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-72 rounded-xl bg-card border border-border-t shadow-xl overflow-y-auto overscroll-contain"
        >
          {renderRows()}
        </div>
      )}

      {/* Mobile: full-screen search sheet pinned above the keyboard */}
      {isMobile && sheetOpen && (
        <div
          className="fixed inset-x-0 z-[70] flex flex-col bg-bg"
          style={sheetRect ? { top: sheetRect.top, height: sheetRect.height } : { top: 0, bottom: 0 }}
        >
          <div className="flex items-center gap-2 border-b border-border-t px-3 py-2.5">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint z-10 pointer-events-none" />
              <input
                ref={sheetInputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                enterKeyHint="search"
                className={`w-full rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-base text-text-primary placeholder:text-text-faint outline-none transition-colors ${focusBorderClass}`}
              />
            </div>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Fermer la recherche"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-input active:scale-95 transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {value.trim() && results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">Aucun joueur trouvé.</p>
            ) : (
              renderRows()
            )}
          </div>
        </div>
      )}
    </div>
  );
}
