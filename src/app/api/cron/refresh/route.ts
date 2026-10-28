import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { store, isDemo } from "@/lib/store";
import { refreshUser } from "@/lib/refresh";
import { cronBudgetMs, cronConcurrency } from "@/lib/budget";
export const maxDuration = 300;
// Called hourly. Each call refreshes only users whose last full refresh is older than STALE_MS,
// stalest first, with limited concurrency and a time budget (FUNCTION_MAX_SECONDS /
// CRON_BUDGET_SECONDS / CRON_CONCURRENCY, see src/lib/budget.ts). Users or boards left over are
// picked up by the next call, so every user is refreshed about every 6 hours.
const STALE_MS = 6 * 3600_000 - 15 * 60_000;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || secret.length < 24 || provided.length !== secret.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(secret)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isDemo) return NextResponse.json({ error: "Cron requires PostgreSQL mode" }, { status: 400 });
  const started = Date.now(), budget = cronBudgetMs(), deadline = started + budget;
  const [users, last] = await Promise.all([store.listUsers(), store.lastRefreshTimes()]);
  const age = (uid: string) => { const t = last.get(uid); return t ? started - new Date(t).getTime() : Infinity; };
  const due = users.filter(u => age(u.id) > STALE_MS).sort((a, b) => age(b.id) - age(a.id));
  const queue = [...due];
  const runs: Array<{ userId: string; added?: number; closed?: number; errors?: number; boardsLeft?: number; error?: string }> = [];
  async function worker() {
    while (queue.length && Date.now() < deadline) {
      const user = queue.shift()!;
      try {
        const run = await refreshUser(user.id, { deadline });
        runs.push({ userId: user.id, added: run.added, closed: run.closed, errors: run.errors.length, boardsLeft: run.remaining });
      }
      catch (e) { runs.push({ userId: user.id, error: e instanceof Error ? e.message : "Refresh failed" }); }
    }
  }
  await Promise.all(Array.from({ length: cronConcurrency() }, worker));
  return NextResponse.json({ users: users.length, due: due.length, processed: runs.length, remaining: queue.length,
    budgetSeconds: budget / 1000, elapsedSeconds: Math.round((Date.now() - started) / 1000), runs });
}
