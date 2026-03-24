export interface PlayerStatLeader {
  rank: number;
  name: string;
  team: string;
  value: string;
}

export type StatCategory =
  | "PTS" | "REB" | "AST" | "BLK" | "STL"
  | "FG_PCT" | "FG3_PCT" | "FG2_PCT" | "FT_PCT"
  | "TS_PCT" | "EFF" | "TOV";
