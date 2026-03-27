"use client";

import { useEffect } from "react";
import { PictureInPicture2, Undo2 } from "lucide-react";
import { useVideo } from "@/context/VideoContext";

/**
 * Inline video block rendered on the match page.
 * Communicates with the global VideoProvider so the PiP player
 * persists across navigations.
 */
export default function FloatingVideo({ videoId }: { videoId: string }) {
  const { pip, videoId: activeVideoId, registerMatchVideo, unregisterMatchVideo, detach, reattach } = useVideo();

  const isActiveInPip = pip && activeVideoId === videoId;

  /* Register this match's video on mount, unregister on unmount */
  useEffect(() => {
    registerMatchVideo(videoId);
    return () => unregisterMatchVideo();
  }, [videoId, registerMatchVideo, unregisterMatchVideo]);

  return (
    <div className="rounded-2xl bg-card border border-border-t overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border-t/50">
        <h2 className="text-sm font-semibold text-text-primary">Résumé du match</h2>
        {!isActiveInPip && (
          <button
            onClick={detach}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary hover:bg-input transition-colors"
            title="Détacher la vidéo"
          >
            <PictureInPicture2 size={14} />
            <span className="hidden sm:inline">Détacher</span>
          </button>
        )}
      </div>
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        {!isActiveInPip && (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            title="Highlights"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        )}
        {isActiveInPip && (
          <div className="absolute inset-0 flex items-center justify-center bg-input/50">
            <button
              onClick={reattach}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-card transition-colors border border-border-t"
            >
              <Undo2 size={14} />
              Rattacher la vidéo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
