-- ==========================================
-- Table: news (Actualités)
-- ==========================================
create table public.news (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  title text not null,
  excerpt text not null,
  featured boolean default false,
  created_at timestamptz default now()
);

-- Autoriser lecture publique, écriture libre (auth à ajouter plus tard)
alter table public.news enable row level security;
create policy "Allow public read on news" on public.news for select using (true);
create policy "Allow public insert on news" on public.news for insert with check (true);
create policy "Allow public update on news" on public.news for update using (true);
create policy "Allow public delete on news" on public.news for delete using (true);

-- Seed data
insert into public.news (category, title, excerpt, featured) values
  ('Trade', 'Un blockbuster trade entre les Lakers et les Nets secoue la ligue', 'Les deux franchises auraient trouvé un accord impliquant plusieurs joueurs majeurs et des picks de draft.', true),
  ('Match', 'Les Celtics enchaînent une 10ème victoire consécutive', 'Boston domine Milwaukee 118-102 derrière un Jayson Tatum à 38 points.', false),
  ('Blessure', 'Mise à jour sur la blessure de Luka Doncic', 'Le Slovène est annoncé out pour 2 à 3 semaines avec une entorse à la cheville.', false),
  ('Draft', 'Mock Draft 2026 : les projections mises à jour', 'Après le tournoi NCAA, les positions ont bougé dans le top 10.', false),
  ('Classement', 'La course aux playoffs dans l''Ouest : 6 équipes pour 3 places', 'À un mois de la fin de la saison régulière, la bataille fait rage.', false);

-- ==========================================
-- Table: articles
-- ==========================================
create table public.articles (
  id uuid default gen_random_uuid() primary key,
  tag text not null,
  title text not null,
  excerpt text not null,
  content text default '',
  author text not null,
  read_time text not null,
  created_at timestamptz default now()
);

alter table public.articles enable row level security;
create policy "Allow public read on articles" on public.articles for select using (true);
create policy "Allow public insert on articles" on public.articles for insert with check (true);
create policy "Allow public update on articles" on public.articles for update using (true);
create policy "Allow public delete on articles" on public.articles for delete using (true);

-- Seed data
insert into public.articles (tag, title, excerpt, content, author, read_time) values
  ('Analyse', 'Pourquoi le jeu sans ballon est devenu la clé du basket moderne', 'Le mouvement off-ball n''a jamais été aussi important. Décryptage d''une tendance qui redéfinit le jeu.', 'Le basketball moderne a profondément évolué...', 'Thomas M.', '8 min'),
  ('Histoire', 'Retour sur la dynastie des Warriors : 2015-2023', 'De la montée en puissance au déclin, comment Golden State a changé le visage de la NBA à jamais.', 'Lorsque Stephen Curry a commencé à enchaîner les tirs à trois points...', 'Julie R.', '12 min'),
  ('Tactique', 'Le small ball est-il mort ? Les centres dominent à nouveau', 'Après des années de small ball, les pivots reprennent le pouvoir. Analyse des chiffres qui le prouvent.', 'Pendant près d''une décennie, la NBA a vu ses équipes réduire la taille...', 'Marc D.', '6 min'),
  ('Portrait', 'Victor Wembanyama : la saison de la confirmation', 'En sa deuxième année, le Français confirme tout son potentiel et se positionne comme futur MVP.', 'Victor Wembanyama n''a que 21 ans mais il domine déjà...', 'Sarah L.', '10 min');
