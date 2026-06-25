"use client";

import { Trophy } from "lucide-react";
import { computeVisibleLeaderboard } from "@/lib/leaderboard-utils";
import { isAnonymousName } from "@/lib/anonymous-auth";

interface MockEntry {
  user_id: string;
  display_name: string;
  score: number;
  time_seconds: number;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

// Generate mock data: 500 entries, the "current user" is at rank 47
function generateMockData(userRank: number): { entries: MockEntry[]; userId: string } {
  const userId = "user-current";
  const names = [
    "LeBron_Fan", "KingJames23", "MambaForever", "CurryFromDeep", "DurantSlim",
    "JokerMVP", "GiannisFreak", "LukaM4gic", "TatumJay", "EmbiidTrust",
    "MorantJa", "BookerDBook", "EdwardsAnt", "WembyAlien", "SGA_Thunder",
    "PhantomDunk42", "HyperSlam7", "ClutchBuzzer99", "ShadowSwish3", "GhostRebound55",
  ];

  const entries: MockEntry[] = [];
  for (let i = 0; i < 500; i++) {
    const isUser = i === userRank - 1;
    entries.push({
      user_id: isUser ? userId : `user-${i}`,
      display_name: isUser ? "MaelAbat" : names[i % names.length] + (i >= names.length ? `${Math.floor(i / names.length)}` : ""),
      score: Math.max(500 - i * 3 - Math.floor(Math.random() * 5), 10),
      time_seconds: 30 + i * 2 + Math.floor(Math.random() * 20),
    });
  }
  return { entries, userId };
}

function DemoLeaderboard({ title, userRank }: { title: string; userRank: number }) {
  const { entries, userId } = generateMockData(userRank);
  const rows = computeVisibleLeaderboard(entries, userId);

  return (
    <div className="bg-card border border-rule overflow-hidden">
      <div className="px-4 py-3 border-b border-rule">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-primary flex items-center gap-2">
          <Trophy size={14} className="text-accent-text" />
          {title}
        </h2>
      </div>
      <div className="divide-y divide-rule">
        {rows.map((row, i) =>
          row.type === "separator" ? (
            <div key="sep" className="flex items-center gap-3 px-4 py-1.5">
              <div className="flex-1 border-t border-dashed border-rule" />
              <span className="font-mono text-[10px] text-text-faint">...</span>
              <div className="flex-1 border-t border-dashed border-rule" />
            </div>
          ) : (
            <div
              key={`${row.entry.display_name}-${row.rank}`}
              className={`relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-card-hover ${row.isUser ? "bg-accent-light" : ""}`}
            >
              {row.isUser && <span className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
              <span
                className={`tnum flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                  row.rank === 1
                    ? "bg-accent text-white"
                    : row.rank <= 3
                    ? "bg-input text-text-primary"
                    : "text-text-faint"
                }`}
              >
                {row.rank}
              </span>
              <span
                className={`flex-1 text-sm truncate ${
                  row.isUser
                    ? "font-bold text-accent-text"
                    : isAnonymousName(row.entry.display_name)
                    ? "italic text-text-muted"
                    : "font-medium text-text-primary"
                }`}
              >
                {row.entry.display_name}
                {row.isUser ? " (toi)" : ""}
              </span>
              <span className="tnum text-xs text-text-muted font-bold">
                {row.entry.score}/500
              </span>
              <span className="tnum text-xs text-text-faint w-12 text-right">
                {formatTime(row.entry.time_seconds)}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function TestLeaderboard() {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-10 px-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm tabular-nums text-text-faint">00</span>
        <div>
          <h1 className="font-display text-2xl text-text-primary sm:text-3xl mb-1">Test classement intelligent</h1>
          <p className="text-sm text-text-muted">
            Visualisation des diff&eacute;rents cas de figure pour le classement avec focus sur le joueur.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="kicker text-text-faint">Cas 1 : joueur dans le top 5</h3>
        <DemoLeaderboard title="Joueur #3 sur 500" userRank={3} />
      </div>

      <div className="space-y-2">
        <h3 className="kicker text-text-faint">Cas 2 : joueur juste apr&egrave;s le top 5</h3>
        <DemoLeaderboard title="Joueur #7 sur 500" userRank={7} />
      </div>

      <div className="space-y-2">
        <h3 className="kicker text-text-faint">Cas 3 : joueur loin dans le classement</h3>
        <DemoLeaderboard title="Joueur #47 sur 500" userRank={47} />
      </div>

      <div className="space-y-2">
        <h3 className="kicker text-text-faint">Cas 4 : joueur tr&egrave;s loin</h3>
        <DemoLeaderboard title="Joueur #498 sur 500" userRank={498} />
      </div>
    </div>
  );
}
