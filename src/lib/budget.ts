// Time budgets derived from the hosting plan's function limit.
// Next.js `maxDuration` must be a literal, so routes request 300 s; set FUNCTION_MAX_SECONDS to
// your plan's real limit (Vercel: Project → Settings → Functions) and every refresh stops starting
// new work before the platform would kill it.
function seconds(name: string, fallback: number, min: number, max: number) {
  const raw = process.env[name];
  const value = raw == null || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
/** The platform's maximum function duration in seconds (default 300). */
export function functionMaxSeconds() { return seconds("FUNCTION_MAX_SECONDS", 300, 10, 900); }
/** Scheduled refresh: stop starting new users/boards after this many ms. ~75% of the limit leaves room for in-flight boards. */
export function cronBudgetMs() {
  const limit = functionMaxSeconds();
  return seconds("CRON_BUDGET_SECONDS", Math.floor(limit * 0.75), 5, limit - 5) * 1000;
}
/** How many users the scheduled refresh processes in parallel (default 3). */
export function cronConcurrency() { return Math.round(seconds("CRON_CONCURRENCY", 3, 1, 10)); }
/** "Refresh feed" button: stop starting new boards after this many ms. */
export function manualRefreshBudgetMs() { const limit = functionMaxSeconds(); return Math.max(5, Math.floor(limit * 0.8)) * 1000; }
/** Minimum time left to start the HN thread (it reads up to 1,000 comments). */
export const HN_MIN_MS = 25_000;
