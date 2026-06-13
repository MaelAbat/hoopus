"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
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

/**
 * Shared player autocomplete used by the daily guessing games (Hoopl, Hoopixl,
 * HoopLink). The tricky part is mobile: the input often sits low on the page, so
 * when the virtual keyboard opens the results dropdown would render *behind* the
 * keyboard — you'd see the field but only a sliver (or none) of the suggestions,
 * and the page would jump as the browser tried to keep the input visible.
 *
 * Two things keep the list usable on a phone:
 *  1. On focus we lift the input toward the top of the screen so the dropdown
 *     below it has room to breathe.
 *  2. We cap the dropdown height to the space actually visible above the
 *     keyboard (measured from the visualViewport), so suggestions never hide
 *     behind it — the list scrolls internally instead.
 */
export default function PlayerSearchDropdown<T extends SearchablePlayer>({
  value,
  onChange,
  onSelect,
  results,
  placeholder = "Tape le nom d'un joueur...",
  focusBorderClass = "focus:border-accent",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [maxHeight, setMaxHeight] = useState<number>();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click / tap.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Cap the dropdown to the space between the input and the top of the virtual
  // keyboard (the bottom of the visual viewport) so results stay on screen.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    function update() {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const space = visibleBottom - rect.bottom - 12;
      // Never smaller than ~2 rows, never taller than the desktop default.
      setMaxHeight(Math.max(132, Math.min(288, space)));
    }
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [open, results.length]);

  const handleFocus = useCallback(() => {
    setOpen(true);
    // Mobile only: once the keyboard is up, lift the input near the top so the
    // dropdown has room. Desktop has no keyboard and plenty of space.
    if (typeof window === "undefined" || window.innerWidth >= 640) return;
    setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      const targetTop = 96; // clears the sticky top bar + scores ticker
      const delta = rect.top - targetTop;
      if (Math.abs(delta) > 24) {
        window.scrollBy({ top: delta, behavior: "smooth" });
      }
    }, 300);
  }, []);

  function handleSelect(p: T) {
    onSelect(p);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-xl bg-card border border-border-t pl-10 pr-4 py-3 text-sm text-text-primary placeholder:text-text-faint outline-none transition-colors ${focusBorderClass}`}
        />
      </div>
      {open && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-xl bg-card border border-border-t shadow-xl overflow-y-auto overscroll-contain"
          style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
        >
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-card-hover active:bg-card-hover transition-colors"
            >
              <img
                src={playerPhotoUrl(p.id)}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover bg-input"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-text-primary">{p.name}</span>
              <img src={teamLogoUrl(p.team)} alt="" className="h-5 w-5 shrink-0 object-contain" />
              <span className="text-xs text-text-faint shrink-0">{p.team}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
