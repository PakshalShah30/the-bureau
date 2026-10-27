import { describe, expect, it } from "vitest";
import { discoverLinks, fileNameFor, isOfficial } from "./h1b-fetch";
const page = "https://www.dol.gov/agencies/eta/foreign-labor/performance";
const html = ["FY2023_Q4", "FY2024_Q1", "FY2024_Q4", "FY2025_Q2", "FY2026_Q1", "FY2026_Q3"]
  .map(q => `<a href="/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_${q}.xlsx">LCA ${q}</a>`).join("\n")
  + `<a href="https://evil.example.com/LCA_Disclosure_Data_FY2027_Q1.xlsx">mirror</a>
     <a href="/sites/dolgov/files/ETA/oflc/pdfs/PERM_Disclosure_Data_FY2026_Q3.xlsx">PERM</a>`;
describe("official H-1B file discovery", () => {
  it("keeps the newest quarters for the last N fiscal years from official hosts only", () => {
    const links = discoverLinks(html, page, "LCA_Disclosure_Data_FY(20\\d{2})_Q([1-4])\\.xlsx", 3, 12);
    expect(links.map(l => `FY${l.fiscalYear}Q${l.quarter}`)).toEqual(["FY2026Q3", "FY2026Q1", "FY2025Q2", "FY2024Q4", "FY2024Q1"]);
    expect(links[0].url).toBe("https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Disclosure_Data_FY2026_Q3.xlsx");
    expect(discoverLinks(html, page, "LCA_Disclosure_Data_FY(20\\d{2})_Q([1-4])\\.xlsx", 3, 2)).toHaveLength(2);
  });
  it("matches USCIS-style csv links and rejects non-government URLs", () => {
    const uscis = `<a href="/sites/default/files/document/data/h1b_datahubexport-2024.csv">FY2024</a><a href="/sites/default/files/document/data/Employer%20Information%202025.csv">FY2025</a>`;
    const links = discoverLinks(uscis, "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub", "[^\"'<>\\s]*(20\\d{2})[^\"'<>\\s]*\\.csv", 3, 3);
    expect(links.map(l => l.fiscalYear)).toEqual([2025, 2024]);
    expect(fileNameFor(links[0].url)).toBe("Employer_Information_2025.csv");
    expect(isOfficial("https://www.uscis.gov/x.csv")).toBe(true);
    expect(isOfficial("http://www.dol.gov/x.xlsx")).toBe(false);
    expect(isOfficial("https://dol.gov.evil.com/x.xlsx")).toBe(false);
  });
});
