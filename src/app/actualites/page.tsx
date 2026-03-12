import { getNews } from "@/lib/actions/news";
import NewsList from "@/components/NewsList";

export default async function Actualites() {
  const news = await getNews();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <NewsList news={news} />
    </div>
  );
}
