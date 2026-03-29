-- Add unique constraint on team_stats for upsert support
ALTER TABLE team_stats ADD CONSTRAINT team_stats_team_id_season_key UNIQUE (team_id, season);

-- Ensure players table has unique constraint on player_id (if not already)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_player_id_key'
  ) THEN
    ALTER TABLE players ADD CONSTRAINT players_player_id_key UNIQUE (player_id);
  END IF;
END $$;
