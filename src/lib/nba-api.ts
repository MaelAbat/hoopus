export interface PlayerStatLeader {
  rank: number;
  name: string;
  team: string;
  value: string;
}

export type StatCategory = "PTS" | "REB" | "AST" | "BLK" | "STL" | "FG3_PCT";
