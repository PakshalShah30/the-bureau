import { describe, expect, it } from "vitest";
import { mergedSponsorship, normalizeTitle, pickSameRole, sameTitle } from "./dedupe";
import { sampleFilings } from "./h1b-sample";
import { resolveSponsorship, filingSummary, recentFilings } from "./sponsorship";
const job = (companyName: string, title: string, location: string | null = null) => ({ companyName, title, location });
describe("cross-source dedupe", () => {
  it("normalizes titles and accepts location-only suffixes", () => {
    expect(normalizeTitle("Sr. Software Eng (Remote, EU)")).toBe("senior software engineer");
    expect(sameTitle(job("Orpex", "Founding Engineer (m/w/d) - Vienna", "Vienna"), job("Orpex", "Founding Engineer"))).toBe(true);
    expect(sameTitle(job("A", "Software Engineer - Payments"), job("A", "Software Engineer"))).toBe(false);
  });
  it("merges an HN post into the single matching board job, ignoring legal suffixes", () => {
    const board = [job("Modash", "Senior Product Engineer", "Remote (Europe)"), job("Modash", "Senior Product Data Engineer", "Tallinn")];
    expect(pickSameRole(job("Modash, Inc.", "Senior Product Engineer", "REMOTE (Europe)"), board)).toBe(board[0]);
  });
  it("never guesses when several postings share a title", () => {
    const board = [job("Stripe", "Software Engineer", "Seattle"), job("Stripe", "Software Engineer", "New York")];
    expect(pickSameRole(job("Stripe", "Software Engineer"), board)).toBeNull();
    expect(pickSameRole(job("Stripe", "Software Engineer", "Seattle, WA"), board)).toBe(board[0]);
    expect(pickSameRole(job("Other Co", "Software Engineer", "Seattle"), board)).toBeNull();
  });
  it("keeps a policy stated in the HN post when the board posting is silent", () => {
    const hn = { sponsorship: "SPONSORS_STATED", sponsorshipEvidence: "VISA: Yes", evidenceSource: "Job description" };
    expect(mergedSponsorship({ sponsorship: "LIKELY_HISTORY", sponsorshipEvidence: null, evidenceSource: "DOL / USCIS employer history" }, hn))
      .toMatchObject({ sponsorship: "SPONSORS_STATED", sponsorshipEvidence: "VISA: Yes", evidenceSource: "HN Who is Hiring post" });
    expect(mergedSponsorship({ sponsorship: "NO_SPONSORSHIP_STATED", sponsorshipEvidence: "x", evidenceSource: "Job description" }, hn)).toBeNull();
  });
});
describe("illustrative sample filings", () => {
  it("drive the history badge but are always labelled as samples", () => {
    const rows = sampleFilings(new Date("2026-09-24"));
    expect(rows.every(r => r.isSample && r.externalKey.startsWith("SAMPLE:"))).toBe(true);
    expect(resolveSponsorship("Build payments APIs.", rows, "Stripe")).toMatchObject({ status: "LIKELY_HISTORY", evidenceSource: "Illustrative sample filings (not government data)" });
    expect(resolveSponsorship("We do not provide visa sponsorship.", rows, "Stripe").status).toBe("NO_SPONSORSHIP_STATED");
    expect(resolveSponsorship("Build things.", rows, "PostHog").status).toBe("UNKNOWN");
    expect(filingSummary(recentFilings(rows, "Stripe", null, new Date("2026-09-24"))).sample).toBe(true);
  });
});
