-- Achievements definition
create table if not exists achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,         -- lucide icon name
  category text not null,     -- 'games', 'streaks', 'mastery'
  threshold int not null default 1
);

-- User achievements (unlocked)
create table if not exists user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  achievement_id text references achievements(id) not null,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_id)
);

-- RLS
alter table achievements enable row level security;
alter table user_achievements enable row level security;

create policy "Anyone can read achievements" on achievements for select using (true);
create policy "Users can read own achievements" on user_achievements for select using (auth.uid() = user_id);
create policy "Users can unlock achievements" on user_achievements for insert with check (auth.uid() = user_id);

-- Seed default achievements
insert into achievements (id, title, description, icon, category, threshold) values
  ('first_win', 'Première Victoire', 'Gagner un mini-jeu pour la première fois', 'trophy', 'games', 1),
  ('win_5', 'Habitué', 'Gagner 5 mini-jeux', 'medal', 'games', 5),
  ('win_25', 'Vétéran', 'Gagner 25 mini-jeux', 'award', 'games', 25),
  ('win_100', 'Légende', 'Gagner 100 mini-jeux', 'crown', 'mastery', 100),
  ('streak_3', 'Série en cours', 'Gagner 3 jours de suite', 'flame', 'streaks', 3),
  ('streak_7', 'Semaine parfaite', 'Gagner 7 jours de suite', 'zap', 'streaks', 7),
  ('streak_30', 'Inarrêtable', 'Gagner 30 jours de suite', 'star', 'streaks', 30),
  ('speed_demon', 'Speed Demon', 'Terminer un jeu en moins de 30 secondes', 'timer', 'mastery', 1),
  ('perfect_hoopl', 'Hoopl Parfait', 'Trouver le joueur au premier essai dans Hoopl', 'target', 'mastery', 1),
  ('all_games', 'Polyvalent', 'Jouer aux 7 mini-jeux en un jour', 'gamepad-2', 'mastery', 1),
  ('explorer', 'Explorateur', 'Jouer à 3 jeux différents', 'compass', 'games', 3),
  ('dedicated', 'Assidu', 'Jouer 10 jours différents', 'calendar-check', 'streaks', 10)
on conflict (id) do nothing;
