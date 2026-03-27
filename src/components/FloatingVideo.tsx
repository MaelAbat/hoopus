"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, PictureInPicture2, Undo2 } from "lucide-react";

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_W = 280;
const MIN_H = 158;
const EDGE_SIZE = 6;

const CURSORS: Record<Edge, string> = {
  n: "cursor-ns-resize",
  s: "cursor-ns-resize",
  e: "cursor-ew-resize",
  w: "cursor-ew-resize",
  ne: "cursor-nesw-resize",
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
  sw: "cursor-nesw-resize",
};

interface Rect { x: number; y: number; w: number; h: number }

function applyResize(rect: Rect, edge: Edge, dx: number, dy: number): Rect {
  let { x, y, w, h } = rect;

  if (edge.includes("e")) w = Math.max(MIN_W, w + dx);
  else if (edge.includes("w")) { const nw = Math.max(MIN_W, w - dx); x += w - nw; w = nw; }

  if (edge.includes("s")) h = Math.max(MIN_H, h + dy);
  else if (edge.includes("n")) { const nh = Math.max(MIN_H, h - dy); y += h - nh; h = nh; }

  return { x, y, w, h };
}

export default function FloatingVideo({ videoId }: { videoId: string }) {
  const [pip, setPip] = useState(false);

  const pipRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 480, h: 270 });
  const dragging = useRef(false);
  const resizeEdge = useRef<Edge | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);

  /* Place bottom-right on first open */
  useEffect(() => {
    if (pip && !initialized.current) {
      setRect((r) => ({
        ...r,
        x: window.innerWidth - r.w - 24,
        y: window.innerHeight - r.h - 24,
      }));
      initialized.current = true;
    }
  }, [pip]);

  /* ── Drag ── */
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragging.current = true;
    origin.current = { x: e.clientX - rect.x, y: e.clientY - rect.y };
  }, [rect.x, rect.y]);

  /* ── Resize from any edge/corner ── */
  const onEdgeDown = useCallback((edge: Edge) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeEdge.current = edge;
    origin.current = { x: e.clientX, y: e.clientY };
  }, []);

  /* ── Global mouse handlers ── */
  useEffect(() => {
    if (!pip) return;

    function onMove(e: MouseEvent) {
      if (dragging.current) {
        setRect((r) => ({
          ...r,
          x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - origin.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - origin.current.y)),
        }));
        return;
      }

      const edge = resizeEdge.current;
      if (!edge) return;

      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      origin.current = { x: e.clientX, y: e.clientY };

      setRect((r) => applyResize(r, edge, dx, dy));
    }

    function onUp() {
      dragging.current = false;
      resizeEdge.current = null;
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

    let action: "drag" | Edge | null = null;

    function onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;

      const edgeEl = target.closest<HTMLElement>("[data-edge]");
      if (edgeEl) {
        action = edgeEl.dataset.edge as Edge;
      } else if (target.closest("[data-dragbar]")) {
        action = "drag";
      } else {
        return;
      }
      const t = e.touches[0];
      origin.current = { x: t.clientX, y: t.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (!action) return;
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - origin.current.x;
      const dy = t.clientY - origin.current.y;
      origin.current = { x: t.clientX, y: t.clientY };

      if (action === "drag") {
        setRect((r) => ({
          ...r,
          x: Math.max(0, Math.min(window.innerWidth - 100, r.x + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 60, r.y + dy)),
        }));
        return;
      }

      const edge = action;
      setRect((r) => applyResize(r, edge, dx, dy));
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

  /* ── Resize edge zones ── */
  const edges: { edge: Edge; className: string }[] = [
    // Corners
    { edge: "nw", className: `absolute -top-0.5 -left-0.5 z-20 ${CURSORS.nw}` },
    { edge: "ne", className: `absolute -top-0.5 -right-0.5 z-20 ${CURSORS.ne}` },
    { edge: "sw", className: `absolute -bottom-0.5 -left-0.5 z-20 ${CURSORS.sw}` },
    { edge: "se", className: `absolute -bottom-0.5 -right-0.5 z-20 ${CURSORS.se}` },
    // Edges
    { edge: "n", className: `absolute -top-0.5 left-3 right-3 z-10 ${CURSORS.n}` },
    { edge: "s", className: `absolute -bottom-0.5 left-3 right-3 z-10 ${CURSORS.s}` },
    { edge: "w", className: `absolute top-3 -left-0.5 bottom-3 z-10 ${CURSORS.w}` },
    { edge: "e", className: `absolute top-3 -right-0.5 bottom-3 z-10 ${CURSORS.e}` },
  ];

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
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
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
          className="fixed z-50 rounded-xl overflow-visible shadow-2xl border border-border-t bg-card"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        >
          {/* Resize handles — edges & corners */}
          {edges.map(({ edge, className }) => {
            const isCorner = edge.length === 2;
            return (
              <div
                key={edge}
                data-edge={edge}
                onMouseDown={onEdgeDown(edge)}
                className={className}
                style={
                  isCorner
                    ? { width: EDGE_SIZE * 2, height: EDGE_SIZE * 2 }
                    : edge === "n" || edge === "s"
                      ? { height: EDGE_SIZE }
                      : { width: EDGE_SIZE }
                }
              />
            );
          })}

          {/* Drag bar */}
          <div
            data-dragbar
            onMouseDown={onDragStart}
            className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border-t/50 cursor-grab active:cursor-grabbing select-none rounded-t-xl"
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
          <div className="relative rounded-b-xl overflow-hidden" style={{ height: "calc(100% - 32px)" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Highlights"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
