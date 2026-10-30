import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hoopus.fr";

// Refresh the sitemap at most once per hour (matches page ISR cadence).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPaths: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/calendrier", changeFrequency: "daily", priority: 0.9 },
    { path: "/classement", changeFrequency: "daily", priority: 0.9 },
    { path: "/statistiques", changeFrequency: "daily", priority: 0.9 },
    { path: "/joueurs", changeFrequency: "weekly", priority: 0.8 },
    { path: "/joueurs/comparer", changeFrequency: "weekly", priority: 0.6 },
    { path: "/equipes", changeFrequency: "weekly", priority: 0.8 },
    { path: "/trades", changeFrequency: "weekly", priority: 0.6 },
    { path: "/mercato", changeFrequency: "daily", priority: 0.8 },
    { path: "/draft", changeFrequency: "monthly", priority: 0.6 },
    { path: "/blessures", changeFrequency: "daily", priority: 0.7 },
    { path: "/playoffs", changeFrequency: "daily", priority: 0.7 },
    { path: "/actualites", changeFrequency: "daily", priority: 0.8 },
    { path: "/articles", changeFrequency: "weekly", priority: 0.7 },
    { path: "/mini-jeux", changeFrequency: "weekly", priority: 0.6 },
    { path: "/mini-jeux/hoopgrid", changeFrequency: "weekly", priority: 0.5 },
    { path: "/mini-jeux/hoopixl", changeFrequency: "weekly", priority: 0.5 },
    { path: "/mini-jeux/hoopiz", changeFrequency: "weekly", priority: 0.5 },
    { path: "/mini-jeux/hoopl", changeFrequency: "weekly", priority: 0.5 },
    { path: "/mini-jeux/hooplink", changeFrequency: "weekly", priority: 0.5 },
    { path: "/mini-jeux/hoopmore", changeFrequency: "weekly", priority: 0.5 },
    { path: "/mini-jeux/hooprank", changeFrequency: "weekly", priority: 0.5 },
  ];

  const staticRoutes: MetadataRoute.Sitemap = staticPaths
    .map((r) => ({
      url: `${siteUrl}${r.path}`,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    }));

  try {
    const supabase = createPublicClient();

    const [{ data: players }, { data: articles }, { data: news }, { data: drafts }] = await Promise.all([
      supabase
        .from("players")
        .select("player_id, updated_at")
        .eq("is_active", true)
        .order("last_name", { ascending: true }),
      supabase.from("articles").select("id, created_at").order("created_at", { ascending: false }),
      supabase.from("news").select("id, created_at").order("created_at", { ascending: false }),
      // Une ligne par draft : le premier choix suffit à connaître les années
      // archivées, sans rapatrier les soixante rangs de chacune.
      supabase.from("draft_picks").select("season, updated_at").eq("pick_overall", 1),
    ]);

    const playerRoutes: MetadataRoute.Sitemap = (players ?? []).map((p) => ({
      url: `${siteUrl}/joueurs/${p.player_id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    const articleRoutes: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
      url: `${siteUrl}/articles/${a.id}`,
      lastModified: a.created_at ? new Date(a.created_at) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    const newsRoutes: MetadataRoute.Sitemap = (news ?? []).map((n) => ({
      url: `${siteUrl}/actualites/${n.id}`,
      lastModified: n.created_at ? new Date(n.created_at) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    const draftRoutes: MetadataRoute.Sitemap = (drafts ?? []).map((d) => ({
      url: `${siteUrl}/draft/${d.season}`,
      lastModified: d.updated_at ? new Date(d.updated_at) : now,
      changeFrequency: "yearly",
      priority: 0.5,
    }));

    return [...staticRoutes, ...playerRoutes, ...articleRoutes, ...newsRoutes, ...draftRoutes];
  } catch {
    // If the DB is unreachable at build/revalidate time, still ship static routes.
    return staticRoutes;
  }
}
