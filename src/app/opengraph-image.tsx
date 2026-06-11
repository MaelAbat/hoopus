import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Hoopus — Toute la NBA, en français";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "#f97316",
            marginBottom: 32,
            fontSize: 52,
          }}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 32 32"
            fill="none"
          >
            <path
              d="M16 3 C16 3 20.5 7.5 20.5 11 C20.5 13.5 18.5 15 16 15 C13.5 15 11.5 13.5 11.5 11 C11.5 7.5 16 3 16 3Z"
              fill="white"
              opacity="0.5"
            />
            <path
              d="M16 6 C16 6 18.5 8.5 18.5 10.5 C18.5 12 17.5 13 16 13 C14.5 13 13.5 12 13.5 10.5 C13.5 8.5 16 6 16 6Z"
              fill="white"
            />
            <path
              d="M10 16 L22 16 L20 23 Q16 25 12 23 Z"
              stroke="white"
              stroke-width="1.4"
              fill="white"
              opacity="0.3"
            />
            <line x1="16" y1="23" x2="16" y2="27" stroke="white" stroke-width="1.6" />
            <path d="M11 27 L21 27" stroke="white" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            letterSpacing: "-0.02em",
            marginBottom: 16,
          }}
        >
          Hoopus
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.05em",
          }}
        >
          Toute la NBA, en français
        </div>

        {/* Accent line */}
        <div
          style={{
            display: "flex",
            width: 80,
            height: 4,
            borderRadius: 2,
            background: "#f97316",
            marginTop: 32,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
