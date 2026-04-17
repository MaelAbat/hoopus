import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ") && safeEqual(authHeader.slice(7), secret)) {
    return true;
  }

  const querySecret = request.nextUrl.searchParams.get("cron_secret");
  if (querySecret && safeEqual(querySecret, secret)) {
    return true;
  }

  return false;
}
