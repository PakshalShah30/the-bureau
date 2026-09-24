import { describe, expect, it } from "vitest";
import { statedSponsorship, resolveSponsorship, hasSponsorHistory, employerMatches, recentFilings, filingSummary, currentFiscalYear } from "./sponsorship";
import type { VisaFiling } from "./types";
const filing: VisaFiling = { id: "f1", externalKey: "k1", source: "DOL_LCA", sourceUrl: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  employerName: "Stripe, Inc.", employerNormalized: "stripe", fiscalYear: 2026, title: "Software Engineer", worksite: "New York, NY", wage: 145000, approvals: null, denials: null };
describe("sponsorship hierarchy", () => {
  it("recognizes exact positive statement and preserves evidence", () => {
    expect(statedSponsorship("Other things. San Francisco in person - Visa sponsorship possible.")).toMatchObject({ status: "SPONSORS_STATED", evidence: "San Francisco in person - Visa sponsorship possible." });
    expect(statedSponsorship("US Visa Sponsorship: Yes.").status).toBe("SPONSORS_STATED");
    expect(statedSponsorship("VISA: Yes | REMOTE").status).toBe("SPONSORS_STATED");
  });
  it("handles negations, abbreviations and US citizens only", () => {
    expect(statedSponsorship("Visa Sponsorship: Please note that we are not currently able to offer U.S. visa sponsorship or transfer for this position.").status).toBe("NO_SPONSORSHIP_STATED");
    expect(statedSponsorship("We do not provide new work visa sponsorship. H-1B transfers accepted.").status).toBe("NO_SPONSORSHIP_STATED");
    expect(statedSponsorship("VISA: No | REMOTE").status).toBe("NO_SPONSORSHIP_STATED");
    expect(statedSponsorship("We don't offer visa sponsorship for this job.").status).toBe("NO_SPONSORSHIP_STATED");
    expect(statedSponsorship("Only U.S. citizens may apply. No visa sponsorship available.").status).toBe("NO_SPONSORSHIP_STATED");
  });
  it("recognizes common real-world phrasings, including plural 'visas'", () => {
    const no = ["We are unable to sponsor visas at this time.", "Candidates must be authorized to work in the US. We do not sponsor.",
      "This role is not eligible for visa sponsorship.", "We cannot sponsor H-1B visas for this position.",
      "Applicants must be able to work without the need for visa sponsorship.", "We are not able to sponsor candidates at this time.",
      "Unfortunately we're not open to sponsoring for this role."];
    for (const text of no) expect(statedSponsorship(text).status, text).toBe("NO_SPONSORSHIP_STATED");
    const yes = ["We offer H-1B sponsorship for qualified candidates.", "We sponsor visas.", "The company will sponsor work visas where needed.",
      "We're happy to sponsor the right candidate."];
    for (const text of yes) expect(statedSponsorship(text).status, text).toBe("SPONSORS_STATED");
  });
  it("does not read unrelated 'sponsor' wording as a visa policy", () => {
    for (const text of ["We sponsor hackathons and local meetups.", "We do not sponsor events for competitors.", "Our sponsorship of open source is a point of pride."])
      expect(statedSponsorship(text).status, text).toBe("UNKNOWN");
  });
  it("never counts a denials-only employer as a likely sponsor", () => {
    const denials = [{ ...filing, source: "USCIS" as const, approvals: 0, denials: 4 }];
    expect(hasSponsorHistory(denials)).toBe(false);
    expect(hasSponsorHistory([...denials, { ...filing, source: "USCIS" as const, approvals: 1, denials: 0 }])).toBe(true);
    expect(hasSponsorHistory([filing])).toBe(true);
  });
  it("never turns no history into no sponsorship and always prioritizes a statement", () => {
    expect(resolveSponsorship("Build products.", [], "Stripe").status).toBe("UNKNOWN");
    expect(resolveSponsorship("Build products.", [filing], "Stripe").status).toBe("LIKELY_HISTORY");
    expect(resolveSponsorship("No visa sponsorship.", [filing], "Stripe").status).toBe("NO_SPONSORSHIP_STATED");
    expect(resolveSponsorship("Build products.", [{ ...filing, source: "USCIS", approvals: 0, denials: 4 }], "Stripe").status).toBe("UNKNOWN");
  });
  it("requires strong employer match or exact manual override", () => {
    expect(employerMatches("Stripe", "Stripe, Inc.")).toBe(true);
    expect(employerMatches("Stripe", "Stripe Payments LLC")).toBe(false);
    expect(employerMatches("Some Brand", "ACME Holdings", "ACME Holdings")).toBe(true);
    expect(recentFilings([filing], "Stripe", null, new Date("2026-09-23")).length).toBe(1);
    expect(recentFilings([{ ...filing, fiscalYear: 2022 }], "Stripe", null, new Date("2026-09-23")).length).toBe(0);
    expect(currentFiscalYear(new Date("2026-10-01T00:00:00Z"))).toBe(2027);
    expect(recentFilings([{ ...filing, fiscalYear: 2027 }], "Stripe", null, new Date("2026-10-01")).length).toBe(1);
  });
  it("computes median from DOL annual wage, not USCIS counts", () => {
    expect(filingSummary([filing, { ...filing, id: "f2", wage: 155000 }]).medianWage).toBe(150000);
  });
});
