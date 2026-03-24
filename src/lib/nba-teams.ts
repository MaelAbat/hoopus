/**
 * NBA team IDs — active + historical/defunct franchises.
 * Logo URL: https://cdn.nba.com/logos/nba/{id}/global/L/logo.svg
 */

interface TeamInfo {
  id: number;
  active: boolean;
}

const TEAMS: Record<string, TeamInfo> = {
  // ── 30 franchises actuelles ──────────────
  ATL: { id: 1610612737, active: true },
  BOS: { id: 1610612738, active: true },
  BKN: { id: 1610612751, active: true },
  CHA: { id: 1610612766, active: true },
  CHI: { id: 1610612741, active: true },
  CLE: { id: 1610612739, active: true },
  DAL: { id: 1610612742, active: true },
  DEN: { id: 1610612743, active: true },
  DET: { id: 1610612765, active: true },
  GSW: { id: 1610612744, active: true },
  HOU: { id: 1610612745, active: true },
  IND: { id: 1610612754, active: true },
  LAC: { id: 1610612746, active: true },
  LAL: { id: 1610612747, active: true },
  MEM: { id: 1610612763, active: true },
  MIA: { id: 1610612748, active: true },
  MIL: { id: 1610612749, active: true },
  MIN: { id: 1610612750, active: true },
  NOP: { id: 1610612740, active: true },
  NYK: { id: 1610612752, active: true },
  OKC: { id: 1610612760, active: true },
  ORL: { id: 1610612753, active: true },
  PHI: { id: 1610612755, active: true },
  PHX: { id: 1610612756, active: true },
  POR: { id: 1610612757, active: true },
  SAC: { id: 1610612758, active: true },
  SAS: { id: 1610612759, active: true },
  TOR: { id: 1610612761, active: true },
  UTA: { id: 1610612762, active: true },
  WAS: { id: 1610612764, active: true },

  // ── Anciennes franchises / tricodes historiques ──
  SEA: { id: 1610612760, active: false },  // SuperSonics → OKC Thunder
  NJN: { id: 1610612751, active: false },  // New Jersey Nets → BKN
  VAN: { id: 1610612763, active: false },  // Vancouver Grizzlies → MEM
  NOH: { id: 1610612740, active: false },  // New Orleans Hornets → NOP
  NOK: { id: 1610612740, active: false },  // NO/Oklahoma City Hornets → NOP
  CHH: { id: 1610612766, active: false },  // Charlotte Hornets (original) → CHA
  CHA2: { id: 1610612766, active: false }, // alias
  WSB: { id: 1610612764, active: false },  // Washington Bullets → WAS
  BAL: { id: 1610612764, active: false },  // Baltimore Bullets → WAS
  SDC: { id: 1610612746, active: false },  // San Diego Clippers → LAC
  BUF: { id: 1610612746, active: false },  // Buffalo Braves → LAC
  KCK: { id: 1610612758, active: false },  // Kansas City Kings → SAC
  CIN: { id: 1610612758, active: false },  // Cincinnati Royals → SAC
  ROC: { id: 1610612758, active: false },  // Rochester Royals → SAC
  SFW: { id: 1610612744, active: false },  // San Francisco Warriors → GSW
  PHW: { id: 1610612744, active: false },  // Philadelphia Warriors → GSW
  SDR: { id: 1610612745, active: false },  // San Diego Rockets → HOU
  NYN: { id: 1610612751, active: false },  // New York Nets → BKN
  MNL: { id: 1610612747, active: false },  // Minneapolis Lakers → LAL
  STL: { id: 1610612737, active: false },  // St. Louis Hawks → ATL
  MLH: { id: 1610612737, active: false },  // Milwaukee Hawks → ATL
  TRI: { id: 1610612737, active: false },  // Tri-Cities Blackhawks → ATL
  SYR: { id: 1610612755, active: false },  // Syracuse Nationals → PHI
  FTW: { id: 1610612765, active: false },  // Fort Wayne Pistons → DET
  CHZ: { id: 1610612764, active: false },  // Chicago Zephyrs → WAS
  CHP: { id: 1610612764, active: false },  // Chicago Packers → WAS
  CAP: { id: 1610612764, active: false },  // Capital Bullets → WAS
  NOJ: { id: 1610612762, active: false },  // New Orleans Jazz → UTA
  DNR: { id: 1610612743, active: false },  // Denver Rockets/Nuggets ABA → DEN
  TCB: { id: 1610612737, active: false },  // Tri-Cities Blackhawks → ATL
  BLB: { id: 1610612764, active: false },  // Baltimore Bullets original
  CLR: { id: 1610612739, active: false },  // Cleveland Rebels
  PIT: { id: 1610612739, active: false },  // Pittsburgh Ironmen
};

/**
 * Get team NBA ID from tricode. Works for both active and historical teams.
 */
export function getTeamId(tricode: string): number | null {
  return TEAMS[tricode]?.id ?? null;
}

/**
 * Get team logo URL. Returns empty string if tricode is unknown.
 */
export function teamLogoUrl(tricode: string): string {
  const id = TEAMS[tricode]?.id;
  return id ? `https://cdn.nba.com/logos/nba/${id}/global/L/logo.svg` : "";
}

/**
 * Get player headshot URL.
 */
export function playerPhotoUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
}

/**
 * Map of active team tricodes to their NBA IDs (for components that only need current teams).
 */
export const ACTIVE_TEAM_IDS: Record<string, number> = Object.fromEntries(
  Object.entries(TEAMS)
    .filter(([, info]) => info.active)
    .map(([tri, info]) => [tri, info.id])
);
