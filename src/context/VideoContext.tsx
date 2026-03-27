"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface VideoState {
  videoId: string | null;
  pip: boolean;
  /** Match page signals its videoId; if user is on that page, inline is shown */
  matchPageVideoId: string | null;
}

interface VideoContextValue extends VideoState {
  /** Called by match page to register its highlight video */
  registerMatchVideo: (videoId: string) => void;
  /** Called by match page on unmount */
  unregisterMatchVideo: () => void;
  /** Detach video into floating PiP */
  detach: () => void;
  /** Reattach video back to inline (only works on the match page) */
  reattach: () => void;
  /** Close PiP entirely */
  close: () => void;
}

const VideoContext = createContext<VideoContextValue | null>(null);

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<VideoState>({
    videoId: null,
    pip: false,
    matchPageVideoId: null,
  });

  const registerMatchVideo = useCallback((videoId: string) => {
    setState((s) => ({
      ...s,
      matchPageVideoId: videoId,
      // If no active video yet, set it (but don't override a playing PiP from another match)
      videoId: s.videoId ?? videoId,
    }));
  }, []);

  const unregisterMatchVideo = useCallback(() => {
    setState((s) => ({
      ...s,
      matchPageVideoId: null,
      // If pip is active, keep the video playing. Otherwise clear it.
      videoId: s.pip ? s.videoId : null,
    }));
  }, []);

  const detach = useCallback(() => {
    setState((s) => ({ ...s, pip: true }));
  }, []);

  const reattach = useCallback(() => {
    setState((s) => ({ ...s, pip: false }));
  }, []);

  const close = useCallback(() => {
    setState({ videoId: null, pip: false, matchPageVideoId: null });
  }, []);

  return (
    <VideoContext.Provider
      value={{ ...state, registerMatchVideo, unregisterMatchVideo, detach, reattach, close }}
    >
      {children}
    </VideoContext.Provider>
  );
}

export function useVideo() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used within VideoProvider");
  return ctx;
}
