import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { store, isDemo } from "@/lib/store";
import { refreshUser } from "@/lib/refresh";
export const maxDuration = 300;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || secret.length < 24 || provided.length !== secret.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isDemo) return NextResponse.json({ error: "Cron requires PostgreSQL mode" }, { status: 400 });
  const users = await store.listUsers(); const runs = [];
  for (const user of users) {
    try { runs.push({ userId: user.id, run: await refreshUser(user.id) }); }
    catch (e) { runs.push({ userId: user.id, error: e instanceof Error ? e.message : "Refresh failed" }); }
  }
  return NextResponse.json({ processed: runs.length, runs });
}
