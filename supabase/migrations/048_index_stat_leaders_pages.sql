-- La page Statistiques lit toute une saison de stat_leaders (environ 30 000
-- lignes) par pages de mille, triées par rang, catégorie et joueur. Avec le seul
-- index (season, season_type), chaque page triait toute la saison avant d'en
-- sauter le début : trente tris en parallèle, qui dépassaient le délai des
-- requêtes dès qu'une sync écrivait en même temps (erreurs 57014).
--
-- Cet index rend les lignes déjà dans l'ordre de lecture.
create index if not exists idx_stat_leaders_page_order
  on public.stat_leaders (season, season_type, rank, category, player_name);
