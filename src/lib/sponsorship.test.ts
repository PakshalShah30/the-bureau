import { describe, expect, it } from "vitest";
import { statedSponsorship, resolveSponsorship, employerMatches, recentFilings, filingSummary, currentFiscalYear } from "./sponsorship";
import type { VisaFiling } from "./types";
const filing: VisaFiling = { id: "f1", externalKey: "k1", source: "DOL_LCA", sourceUrl: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  employerName: "Stripe, Inc.", employerNormalized: "stripe", fiscalYear: 2026, title: "Software Engineer", worksite: "New York, NY", wage: 145000, approvals: null, denials: null, isSample: false };
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
