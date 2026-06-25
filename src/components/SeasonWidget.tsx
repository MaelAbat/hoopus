import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";

function Frame({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border border-rule bg-card p-6 sm:p-8">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
      <p className="kicker text-accent-text">{kicker}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-text transition-colors hover:text-accent"
    >
      {label}
      <ArrowRight size={13} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export default async function SeasonWidget() {
  const season = getCurrentSeason();
  const supabase = await createClient();

  /* ── 1. Check active playoff series ────────── */
  const { data: activeSeries } = await supabase
    .from("playoff_series")
    .select("*")
    .eq("season", season)
    .eq("status", "active")
    .order("round", { ascending: false })
    .limit(4);

  if (activeSeries && activeSeries.length > 0) {
    return (
      <Frame kicker="Playoffs en cours">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {activeSeries.map((s) => (
            <div key={`${s.team_top}-${s.team_bottom}`} className="flex items-center gap-2.5">
              <img src={teamLogoUrl(s.team_top)} alt={s.team_top} width={22} height={22} className="shrink-0" />
              <span className="tnum text-lg font-semibold text-text-primary">{s.wins_top}</span>
              <span className="text-text-faint">–</span>
              <span className="tnum text-lg font-semibold text-text-primary">{s.wins_bottom}</span>
              <img src={teamLogoUrl(s.team_bottom)} alt={s.team_bottom} width={22} height={22} className="shrink-0" />
            </div>
          ))}
        </div>
        <MoreLink href="/playoffs" label="Voir le bracket complet" />
      </Frame>
    );
  }

  /* ── 2. Check active play-in games ─────────── */
  const { data: playinGames } = await supabase
    .from("playin_games")
    .select("*")
    .eq("season", season)
    .neq("status", 3)
    .limit(6);

  if (playinGames && playinGames.length > 0) {
    return (
      <Frame kicker="Play-In en cours">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {playinGames.slice(0, 4).map((g) => (
            <div key={`${g.home_team}-${g.away_team}`} className="flex items-center gap-2.5">
              <img src={teamLogoUrl(g.away_team)} alt={g.away_team} width={22} height={22} className="shrink-0" />
              <span className="font-mono text-xs text-text-faint">@</span>
              <img src={teamLogoUrl(g.home_team)} alt={g.home_team} width={22} height={22} className="shrink-0" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                {g.status === 2 ? "En cours" : g.game_date || "À venir"}
              </span>
            </div>
          ))}
        </div>
        <MoreLink href="/playoffs" label="Suivre le Play-In" />
      </Frame>
    );
  }

  /* ── 3. Fallback: standings leaders ────────── */
  const { data: standings } = await supabase
    .from("standings")
    .select("team_tricode, team_name, conference, wins, losses, conference_rank")
    .eq("season", season)
    .lte("conference_rank", 3)
    .order("conference")
    .order("conference_rank", { ascending: true });

  const east = (standings || []).filter((s) => s.conference === "East");
  const west = (standings || []).filter((s) => s.conference === "West");

  if (east.length === 0 && west.length === 0) return null;

  return (
    <Frame kicker="Course aux playoffs">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {[
          { label: "Est", rows: east },
          { label: "Ouest", rows: west },
        ].map((conf) => (
          <div key={conf.label}>
            <p className="kicker mb-2 text-text-faint">{conf.label}</p>
            <div className="divide-y divide-rule/60">
              {conf.rows.map((t) => (
                <div key={t.team_tricode} className="flex items-center gap-3 py-1.5">
                  <span className="tnum w-4 text-center text-xs font-semibold text-accent-text">{t.conference_rank}</span>
                  <img src={teamLogoUrl(t.team_tricode)} alt={t.team_tricode} width={22} height={22} className="shrink-0" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-text-primary">{t.team_tricode}</span>
                  <span className="tnum ml-auto text-sm text-text-muted">{t.wins}–{t.losses}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <MoreLink href="/classement" label="Classement complet" />
    </Frame>
  );
}
