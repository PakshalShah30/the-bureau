import { afterEach, describe, expect, it, vi } from "vitest";
import { canonicalUrl, jobKey } from "../urls";
import { parseHnComment } from "./hn";
import { boardUrl, fetchBoard } from "./ats";
import { detectAtsInHtml, displayBatch, shortBatch, discoverYc, boardMatchesYcCompany } from "./yc";
describe("official source integrity", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps GH job ID when it is the ONLY job identifier", () => {
    expect(jobKey("https://stripe.com/jobs/search?gh_jid=123")).not.toBe(jobKey("https://stripe.com/jobs/search?gh_jid=456"));
    expect(canonicalUrl("https://job-boards.greenhouse.io/figma/jobs/123?gh_jid=123&utm_source=email")).toBe("https://job-boards.greenhouse.io/figma/jobs/123");
  });
  it("deduplicates Workable company-specific and short job links", () => {
    expect(jobKey("https://apply.workable.com/modash/j/C1507B65C3/?utm_source=hn")).toBe(jobKey("https://apply.workable.com/j/C1507B65C3"));
  });
  it("accepts only valid official ATS board slugs", () => {
    expect(boardUrl("ASHBY", "8090 Solutions Inc")).toBe("https://api.ashbyhq.com/posting-api/job-board/8090%20Solutions%20Inc");
    expect(() => boardUrl("GREENHOUSE", "../../localhost")).toThrow();
  });
  it("discovers ATS only from board URLs", () => {
    expect(detectAtsInHtml('<a href="https://jobs.ashbyhq.com/posthog/123">Careers</a>')).toMatchObject({ type: "ASHBY", slug: "posthog" });
    expect(detectAtsInHtml("Our jobs are at example.com/careers")).toBeNull();
    expect(displayBatch("W25")).toBe("Winter 2025"); expect(shortBatch("Summer 2021")).toBe("S21");
    expect(boardMatchesYcCompany({ name: "Legion Health", slug: "legion-health" }, "legionhealth")).toBe(true);
    expect(boardMatchesYcCompany({ name: "Legion Health", slug: "legion-health" }, "unrelatedpartner")).toBe(false);
  });
  it("queries YC's public directory directly using its embedded read-only key and real facets", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _options?: RequestInit) => String(url).includes("ycombinator.com/companies")
      ? new Response('<script>window.AlgoliaOpts = {"app":"45BWZJ1SGC","key":"public-test-key"};</script>')
      : Response.json({ nbHits: 64, hits: [
        { name: "Example", slug: "example", website: "https://example.com", batch: "Winter 2025", industry: "B2B", team_size: 20, status: "Active", isHiring: true },
        { name: "Inactive", slug: "inactive", batch: "Winter 2025", status: "Inactive", isHiring: true },
      ] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await discoverYc({ batch: "W25", industry: "B2B", maxSize: 50 });
    expect(result.companies).toMatchObject([{ name: "Example", batch: "W25", teamSize: 20 }]);
    expect(result.nextPage).toBe(1);
    const searchRequest = fetchMock.mock.calls.find(c => String(c[0]).includes("algolia.net"));
    const payload = JSON.parse(String(searchRequest?.[1]?.body));
    expect(payload.filters).toContain("batch:Winter 2025");
    expect(payload.filters).toContain("industries:B2B");
    expect(payload.numericFilters).toContain("team_size<=50");
  });
  it("parses only top-level HN comments with exact role-specific company apply URL", () => {
    const item = { id: 42, type: "comment", parent: 12, time: 1788274914, text: "Modash.io | Senior Product Engineer | REMOTE (Europe) | VISA: Yes<p>We are hiring. Apply: https://apply.workable.com/modash/j/C1507B65C3" };
    const job = parseHnComment(item, 12);
    expect(job).toMatchObject({ title: "Senior Product Engineer", companyName: "Modash", source: "HN_HIRING", workplace: "REMOTE", originalUrl: "https://apply.workable.com/modash/j/C1507B65C3", hnUrl: "https://news.ycombinator.com/item?id=42" });
    expect(parseHnComment({ ...item, parent: 88 }, 12)).toBeNull();
    expect(parseHnComment({ ...item, text: "Example | Engineer | Remote<p>Apply: https://www.linkedin.com/jobs/123456" }, 12)).toBeNull();
    expect(parseHnComment({ ...item, text: "Example | Engineer | Remote<p>Email us" }, 12)).toBeNull();
    expect(parseHnComment({ ...item, text: "Example | Engineer | Remote<p>https://jobs.ashbyhq.com/example" }, 12)).toBeNull();
    expect(parseHnComment({ ...item, text: "Example | Engineer | Remote<p>https://example.com/careers/software-engineer" }, 12)?.originalUrl).toBe("https://example.com/careers/software-engineer");
    expect(parseHnComment({ ...item, text: "Example | Engineer | Remote<p>https://randomjobboard.com/jobs/software-engineer" }, 12)).toBeNull();
  });
  it("reads full Workable descriptions from the company's own detailed board API", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL) => Response.json({ jobs: [{ shortcode: "C1507B65C3", title: "Senior Product Engineer", url: "https://apply.workable.com/j/C1507B65C3", description: "Visa Sponsorship: No. Build real products.", published_on: "2026-09-08", telecommuting: true }] }));
    vi.stubGlobal("fetch", fetchMock);
    const jobs = await fetchBoard("WORKABLE", "modash");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("?details=true");
    expect(jobs[0]).toMatchObject({ description: "Visa Sponsorship: No. Build real products.", workplace: "REMOTE", originalUrl: "https://apply.workable.com/j/C1507B65C3" });
  });
  it("fails rather than closing jobs if an ATS responds with a changed schema or partial list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "changed format" })));
    await expect(fetchBoard("WORKABLE", "modash")).rejects.toThrow("Workable board not found");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ jobs: [{ id: "123", title: "Engineer" }] })));
    await expect(fetchBoard("GREENHOUSE", "test")).rejects.toThrow("incomplete job records");
  });
  it("refuses aggregator, non-HTTPS, and non-company apply URLs from a board", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ jobs: [{ id: "123", title: "Engineer", jobUrl: "https://www.linkedin.com/jobs/12345678", isListed: true }] })));
    await expect(fetchBoard("ASHBY", "test")).rejects.toThrow("non-company application URL");
  });
});
