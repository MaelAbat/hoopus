import { getArticles } from "@/lib/actions/articles";
import ArticlesList from "@/components/ArticlesList";

export default async function Articles() {
  const articles = await getArticles();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <ArticlesList articles={articles} />
    </div>
  );
}
