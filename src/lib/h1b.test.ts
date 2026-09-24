import { describe, expect, it } from "vitest";
import { lcaRow, uscisRow } from "./h1b";
describe("government import field mapping", () => {
  it("keeps only certified H-1B DOL cases, converts wage to annual USD", () => {
    const row = { CASE_NUMBER: "I-200-26001-123456", VISA_CLASS: "H-1B", CASE_STATUS: "CERTIFIED", EMPLOYER_NAME: "Stripe Inc.", JOB_TITLE: "Software Engineer", DECISION_DATE: "2026-04-01", WAGE_RATE_OF_PAY_FROM: "70.00", WAGE_UNIT_OF_PAY: "Hour", WORKSITE_CITY: "New York", WORKSITE_STATE: "NY" };
    expect(lcaRow(row)).toMatchObject({ fiscalYear: 2026, employerNormalized: "stripe", title: "Software Engineer", wage: 145600 });
    expect(lcaRow({ ...row, VISA_CLASS: "E-3" })).toBeNull();
    expect(lcaRow({ ...row, CASE_STATUS: "DENIED" })).toBeNull();
  });
  it("sums USCIS adjudications without inventing wages or titles", () => {
    expect(uscisRow({ "Fiscal Year": "2026", Employer: "Stripe Inc.", "New Employment Approval": "3", "Continuing Approval": "2", "New Employment Denial": "1", State: "CA" })).toMatchObject({ fiscalYear: 2026, approvals: 5, denials: 1, wage: null, title: null });
  });
});
