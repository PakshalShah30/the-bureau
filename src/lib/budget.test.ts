import { afterEach, describe, expect, it, vi } from "vitest";
import { cronBudgetMs, cronConcurrency, functionMaxSeconds, manualRefreshBudgetMs } from "./budget";
afterEach(() => vi.unstubAllEnvs());
describe("time budgets", () => {
  it("defaults to a 300 s limit", () => {
    expect(functionMaxSeconds()).toBe(300);
    expect(cronBudgetMs()).toBe(225_000);
    expect(manualRefreshBudgetMs()).toBe(240_000);
    expect(cronConcurrency()).toBe(3);
  });
  it("derives budgets from the plan limit", () => {
    vi.stubEnv("FUNCTION_MAX_SECONDS", "60");
    expect(cronBudgetMs()).toBe(45_000);
    expect(manualRefreshBudgetMs()).toBe(48_000);
  });
  it("honours explicit overrides but never exceeds the limit, and ignores junk", () => {
    vi.stubEnv("FUNCTION_MAX_SECONDS", "60");
    vi.stubEnv("CRON_BUDGET_SECONDS", "50"); expect(cronBudgetMs()).toBe(50_000);
    vi.stubEnv("CRON_BUDGET_SECONDS", "500"); expect(cronBudgetMs()).toBe(55_000);
    vi.stubEnv("CRON_BUDGET_SECONDS", "abc"); expect(cronBudgetMs()).toBe(45_000);
    vi.stubEnv("CRON_CONCURRENCY", "50"); expect(cronConcurrency()).toBe(10);
    vi.stubEnv("FUNCTION_MAX_SECONDS", "1"); expect(functionMaxSeconds()).toBe(10);
  });
});
