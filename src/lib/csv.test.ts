import { describe, expect, it } from "vitest";
import { applicationsCsv, csvCell } from "./csv";
import type { Application } from "./types";
const app: Application = { id: "a1", userId: "u", jobId: null, title: "QA Analyst, Payments", companyName: "Acme \"Pay\"", status: "APPLIED",
  appliedAt: "2026-09-20T10:00:00.000Z", followUpAt: null, resumeId: "r1", notes: "Line one\nline two", createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-21T00:00:00Z" };
describe("applications CSV", () => {
  it("quotes commas, quotes and newlines", () => {
    const csv = applicationsCsv([app], [{ id: "r1", name: "BA resume" } as never]);
    expect(csv.startsWith("﻿Company,Role,Status")).toBe(true);
    expect(csv).toContain('"Acme ""Pay""","QA Analyst, Payments",APPLIED,2026-09-20,,BA resume,,"Line one\nline two",2026-09-21');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("plain")).toBe("plain");
  });
});
