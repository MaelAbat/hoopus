-- Performance indexes for historical multi-season data
-- These indexes drastically speed up season-filtered queries

-- stat_leaders: ~134K+ rows, queried by season on every stats page load
create index if not exists idx_stat_leaders_season on stat_leaders(season);
create index if not exists idx_stat_leaders_category_season on stat_leaders(category, season);

-- team_stats: queried by season on stats page
create index if not exists idx_team_stats_season on team_stats(season);

-- player_career_stats: queried by player_id AND season
create index if not exists idx_career_season on player_career_stats(season);

-- team_payrolls: queried by season on equipes page
create index if not exists idx_team_payrolls_season on team_payrolls(season);
