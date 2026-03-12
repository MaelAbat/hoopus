import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Appeler la route de sync des stats
  const baseUrl = request.nextUrl.origin;
  const syncRes = await fetch(
    `${baseUrl}/api/sync-stats?secret=${process.env.REVALIDATE_SECRET}`,
    { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }
  );

  const syncData = await syncRes.json();

  return NextResponse.json({
    ok: true,
    sync: syncData,
    timestamp: new Date().toISOString(),
  });
}
