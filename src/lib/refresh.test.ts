import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Company } from "./types";

const companies: Company[] = ["a", "b", "c", "d", "e", "f"].map((slug, i) => ({ id: slug, userId: "u", name: `Co ${slug}`, atsType: "GREENHOUSE", boardSlug: slug,
  careersUrl: null, website: null, ycBatch: null, ycUrl: null, industry: null, teamSize: null, employerOverride: null, active: true, createdAt: "",
  // "f" was never fetched, "a" most recently: stalest first means f, e, d, … are refreshed before a.
  lastFetchedAt: i === 5 ? null : `2026-10-0${9 - i}T00:00:00.000Z`, lastError: null }));
const fetched: string[] = [];
const recorded: Array<{ scope: string }> = [];
let clock = 0;
vi.mock("./store", () => ({ store: {
  acquireRefreshLock: async () => true, releaseRefreshLock: async () => undefined,
  listCompanies: async () => companies, filingsForCompany: async () => [],
  upsertJob: async () => ({ created: true }), closeMissing: async () => 0, updateCompany: async () => null,
  recordRun: async (_uid: string, run: { scope: string }) => { recorded.push(run); return { id: "r", userId: "u", ...run }; },
} }));
vi.mock("./sources/ats", () => ({
  fetchBoard: async (_type: string, slug: string) => { fetched.push(slug); clock += 10_000; return []; },
  postingToJob: () => ({}),
}));
const hn = vi.fn(async () => ({ id: 1, title: "t", url: "https://news.ycombinator.com/item?id=1", jobs: [], complete: true }));
vi.mock("./sources/hn", () => ({ fetchLatestHnThread: () => hn() }));
const { refreshUser } = await import("./refresh");

describe("refresh time budget", () => {
  beforeEach(() => { fetched.length = 0; recorded.length = 0; clock = 0; hn.mockClear(); vi.spyOn(Date, "now").mockImplementation(() => clock); });
  it("refreshes stalest boards first, stops at the deadline and records a partial run", async () => {
    // Boards run 3 at a time; each batch advances the fake clock by 30 s.
    const run = await refreshUser("u", { deadline: 20_000 });
    expect(fetched).toEqual(["f", "e", "d"]);
    expect(run.remaining).toBe(3);
    expect(run.hnSkipped).toBe(true);
    expect(hn).not.toHaveBeenCalled();
    expect(recorded[0].scope).toBe("partial");
    expect(run.errors).toEqual([]); // running out of time is not a source error
  });
  it("records a full run when everything fits", async () => {
    const run = await refreshUser("u", { deadline: 10_000_000 });
    expect(fetched).toHaveLength(6);
    expect(run.remaining).toBe(0);
    expect(hn).toHaveBeenCalledOnce();
    expect(recorded[0].scope).toBe("full");
  });
  it("skips HN when too little time is left for it", async () => {
    const run = await refreshUser("u", { deadline: 70_000 });
    expect(fetched).toHaveLength(6);
    expect(run.hnSkipped).toBe(true);
    expect(recorded[0].scope).toBe("partial");
  });
  it("keeps one-board refreshes out of the schedule", async () => {
    await refreshUser("u", { companyId: "c" });
    expect(fetched).toEqual(["c"]);
    expect(recorded[0].scope).toBe("company");
  });
});
