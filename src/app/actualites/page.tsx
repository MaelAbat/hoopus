import { getNews } from "@/lib/actions/news";
import { isAdmin } from "@/lib/actions/auth";
import NewsList from "@/components/NewsList";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata = {
  title: "Actualités NBA",
  description:
    "Toute l'actualité NBA en français : dernières infos, transferts, blessures et temps forts de la ligue, au fil de l'eau sur Hoopus.",
  alternates: { canonical: "/actualites" },
  openGraph: {
    title: "Actualités NBA · Hoopus",
    description: "Dernières infos, transferts et temps forts de la NBA, en français.",
  },
};

export default async function Actualites() {
  const [news, admin] = await Promise.all([getNews(), isAdmin()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Actualites"
        subtitle="Les dernieres nouvelles de la NBA"
        variant="news"
      />
      <ScrollReveal variant="up" delay={100}>
        <NewsList news={news} isAdmin={admin} />
      </ScrollReveal>
    </div>
  );
}
