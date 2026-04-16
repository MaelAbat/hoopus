-- New game-specific achievements
insert into achievements (id, title, description, icon, category, threshold) values
  ('win_50', 'Expert', 'Gagner 50 mini-jeux', 'award', 'games', 50),
  ('hooprank_perfect', 'Score Parfait', 'Obtenir 500/500 au HoopRank', 'crown', 'mastery', 500),
  ('hooprank_400', 'Classeur d''elite', 'Obtenir 400 ou plus au HoopRank', 'bar-chart-3', 'games', 400),
  ('hoopmore_10', 'En feu', 'Faire une serie de 10 au HoopMore', 'flame', 'games', 10),
  ('hoopmore_20', 'Intouchable', 'Faire une serie de 20 au HoopMore', 'shield', 'mastery', 20),
  ('hoopixl_first', 'Oeil de lynx', 'Trouver le joueur du premier coup dans Hoopixl', 'eye', 'mastery', 1),
  ('hooplink_3', 'Court-circuit', 'Completer HoopLink en 3 maillons ou moins', 'link', 'mastery', 3),
  ('quiz_perfect', 'Incollable', 'Trouver toutes les reponses d''un quiz Hoopiz', 'brain', 'mastery', 1),
  ('speed_10', 'Eclair', 'Terminer un jeu en moins de 10 secondes', 'bolt', 'mastery', 1)
on conflict (id) do nothing;
