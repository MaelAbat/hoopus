import { createClient } from "@/lib/supabase/server";
import { getCurrentSeason } from "@/lib/season";
import { syncPlayerCareer } from "@/lib/sync-career";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { ChevronLeft, MapPin, GraduationCap, Calendar, Ruler, Weight, Hash, BarChart3 } from "lucide-react";
import PlayerCareer from "@/components/PlayerCareer";
import CareerChart from "@/components/CareerChart";
import ScrollReveal from "@/components/ScrollReveal";
import FollowPlayerButton from "@/components/FollowPlayerButton";
import JsonLd from "@/components/JsonLd";
import { teamLogoUrl } from "@/lib/nba-teams";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

// cache() dedupes the player read between generateMetadata and the page render.
const getPlayer = cache(async (playerId: number) => {
  const supabase = await createClient();
  const { data } = await supabase.from("players").select("*").eq("player_id", playerId).single();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(Number(id));
  if (!player) return { title: "Joueur introuvable", robots: { index: false, follow: false } };

  const fullName = `${player.first_name} ${player.last_name}`;
  const team = player.team_name ? `${player.team_city ?? ""} ${player.team_name}`.trim() : null;
  const averages =
    player.pts != null
      ? ` Moyennes en carrière : ${player.pts} pts, ${player.reb ?? 0} rebonds et ${player.ast ?? 0} passes par match.`
      : "";
  const description =
    `Profil NBA de ${fullName}${team ? ` (${team})` : ""}${player.position ? `, ${player.position}` : ""}.` +
    `${averages} Statistiques de carrière, parcours et infos détaillées sur Hoopus.`;

  return {
    title: fullName,
    description,
    alternates: { canonical: `/joueurs/${id}` },
    openGraph: {
      title: `${fullName} — Profil & stats NBA`,
      description,
      type: "profile",
      url: `${siteUrl}/joueurs/${id}`,
    },
    twitter: { card: "summary_large_image", title: `${fullName} · Hoopus`, description },
  };
}

function draftLabel(p: { draft_year: number | null; draft_round: number | null; draft_number: number | null }): string {
  if (!p.draft_year || !p.draft_round || !p.draft_number) return "Non drafté";
  return `${p.draft_year} — Round ${p.draft_round}, Pick #${p.draft_number}`;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border-t/50 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-input text-text-muted">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-wider text-text-faint">{label}</p>
        <p className="text-sm font-medium text-text-primary">{value}</p>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card border border-border-t p-4 text-center">
      <p className="text-2xl font-bold text-accent-text">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-text-faint">{label}</p>
    </div>
  );
}

export default async function PlayerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const season = getCurrentSeason();
  const supabase = await createClient();

  const playerId = Number(id);

  const [player, { data: rosterEntry }] = await Promise.all([
    getPlayer(playerId),
    supabase.from("rosters").select("*").eq("player_id", playerId).eq("season", season).single(),
  ]);

  if (!player) notFound();

  const playerJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: `${player.first_name} ${player.last_name}`,
    jobTitle: "Joueur de basketball NBA",
    nationality: player.country || undefined,
    height: player.height || undefined,
    weight: player.weight || undefined,
    alumniOf: player.college || undefined,
    affiliation: player.team_name
      ? { "@type": "SportsTeam", name: `${player.team_city ?? ""} ${player.team_name}`.trim() }
      : undefined,
    url: `${siteUrl}/joueurs/${playerId}`,
  };

  // Fetch career stats from DB
  const { data: careerStats } = await supabase
    .from("player_career_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("season", { ascending: true });

  // Use DB data if available, otherwise sync from NBA API and use returned data directly
  const rawCareer = careerStats && careerStats.length > 0
    ? careerStats
    : await syncPlayerCareer(playerId);

  const careerSeasons = (Array.isArray(rawCareer) ? rawCareer : []).map((row) => ({
    season: row.season,
    team: row.team,
    gp: row.gp,
    pts: Number(row.pts),
    reb: Number(row.reb),
    ast: Number(row.ast),
    stl: Number(row.stl),
    blk: Number(row.blk),
    fgPct: Number(row.fg_pct ?? row.fgPct ?? 0),
    fg3Pct: Number(row.fg3_pct ?? row.fg3Pct ?? 0),
    ftPct: Number(row.ft_pct ?? row.ftPct ?? 0),
    min: Number(row.min),
    fgm: Number(row.fgm ?? 0),
    fga: Number(row.fga ?? 0),
    fg3m: Number(row.fg3m ?? 0),
    fg3a: Number(row.fg3a ?? 0),
    ftm: Number(row.ftm ?? 0),
    fta: Number(row.fta ?? 0),
    oreb: Number(row.oreb ?? 0),
    dreb: Number(row.dreb ?? 0),
    tov: Number(row.tov ?? 0),
    pf: Number(row.pf ?? 0),
    plusMinus: Number(row.plus_minus ?? row.plusMinus ?? 0),
    offRating: Number(row.off_rating ?? row.offRating ?? 0),
    defRating: Number(row.def_rating ?? row.defRating ?? 0),
    netRating: Number(row.net_rating ?? row.netRating ?? 0),
    tsPct: Number(row.ts_pct ?? row.tsPct ?? 0),
    efgPct: Number(row.efg_pct ?? row.efgPct ?? 0),
    usgPct: Number(row.usg_pct ?? row.usgPct ?? 0),
    pace: Number(row.pace ?? 0),
    pie: Number(row.pie ?? 0),
    astPct: Number(row.ast_pct ?? row.astPct ?? 0),
    orebPct: Number(row.oreb_pct ?? row.orebPct ?? 0),
    drebPct: Number(row.dreb_pct ?? row.drebPct ?? 0),
    rebPct: Number(row.reb_pct ?? row.rebPct ?? 0),
    tsPlus: Number(row.ts_plus ?? row.tsPlus ?? 0),
    efgPlus: Number(row.efg_plus ?? row.efgPlus ?? 0),
    fgPlus: Number(row.fg_plus ?? row.fgPlus ?? 0),
    fg3Plus: Number(row.fg3_plus ?? row.fg3Plus ?? 0),
    ftPlus: Number(row.ft_plus ?? row.ftPlus ?? 0),
    fg2Plus: Number(row.fg2_plus ?? row.fg2Plus ?? 0),
  }));

  const photoUrl = `https://cdn.nba.com/headshots/nba/latest/260x190/${player.player_id}.png`;
  const careerSpan = player.from_year && player.to_year
    ? `${player.from_year} — ${player.to_year}`
    : player.from_year
      ? `Depuis ${player.from_year}`
      : "N/A";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <JsonLd data={playerJsonLd} />
      <Link
        href="/joueurs"
        className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-input hover:text-text-primary"
      >
        <ChevronLeft size={16} />
        Tous les joueurs
      </Link>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-border-t bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/8 via-transparent to-transparent" />
        <div className="relative flex flex-col items-center gap-6 p-5 sm:flex-row sm:items-start sm:gap-8 sm:p-10">
          <div className="relative shrink-0">
            <div className="h-40 w-48 overflow-hidden rounded-2xl bg-gradient-to-b from-accent/15 to-accent/5 shadow-lg">
              <img src={photoUrl} alt={`${player.first_name} ${player.last_name}`} className="h-full w-full object-cover object-top" />
            </div>
            {player.team_tricode && teamLogoUrl(player.team_tricode) && (
              <img src={teamLogoUrl(player.team_tricode)} alt={player.team_tricode} className="absolute -bottom-3 -right-3 h-12 w-12 object-contain" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-lg text-text-muted">{player.first_name}</p>
            <h1 className="text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">{player.last_name}</h1>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {player.is_active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  En activité
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-input px-3 py-1 text-xs font-semibold text-text-muted">Retraité</span>
              )}
              {player.position && (
                <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">{player.position}</span>
              )}
              {player.jersey_number && (
                <span className="rounded-full bg-input px-3 py-1 text-xs font-bold text-text-secondary">#{player.jersey_number}</span>
              )}
            </div>

            {player.team_tricode && player.team_city && player.team_name && (
              <Link href="/equipes" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-input px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary">
                {teamLogoUrl(player.team_tricode) && <img src={teamLogoUrl(player.team_tricode)} alt="" className="h-5 w-5 object-contain" />}
                {player.team_city} {player.team_name}
              </Link>
            )}

            {rosterEntry?.salary && (
              <p className="mt-3 text-sm text-text-muted">
                Salaire {season} : <strong className="text-text-primary">{rosterEntry.salary}</strong>
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <FollowPlayerButton playerId={player.player_id} />
              <Link
                href={`/joueurs/comparer?p1=${player.player_id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-input px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text-primary"
              >
                <BarChart3 size={16} />
                Comparer
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats highlights */}
      {(player.pts != null || player.reb != null || player.ast != null) && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Points" value={player.pts?.toFixed(1) ?? "N/A"} />
          <StatBox label="Rebonds" value={player.reb?.toFixed(1) ?? "N/A"} />
          <StatBox label="Passes" value={player.ast?.toFixed(1) ?? "N/A"} />
        </div>
      )}

      {/* Career evolution chart */}
      {careerSeasons.length > 1 && (
        <ScrollReveal variant="up" delay={80}>
          <CareerChart seasons={careerSeasons} />
        </ScrollReveal>
      )}

      {/* Bio info */}
      <div className="rounded-2xl bg-card border border-border-t p-6">
        <h2 className="mb-4 text-lg font-bold text-text-primary">Informations</h2>
        {player.height && <InfoRow icon={<Ruler size={14} />} label="Taille" value={player.height} />}
        {player.weight && <InfoRow icon={<Weight size={14} />} label="Poids" value={`${player.weight} lbs`} />}
        {player.country && <InfoRow icon={<MapPin size={14} />} label="Nationalité" value={player.country} />}
        {player.college && <InfoRow icon={<GraduationCap size={14} />} label="Université" value={player.college} />}
        <InfoRow icon={<Hash size={14} />} label="Draft" value={draftLabel(player)} />
        <InfoRow icon={<Calendar size={14} />} label="Carrière" value={careerSpan} />
      </div>

      {/* Career: teams + stats table */}
      <PlayerCareer seasons={careerSeasons} />
    </div>
  );
}
