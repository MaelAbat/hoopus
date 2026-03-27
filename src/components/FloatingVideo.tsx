"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, PictureInPicture2, Undo2 } from "lucide-react";

export default function FloatingVideo({ videoId }: { videoId: string }) {
  const [pip, setPip] = useState(false);

  /* ── PiP geometry ── */
  const pipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 480, h: 270 });
  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);

  /* Place bottom-right on first open */
  useEffect(() => {
    if (pip && !initialized.current) {
      setPos({
        x: window.innerWidth - size.w - 24,
        y: window.innerHeight - size.h - 24,
      });
      initialized.current = true;
    }
  }, [pip, size.w, size.h]);

  /* ── Drag ── */
  const onDragStart = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking a button
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  /* ── Resize ── */
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    offset.current = { x: e.clientX, y: e.clientY };
  }, []);

  /* ── Global mouse handlers ── */
  useEffect(() => {
    if (!pip) return;

    function onMove(e: MouseEvent) {
      if (dragging.current) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - offset.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - offset.current.y)),
        });
      }
      if (resizing.current) {
        const dx = e.clientX - offset.current.x;
        const dy = e.clientY - offset.current.y;
        offset.current = { x: e.clientX, y: e.clientY };
        setSize((prev) => ({
          w: Math.max(280, Math.min(window.innerWidth - 32, prev.w + dx)),
          h: Math.max(158, Math.min(window.innerHeight - 32, prev.h + dy)),
        }));
      }
    }

    function onUp() {
      dragging.current = false;
      resizing.current = false;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [pip]);

  /* ── Touch handlers for mobile ── */
  useEffect(() => {
    if (!pip) return;
    const el = pipRef.current;
    if (!el) return;

    let action: "drag" | "resize" | null = null;

    function onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      if (target.closest("[data-resize]")) {
        action = "resize";
      } else if (target.closest("[data-dragbar]")) {
        action = "drag";
      } else {
        return;
      }
      const t = e.touches[0];
      offset.current = { x: t.clientX, y: t.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (!action) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - offset.current.x;
      const dy = t.clientY - offset.current.y;
      offset.current = { x: t.clientX, y: t.clientY };

      if (action === "drag") {
        setPos((prev) => ({
          x: Math.max(0, Math.min(window.innerWidth - 100, prev.x + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, prev.y + dy)),
        }));
      } else {
        setSize((prev) => ({
          w: Math.max(280, Math.min(window.innerWidth - 32, prev.w + dx)),
          h: Math.max(158, Math.min(window.innerHeight - 32, prev.h + dy)),
        }));
      }
    }

    function onTouchEnd() {
      action = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pip]);

  return (
    <>
      {/* ── Inline video ── */}
      <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border-t/50">
          <h2 className="text-sm font-semibold text-text-primary">Resume du match</h2>
          {!pip && (
            <button
              onClick={() => setPip(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-input transition-colors"
              title="Detacher la video"
            >
              <PictureInPicture2 size={14} />
              <span className="hidden sm:inline">Detacher</span>
            </button>
          )}
        </div>
        <div
          className={`relative w-full ${pip ? "" : ""}`}
          style={{ paddingBottom: "56.25%" }}
        >
          {!pip && (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Highlights"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}
          {pip && (
            <div className="absolute inset-0 flex items-center justify-center bg-input/50">
              <button
                onClick={() => setPip(false)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-card transition-colors border border-border-t"
              >
                <Undo2 size={14} />
                Rattacher la video
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Floating PiP window ── */}
      {pip && (
        <div
          ref={pipRef}
          className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-border-t bg-card"
          style={{
            left: pos.x,
            top: pos.y,
            width: size.w,
            height: size.h,
          }}
        >
          {/* Drag bar */}
          <div
            data-dragbar
            onMouseDown={onDragStart}
            className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border-t/50 cursor-grab active:cursor-grabbing select-none"
          >
            <span className="text-[10px] font-medium text-text-muted truncate mr-2">Resume du match</span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setPip(false)}
                className="rounded p-1 text-text-faint hover:text-text-primary transition-colors"
                title="Rattacher"
              >
                <Undo2 size={12} />
              </button>
              <button
                onClick={() => setPip(false)}
                className="rounded p-1 text-text-faint hover:text-text-primary transition-colors"
                title="Fermer"
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* Video */}
          <div className="relative" style={{ height: "calc(100% - 32px)" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Highlights"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>

          {/* Resize handle */}
          <div
            data-resize
            onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10"
          >
            <svg
              viewBox="0 0 16 16"
              className="w-full h-full text-text-faint/60"
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="7" cy="12" r="1.5" />
              <circle cx="12" cy="7" r="1.5" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}
