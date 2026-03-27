"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Undo2 } from "lucide-react";
import { useVideo } from "@/context/VideoContext";

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

const EDGES: { edge: Edge; className: string }[] = [
  { edge: "nw", className: `absolute -top-0.5 -left-0.5 z-20 ${CURSORS.nw}` },
  { edge: "ne", className: `absolute -top-0.5 -right-0.5 z-20 ${CURSORS.ne}` },
  { edge: "sw", className: `absolute -bottom-0.5 -left-0.5 z-20 ${CURSORS.sw}` },
  { edge: "se", className: `absolute -bottom-0.5 -right-0.5 z-20 ${CURSORS.se}` },
  { edge: "n", className: `absolute -top-0.5 left-3 right-3 z-10 ${CURSORS.n}` },
  { edge: "s", className: `absolute -bottom-0.5 left-3 right-3 z-10 ${CURSORS.s}` },
  { edge: "w", className: `absolute top-3 -left-0.5 bottom-3 z-10 ${CURSORS.w}` },
  { edge: "e", className: `absolute top-3 -right-0.5 bottom-3 z-10 ${CURSORS.e}` },
];

export default function GlobalPipPlayer() {
  const { videoId, pip, matchPageVideoId, reattach, close } = useVideo();

  const pipRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 480, h: 270 });
  const dragging = useRef(false);
  const resizeEdge = useRef<Edge | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const initialized = useRef(false);
  const lastVideoId = useRef<string | null>(null);

  const isOnMatchPage = matchPageVideoId === videoId && matchPageVideoId !== null;
  const showFloating = !!(pip && videoId);

  /* Place bottom-right on first open or when video changes, adapt to screen */
  useEffect(() => {
    if (!showFloating) return;
    if (initialized.current && lastVideoId.current === videoId) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = vw < 640 ? 8 : 24;
    const w = Math.min(480, vw - margin * 2);
    const h = Math.round(w * 9 / 16) + 32;
    setRect({
      w,
      h,
      x: vw - w - margin,
      y: vh - h - margin,
    });
    initialized.current = true;
    lastVideoId.current = videoId;
  }, [showFloating, videoId]);

  /* ── Drag ── */
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragging.current = true;
    origin.current = { x: e.clientX - rect.x, y: e.clientY - rect.y };
  }, [rect.x, rect.y]);

  /* ── Resize ── */
  const onEdgeDown = useCallback((edge: Edge) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeEdge.current = edge;
    origin.current = { x: e.clientX, y: e.clientY };
  }, []);

  /* ── Global mouse handlers ── */
  useEffect(() => {
    if (!showFloating) return;

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
  }, [showFloating]);

  /* ── Touch handlers ── */
  useEffect(() => {
    if (!showFloating) return;
    const el = pipRef.current;
    if (!el) return;

    let action: "drag" | Edge | null = null;

    function onTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      const edgeEl = target.closest<HTMLElement>("[data-edge]");
      if (edgeEl) action = edgeEl.dataset.edge as Edge;
      else if (target.closest("[data-dragbar]")) action = "drag";
      else return;
      origin.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
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
      } else {
        setRect((r) => applyResize(r, action as Edge, dx, dy));
      }
    }

    function onTouchEnd() { action = null; }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [showFloating]);

  if (!showFloating) return null;

  return (
    <div
      ref={pipRef}
      className="fixed z-50 rounded-xl overflow-visible shadow-2xl border border-border-t bg-card"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {/* Resize handles */}
      {EDGES.map(({ edge, className }) => {
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
        <span className="text-[10px] font-medium text-text-muted truncate mr-2">Résumé du match</span>
        <div className="flex items-center gap-1 shrink-0">
          {isOnMatchPage && (
            <button
              onClick={reattach}
              className="rounded p-1 text-text-faint hover:text-text-primary transition-colors"
              title="Rattacher"
            >
              <Undo2 size={12} />
            </button>
          )}
          <button
            onClick={close}
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
  );
}
