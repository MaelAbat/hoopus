export interface PlayerStatLeader {
  rank: number;
  name: string;
  team: string;
  value: string;
  player_id: number;
}

export type StatCategory =
  | "PTS" | "REB" | "AST" | "BLK" | "STL"
  | "FG_PCT" | "FG3_PCT" | "FG2_PCT" | "FT_PCT"
  | "TS_PCT" | "EFF" | "TOV"
  | "MIN" | "OREB" | "DREB" | "GP" | "TOT_MIN"
  | "FGA_TOT" | "FG3A_TOT" | "FTA_TOT" | "FG2A_TOT"
  | "EFG_PCT" | "USG_PCT"
  | "OFF_RATING" | "DEF_RATING" | "NET_RATING"
  | "AST_PCT" | "OREB_PCT" | "DREB_PCT" | "REB_PCT"
  | "PACE" | "PIE"
  | "TS_PLUS" | "EFG_PLUS" | "FG_PLUS" | "FG3_PLUS" | "FT_PLUS" | "FG2_PLUS"
  | "PTS_TOT" | "REB_TOT" | "AST_TOT" | "BLK_TOT" | "STL_TOT" | "TOV_TOT"
  | "FGM_TOT" | "FG3M_TOT" | "FTM_TOT" | "FG2M_TOT"
  | "OREB_TOT" | "DREB_TOT" | "PF_TOT" | "PLUS_MINUS_TOT";
