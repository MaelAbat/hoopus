import { getNews } from "@/lib/actions/news";
import { isAdmin } from "@/lib/actions/auth";
import NewsList from "@/components/NewsList";
import PageBanner from "@/components/PageBanner";
import ScrollReveal from "@/components/ScrollReveal";

export default async function Actualites() {
  const [news, admin] = await Promise.all([getNews(), isAdmin()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Actualites"
        subtitle="Les dernieres nouvelles de la NBA"
        image="https://images.unsplash.com/photo-1527261834078-9b37d35a4a32?w=1200&q=80"
      />
      <ScrollReveal variant="up" delay={100}>
        <NewsList news={news} isAdmin={admin} />
      </ScrollReveal>
    </div>
  );
}
