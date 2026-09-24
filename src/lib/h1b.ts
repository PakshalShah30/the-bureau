import { normalizeEmployer, currentFiscalYear } from "./sponsorship";
import { hash } from "./urls";
import type { VisaFiling } from "./types";
const DOL = "https://www.dol.gov/agencies/eta/foreign-labor/performance";
const USCIS = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub";
export type Row = Record<string, string>;
export function clean(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return String((value as { text?: string }).text || "");
  return String(value).trim();
}
function normalized(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/^\uFEFF/, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""), clean(v)])) as Row;
}
function get(row: Row, ...keys: string[]) { return keys.map(k => row[k]).find(Boolean) || ""; }
function num(value: string) { const n = Number(value.replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : 0; }
function fiscalYear(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : currentFiscalYear(date);
}
function annualWage(raw: string, unit: string): number | null {
  const n = num(raw.split("-")[0]);
  const multiplier = /hour/i.test(unit) ? 2080 : /bi.?week/i.test(unit) ? 26 : /week/i.test(unit) ? 52 : /month/i.test(unit) ? 12 : /year/i.test(unit) ? 1 : 0;
  return n > 0 && multiplier ? Math.round(n * multiplier) : null;
}
export function lcaRow(raw: Row): VisaFiling | null {
  const row = normalized(raw);
  const name = get(row, "EMPLOYER_NAME", "EMPLOYER_NAME_1");
  const visa = get(row, "VISA_CLASS", "VISA_TYPE");
  const status = get(row, "CASE_STATUS", "STATUS");
  if (!name || !/^H-?1B$/i.test(visa) || !/^CERTIFIED/i.test(status)) return null;
  const year = Number(get(row, "FISCAL_YEAR", "FY")) || fiscalYear(get(row, "DECISION_DATE", "CASE_DECISION_DATE"));
  const caseNumber = get(row, "CASE_NUMBER", "CASE_NO", "CASE_NUMBER_1");
  if (!caseNumber || !year || year > currentFiscalYear() || year < currentFiscalYear() - 2) return null;
  const employerNormalized = normalizeEmployer(name);
  if (!employerNormalized) return null;
  return { id: crypto.randomUUID(), externalKey: hash(`DOL:${caseNumber}`), source: "DOL_LCA", sourceUrl: DOL,
    employerName: name, employerNormalized, fiscalYear: year,
    title: get(row, "JOB_TITLE", "JOB_TITLE_1") || null,
    worksite: [get(row, "WORKSITE_CITY", "WORKSITE_CITY_1"), get(row, "WORKSITE_STATE", "WORKSITE_STATE_1")].filter(Boolean).join(", ") || null,
    wage: annualWage(get(row, "WAGE_RATE_OF_PAY_FROM", "WAGE_RATE_OF_PAY_FROM_1", "WAGE_RATE_OF_PAY"), get(row, "WAGE_UNIT_OF_PAY", "WAGE_UNIT_OF_PAY_1")),
    approvals: null, denials: null };
}
export function uscisRow(raw: Row): VisaFiling | null {
  const row = normalized(raw);
  const name = get(row, "EMPLOYER", "EMPLOYER_NAME", "PETITIONER_NAME");
  const year = Number(get(row, "FISCAL_YEAR", "FY", "YEAR"));
  if (!name || !year || year > currentFiscalYear() || year < currentFiscalYear() - 2) return null;
  const employerNormalized = normalizeEmployer(name);
  if (!employerNormalized) return null;
  // USCIS uses several approval/denial categories. Counts are adjudications, NOT workers hired.
  const approvals = Object.entries(row).filter(([k]) => /APPROVALS?$/.test(k) && !/RATE|PERCENT/.test(k)).reduce((n, [, v]) => n + num(v), 0);
  const denials = Object.entries(row).filter(([k]) => /DENIALS?$/.test(k) && !/RATE|PERCENT/.test(k)).reduce((n, [, v]) => n + num(v), 0);
  if (!approvals && !denials) return null;
  const place = [get(row, "CITY"), get(row, "STATE")].filter(Boolean).join(", ");
  const identity = [year, employerNormalized, get(row, "TAX_ID", "TAX_ID_LAST_4"), get(row, "NAICS"), place, get(row, "ZIP", "ZIP_CODE")].join(":");
  return { id: crypto.randomUUID(), externalKey: hash(`USCIS:${identity}`), source: "USCIS", sourceUrl: USCIS,
    employerName: name, employerNormalized, fiscalYear: year, title: null,
    worksite: place || null, wage: null, approvals, denials };
}
