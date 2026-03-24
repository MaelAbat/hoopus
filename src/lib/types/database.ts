export interface News {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  featured: boolean;
  created_at: string;
}

export interface Article {
  id: string;
  tag: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  read_time: string;
  image_url: string | null;
  created_at: string;
}
