export interface News {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  featured: boolean;
  created_at: string;
}

export interface Player {
  player_id: number;
  first_name: string;
  last_name: string;
  team_tricode: string | null;
  team_name: string | null;
  team_city: string | null;
  jersey_number: string | null;
  position: string | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  country: string | null;
  draft_year: number | null;
  draft_round: number | null;
  draft_number: number | null;
  from_year: number | null;
  to_year: number | null;
  is_active: boolean;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  updated_at: string;
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
