import { getArticles } from "@/lib/actions/articles";
import { isAdmin } from "@/lib/actions/auth";
import ArticlesList from "@/components/ArticlesList";
import PageBanner from "@/components/PageBanner";

export default async function Articles() {
  const [articles, admin] = await Promise.all([getArticles(), isAdmin()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageBanner
        title="Articles"
        subtitle="Analyses, décryptages et portraits"
        image="https://images.unsplash.com/photo-1549210194-fb0aac030c32?w=1200&q=80"
      />
      <ArticlesList articles={articles} isAdmin={admin} />
    </div>
  );
}
