import { describe, expect, it } from "vitest";
import { atsScore, factLock, validateFinalResume, formattingCheck } from "./ats";
const original = "EXPERIENCE\nSenior Engineer | Northstar | 2022 – 2026\n• Built a React dashboard for 12,000 customers and reduced load time by 38%.\nSKILLS\nReact, PostgreSQL";
describe("resume safeguards", () => {
  it("reports real matches and gaps without adding them", () => {
    expect(atsScore(original, "React, TypeScript and PostgreSQL required")).toMatchObject({ score: 67, missing: ["TypeScript"] });
  });
  it("blocks changed metrics, actions and new skills", () => {
    const bullet = original.split("\n")[2];
    expect(factLock(bullet, bullet.replace("38%", "58%"), original).safe).toBe(false);
    expect(factLock(bullet, bullet.replace("reduced", "increased"), original).safe).toBe(false);
    expect(factLock(bullet, bullet + " Also used Kubernetes.", original).safe).toBe(false);
    expect(factLock(bullet, bullet, original).safe).toBe(true);
  });
  it("prevents changing job history outside bullets or dropping sections on export", () => {
    expect(validateFinalResume(original, original.replace("Northstar", "Acme")).safe).toBe(false);
    expect(validateFinalResume(original, original).safe).toBe(true);
    expect(validateFinalResume(original, original + "\n\nVERIFIED ADDITIONAL SKILLS\nTypeScript", ["TypeScript"]).safe).toBe(true);
  });
  it("flags missing headings in formatting check", () => {
    expect(formattingCheck({ content: "Hello\nWorld", filename: "cv.pdf", mimeType: "application/pdf" }).checks[0].passed).toBe(false);
  });
});
