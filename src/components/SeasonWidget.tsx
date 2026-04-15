import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import Link from "next/link";
import { Trophy, Calendar, TrendingUp } from "lucide-react";
import { teamLogoUrl } from "@/lib/nba-teams";

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
      <div className="rounded-2xl border border-accent/15 bg-gradient-to-r from-accent/8 via-card to-card p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light">
            <Trophy size={20} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-accent-text">
              Playoffs en cours
            </h3>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {activeSeries.map((s) => (
                <div key={`${s.team_top}-${s.team_bottom}`} className="flex items-center gap-2 text-sm text-text-secondary">
                  <img src={teamLogoUrl(s.team_top)} alt={s.team_top} width={20} height={20} className="shrink-0" />
                  <span className="font-semibold text-text-primary">{s.wins_top}</span>
                  <span className="text-text-muted">-</span>
                  <span className="font-semibold text-text-primary">{s.wins_bottom}</span>
                  <img src={teamLogoUrl(s.team_bottom)} alt={s.team_bottom} width={20} height={20} className="shrink-0" />
                </div>
              ))}
            </div>
            <Link
              href="/playoffs"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              Voir le bracket complet
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </div>
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
      <div className="rounded-2xl border border-accent/15 bg-gradient-to-r from-accent/8 via-card to-card p-5 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light">
            <Calendar size={20} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold uppercase tracking-wide text-accent-text">
              Play-In en cours
            </h3>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {playinGames.slice(0, 4).map((g) => (
                <div key={`${g.home_team}-${g.away_team}`} className="flex items-center gap-2 text-sm text-text-secondary">
                  <img src={teamLogoUrl(g.away_team)} alt={g.away_team} width={20} height={20} className="shrink-0" />
                  <span className="text-text-muted">@</span>
                  <img src={teamLogoUrl(g.home_team)} alt={g.home_team} width={20} height={20} className="shrink-0" />
                  <span className="text-xs text-text-muted">
                    {g.status === 2 ? "En cours" : g.game_date || "À venir"}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/playoffs"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
            >
              Suivre le Play-In
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </div>
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
    <div className="rounded-2xl border border-accent/15 bg-gradient-to-r from-accent/8 via-card to-card p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-light">
          <TrendingUp size={20} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold uppercase tracking-wide text-accent-text">
            Course aux playoffs
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* East */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Est</span>
              <div className="mt-1.5 space-y-1">
                {east.map((t) => (
                  <div key={t.team_tricode} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-center text-xs font-bold text-text-muted">{t.conference_rank}</span>
                    <img src={teamLogoUrl(t.team_tricode)} alt={t.team_tricode} width={20} height={20} className="shrink-0" />
                    <span className="font-medium text-text-primary">{t.team_tricode}</span>
                    <span className="ml-auto text-text-muted">{t.wins}-{t.losses}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* West */}
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Ouest</span>
              <div className="mt-1.5 space-y-1">
                {west.map((t) => (
                  <div key={t.team_tricode} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-center text-xs font-bold text-text-muted">{t.conference_rank}</span>
                    <img src={teamLogoUrl(t.team_tricode)} alt={t.team_tricode} width={20} height={20} className="shrink-0" />
                    <span className="font-medium text-text-primary">{t.team_tricode}</span>
                    <span className="ml-auto text-text-muted">{t.wins}-{t.losses}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Link
            href="/classement"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            Classement complet
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
