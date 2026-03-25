import { createClient } from "@/lib/supabase/server";
import PageBanner from "@/components/PageBanner";
import PlayersView from "@/components/PlayersView";
import ScrollReveal from "@/components/ScrollReveal";

export const revalidate = 3600;

export default async function Joueurs() {
  const supabase = await createClient();

  // Paginate (Supabase 1000 row limit)
  const pages = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      supabase
        .from("players")
        .select("*")
        .order("last_name", { ascending: true })
        .range(i * 1000, (i + 1) * 1000 - 1)
    )
  );

  const players = pages.flatMap((p) => p.data || []);
  const hasData = players.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageBanner
        title="Joueurs"
        subtitle={hasData ? `${players.length} joueurs référencés` : "Répertoire de tous les joueurs NBA"}
        image="https://images.unsplash.com/photo-1515523110800-9415d13b84a8?w=1200&q=80"
        extra={!hasData ? (
          <span className="inline-flex items-center rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
            Synchronisation requise
          </span>
        ) : undefined}
      />
      <ScrollReveal variant="up" delay={100}>
        <PlayersView players={players} />
      </ScrollReveal>
    </div>
  );
}
