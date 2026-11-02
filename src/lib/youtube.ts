import { createClient } from "@supabase/supabase-js";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Âge maximal, en jours, d'un match dont on cherche encore le résumé.
 *
 * Une recherche coûte 100 unités sur un quota de 10 000 par jour : cent
 * recherches. Un match sans résultat n'enregistre rien et la recherche
 * recommençait chaque jour ; un robot parcourant les anciens matchs épuisait
 * ainsi le quota avant que les matchs de la veille aient le leur. Le résumé
 * paraît dans les heures qui suivent le match : au-delà, un match garde ce qui
 * est en base.
 */
const SEARCH_WINDOW_DAYS = 7;

/**
 * Search YouTube for a game highlight video and cache the result in the DB.
 * Returns the video ID or null.
 */
export async function getHighlightVideoId(
  gameId: string,
  awayTeamName: string,
  homeTeamName: string,
  gameDate: string // YYYY-MM-DD
): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null;
  const ageMs = Date.now() - new Date(`${gameDate}T00:00:00Z`).getTime();
  if (ageMs > SEARCH_WINDOW_DAYS * 86_400_000) return null;

  // Search YouTube
  const query = `${awayTeamName} vs ${homeTeamName} Full Game Highlights`;

  const date = new Date(gameDate + "T00:00:00Z");
  const publishedAfter = date.toISOString();
  const dayAfter = new Date(date.getTime() + 3 * 86_400_000);
  const publishedBefore = dayAfter.toISOString();

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "3",
    order: "relevance",
    publishedAfter,
    publishedBefore,
    key: YOUTUBE_API_KEY,
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { next: { revalidate: 86_400 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const items = data.items || [];

    // Prefer videos from GAMETIME HIGHLIGHTS or with "Full Game Highlights" in title
    const best =
      items.find(
        (v: { snippet?: { channelTitle?: string } }) =>
          v.snippet?.channelTitle?.toUpperCase().includes("GAMETIME")
      ) ?? items[0];

    const videoId: string | undefined = best?.id?.videoId;
    if (!videoId) return null;

    // Cache in DB
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase
      .from("games")
      .update({ highlight_video_id: videoId })
      .eq("game_id", gameId);

    return videoId;
  } catch {
    return null;
  }
}
