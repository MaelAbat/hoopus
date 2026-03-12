import { getArticles } from "@/lib/actions/articles";
import { isAdmin } from "@/lib/actions/auth";
import ArticlesList from "@/components/ArticlesList";

export default async function Articles() {
  const [articles, admin] = await Promise.all([getArticles(), isAdmin()]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ArticlesList articles={articles} isAdmin={admin} />
    </div>
  );
}
