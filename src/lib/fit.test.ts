import { describe, expect, it } from "vitest";
import { rankByFit } from "./fit";
import type { Job } from "./types";
const base = { userId: "u", companyId: null, companyName: "Co", source: "COMPANY_BOARD", atsType: null, externalId: "x", originalUrl: "https://x.test/j",
  canonicalKey: "k", sourceUrl: null, hnUrl: null, department: null, location: null, workplace: "REMOTE", ycBatch: null, companySize: null,
  firstSeenAt: "2026-09-01T00:00:00Z", lastSeenAt: "2026-09-01T00:00:00Z", closedAt: null, sponsorship: "UNKNOWN", sponsorshipEvidence: null, evidenceSource: null } as const;
const job = (id: string, description: string, postedAt = "2026-09-10T00:00:00Z"): Job => ({ ...base, id, title: id, description, postedAt });
describe("rank jobs by resume fit", () => {
  const resume = "SKILLS\nSQL, Jira, Postman, UAT, Agile";
  const jobs = [job("frontend", "React, TypeScript, Next.js"), job("qa", "SQL, Jira, Postman and UAT experience"), job("vague", "Join our great team!"), job("ba", "SQL and Tableau required")];
  it("sorts best fit first and keeps unknowns last", () => {
    const ranked = rankByFit(jobs, resume);
    expect(ranked.map(j => j.id)).toEqual(["qa", "ba", "frontend", "vague"]);
    expect(ranked[0].fit).toMatchObject({ score: 100, matched: 4, total: 4 });
    expect(ranked[3].fit).toBeNull();
  });
  it("lists the missing required skills", () => {
    expect(rankByFit(jobs, resume).find(j => j.id === "ba")?.fit?.missingRequired).toEqual(["Tableau"]);
  });
  it("can filter by a minimum fit and keep newest-first order", () => {
    expect(rankByFit(jobs, resume, { minFit: 50 }).map(j => j.id)).toEqual(["qa", "ba"]);
    expect(rankByFit(jobs, resume, { sort: false }).map(j => j.id)).toEqual(jobs.map(j => j.id));
  });
});
