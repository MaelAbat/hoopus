import https from "node:https";
import { NextRequest, NextResponse } from "next/server";

const NBA_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Encoding": "identity",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Host: "stats.nba.com",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

interface NbaResponse {
  resultSets: { headers: string[]; rowSet: (string | number | null)[][] }[];
}

function fetchNba(url: string): Promise<NbaResponse> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: NBA_HEADERS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`NBA API error: ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8"))); } catch { reject(new Error("Parse error")); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  if (!playerId || !/^\d{1,10}$/.test(playerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const data = await fetchNba(
      `https://stats.nba.com/stats/playercareerstats?LeagueID=00&PerMode=PerGame&PlayerID=${playerId}`
    );

    const rs = data.resultSets.find((r) => r.headers.includes("SEASON_ID"));
    if (!rs) {
      return NextResponse.json({ seasons: [] });
    }

    const h = rs.headers;
    const ii = (name: string) => h.indexOf(name);

    const seasons = rs.rowSet.map((row) => ({
      season: String(row[ii("SEASON_ID")] || ""),
      team: String(row[ii("TEAM_ABBREVIATION")] || ""),
      gp: Number(row[ii("GP")] || 0),
      pts: Number(row[ii("PTS")] || 0),
      reb: Number(row[ii("REB")] || 0),
      ast: Number(row[ii("AST")] || 0),
      stl: Number(row[ii("STL")] || 0),
      blk: Number(row[ii("BLK")] || 0),
      fgPct: Number(row[ii("FG_PCT")] || 0),
      fg3Pct: Number(row[ii("FG3_PCT")] || 0),
      ftPct: Number(row[ii("FT_PCT")] || 0),
      min: Number(row[ii("MIN")] || 0),
    }));

    return NextResponse.json({ seasons }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (err) {
    return NextResponse.json({ seasons: [], error: (err as Error).message }, { status: 200 });
  }
}
