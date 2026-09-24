import type { VisaFiling } from "./types";
import { currentFiscalYear, normalizeEmployer } from "./sponsorship";

/**
 * ILLUSTRATIVE SAMPLE — NOT GOVERNMENT DATA.
 * A handful of rows so the "Likely sponsors · history" badge and the filing panel can be seen
 * on first load. Every row carries isSample=true and the UI labels it as a sample. Running
 * `npm run h1b:import` with official DOL/USCIS files deletes all sample rows. The numbers are
 * placeholders chosen for display only; do not rely on them for any decision.
 */
const SAMPLE: Array<{ employer: string; titles: Array<[string, string, number]>; approvals: number; denials: number }> = [
  { employer: "Stripe, Inc.", titles: [["Software Engineer", "South San Francisco, CA", 185000], ["Software Engineer", "Seattle, WA", 178000], ["Data Scientist", "New York, NY", 172000]], approvals: 40, denials: 1 },
  { employer: "Figma, Inc.", titles: [["Software Engineer", "San Francisco, CA", 180000], ["Product Designer", "New York, NY", 160000]], approvals: 12, denials: 0 },
  { employer: "Airbyte, Inc.", titles: [["Software Engineer", "San Francisco, CA", 165000]], approvals: 2, denials: 0 },
];
const DOL = "https://www.dol.gov/agencies/eta/foreign-labor/performance";
const USCIS = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub";
export function sampleFilings(now = new Date()): VisaFiling[] {
  const fy = currentFiscalYear(now);
  const rows: VisaFiling[] = [];
  for (const s of SAMPLE) {
    const employerNormalized = normalizeEmployer(s.employer);
    s.titles.forEach(([title, worksite, wage], i) => {
      const year = fy - (i % 2);
      rows.push({ id: `sample-lca-${employerNormalized}-${i}`, externalKey: `SAMPLE:LCA:${employerNormalized}:${i}`, source: "DOL_LCA", sourceUrl: DOL,
        employerName: s.employer, employerNormalized, fiscalYear: year, title, worksite, wage, approvals: null, denials: null, isSample: true });
    });
    rows.push({ id: `sample-uscis-${employerNormalized}`, externalKey: `SAMPLE:USCIS:${employerNormalized}:${fy - 1}`, source: "USCIS", sourceUrl: USCIS,
      employerName: s.employer, employerNormalized, fiscalYear: fy - 1, title: null, worksite: null, wage: null, approvals: s.approvals, denials: s.denials, isSample: true });
  }
  return rows;
}
