"use client";

import { useState, useRef, useEffect } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";

type PipSize = "sm" | "md" | "lg";

const PIP_WIDTHS: Record<PipSize, string> = {
  sm: "w-64",
  md: "w-80",
  lg: "w-96",
};

export default function FloatingVideo({ videoId }: { videoId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pipSize, setPipSize] = useState<PipSize>("md");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setFloating(!entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sizes: PipSize[] = ["sm", "md", "lg"];

  return (
    <>
      {/* Inline placeholder — keeps layout stable when video floats */}
      <div ref={containerRef} className="rounded-2xl bg-card border border-border-t overflow-hidden">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-border-t/50">
          <h2 className="text-sm font-semibold text-text-primary">Resume du match</h2>
        </div>
        <div
          className={`relative w-full transition-opacity duration-300 ${
            floating && !dismissed ? "opacity-0" : "opacity-100"
          }`}
          style={{ paddingBottom: "56.25%" }}
        >
          {/* Only render one iframe — the floating one takes over */}
          {!(floating && !dismissed) && (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="Highlights"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>
      </div>

      {/* Floating PiP */}
      {floating && !dismissed && (
        <div
          className={`fixed bottom-4 right-4 z-50 ${PIP_WIDTHS[pipSize]} rounded-xl overflow-hidden shadow-2xl border border-border-t bg-card transition-all duration-300 animate-in slide-in-from-bottom-4`}
        >
          {/* Controls bar */}
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-card border-b border-border-t/50">
            <span className="text-[10px] font-medium text-text-muted truncate mr-2">Resume du match</span>
            <div className="flex items-center gap-1 shrink-0">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setPipSize(s)}
                  className={`rounded p-1 transition-colors ${
                    pipSize === s
                      ? "bg-accent/20 text-accent"
                      : "text-text-faint hover:text-text-muted"
                  }`}
                  title={s === "sm" ? "Petit" : s === "md" ? "Moyen" : "Grand"}
                >
                  {s === "sm" ? <Minimize2 size={11} /> : s === "lg" ? <Maximize2 size={11} /> : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                  )}
                </button>
              ))}
              <button
                onClick={() => setDismissed(true)}
                className="rounded p-1 text-text-faint hover:text-text-primary transition-colors"
                title="Fermer"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
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
