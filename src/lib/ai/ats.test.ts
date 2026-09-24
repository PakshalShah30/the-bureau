import { describe, expect, it } from "vitest";
import { atsScore, factLock, validateFinalResume, formattingCheck, keywords, splitRequirements } from "./ats";
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
  it("does not read everyday English as a skill", () => {
    expect(keywords("Own our go-to-market motion and help the rest of the team. Go to the office twice a week.")).not.toContain("Go");
    expect(keywords("Own our go-to-market motion and help the rest of the team.")).not.toContain("REST");
    expect(keywords("Services in Go and Golang; RESTful APIs")).toEqual(expect.arrayContaining(["Go", "REST", "API"]));
    expect(keywords("Deep JavaScript knowledge")).not.toContain("Java");
  });
  it("understands common aliases", () => {
    expect(keywords("Postgres, k8s, JS, ReactJS, Amazon Web Services, NodeJS")).toEqual(
      expect.arrayContaining(["PostgreSQL", "Kubernetes", "JavaScript", "React", "AWS", "Node.js"]));
    expect(keywords("Wrote user stories and acceptance criteria; ran UAT in Jira; API testing with Postman")).toEqual(
      expect.arrayContaining(["user stories", "UAT", "Jira", "API testing", "Postman"]));
  });
  it("weights nice-to-have skills at half", () => {
    const jd = "Requirements\n- SQL and Jira\nNice to have\n- Python\n- Tableau";
    expect(splitRequirements(jd).preferred).toContain("Python");
    const r = atsScore("SQL, Jira", jd);
    expect(r.required).toEqual(["SQL", "Jira"]);
    expect(r.preferred).toEqual(["Python", "Tableau"]);
    expect(r.score).toBe(67);               // 2 of (1 + 1 + 0.5 + 0.5)
    expect(r.missingRequired).toEqual([]);
    expect(atsScore("SQL", "Must have SQL. Kubernetes is a plus.").missingRequired).toEqual([]);
  });
  it("gives the real reason when a verb is swapped, not a fake date or name change", () => {
    const res = factLock("- Decreased churn 12% by redesigning onboarding", "- Cut churn 12% by redesigning onboarding", "x");
    expect(res.safe).toBe(false);
    expect(res.reasons).toEqual(["Achievement action changed or removed: decreased."]);
    expect(factLock("- Led marketing launch in March 2024", "- Led the marketing launch in March 2024", "x").safe).toBe(true);
    expect(factLock("- Led marketing launch in March 2024", "- Led the marketing launch in May 2024", "x").safe).toBe(false);
    expect(factLock("- Partnered with Stripe on payouts", "- Partnered on payouts", "x").reasons.join(" ")).toMatch(/named entity/);
  });
});
