import { describe, expect, it } from "vitest";
import { atsScore, extractJobKeywords, factLock, validateFinalResume, formattingCheck, parseResume, reorderSkills, sameSkills, wordDiff, VERIFIED_HEADING } from "./ats";
import { builtInHumanize, varyOpeners } from "./humanize";
import { builtInDetector } from "./providers";
const original = "EXPERIENCE\nSenior Engineer | Northstar | 2022 – 2026\n• Built a React dashboard for 12,000 customers and reduced load time by 38%.\nSKILLS\nReact, PostgreSQL";
const resume = `ALEX MORGAN
San Francisco, CA | alex@example.com

SUMMARY
Results-driven product engineer passionate about building dynamic tools for growing teams with 6 years of experience.

EXPERIENCE
Senior Software Engineer | Northstar Labs | Jan 2022 – Present
• Built a React and TypeScript dashboard used by 12,000 customers; reduced page load time by 38%.
• Built PostgreSQL reporting queries and Node.js APIs for the analytics team.
• Built a Kafka consumer that successfully processed 2M events per day.

SKILLS
Languages: Python, TypeScript, SQL, Go

EDUCATION
B.S. Computer Science | University of Washington | 2019`;
const jd = `About the role
We're hiring a Data Platform Engineer to own our streaming data pipelines.

What you'll do
- Build and operate streaming data pipelines on Kafka and Flink
- Improve query performance for our analytics warehouse (Snowflake)
- Partner with product analytics on event tracking

Requirements
- 4+ years of experience with Python or Scala
- Experience with dbt, Airflow, and Terraform
- Strong grasp of streaming data pipelines and event tracking

Visa sponsorship is available. We offer equity and great benefits. Let's go!`;

describe("ATS keywords from the job description", () => {
  it("reports weighted matches and gaps without adding them", () => {
    expect(atsScore(original, "React, TypeScript and PostgreSQL required")).toMatchObject({ score: 65, missing: ["TypeScript"], matched: ["PostgreSQL", "React"] });
  });
  it("extracts tools and domain phrases beyond the curated list, ignoring benefits and visa wording", () => {
    const terms = extractJobKeywords(jd).map(k => k.term);
    expect(terms).toEqual(expect.arrayContaining(["Kafka", "Flink", "Snowflake", "Scala", "dbt", "Airflow", "Terraform", "Python"]));
    expect(terms.some(t => /streaming data pipeline/i.test(t))).toBe(true);
    expect(terms.some(t => /event tracking/i.test(t))).toBe(true);
    expect(terms.some(t => /visa|sponsor|equity|benefit/i.test(t))).toBe(false);
    expect(terms).not.toContain("Go"); // "Let's go!" is not the Go language
  });
  it("matches plural/singular phrase variants", () => {
    const score = atsScore("• Built streaming data pipeline for event tracking", jd);
    expect(score.matched).toEqual(expect.arrayContaining(["event tracking"]));
    expect(score.matched.some(t => /streaming data pipeline/i.test(t))).toBe(true);
  });
});

describe("resume structure", () => {
  it("classifies header, summary, bullets, fixed role lines and skills", () => {
    const kinds = Object.fromEntries(parseResume(resume).filter(l => l.kind !== "blank").map(l => [l.text.slice(0, 20), `${l.section}:${l.kind}`]));
    expect(kinds["ALEX MORGAN"]).toBe("Header:fixed");
    expect(kinds["Results-driven produ"]).toBe("SUMMARY:summary");
    expect(kinds["Senior Software Engi"]).toBe("EXPERIENCE:fixed");
    expect(kinds["• Built a React and "]).toBe("EXPERIENCE:bullet");
    expect(kinds["Languages: Python, T"]).toBe("SKILLS:skills");
    expect(kinds["B.S. Computer Scienc"]).toBe("EDUCATION:fixed");
  });
  it("reorders skills without adding or removing any", () => {
    const line = "Languages: Python, TypeScript, SQL, Go";
    const next = reorderSkills(line, ["TypeScript", "SQL"]);
    expect(next).toBe("Languages: TypeScript, SQL, Python, Go");
    expect(sameSkills(line, next)).toBe(true);
    expect(sameSkills(line, "Languages: TypeScript, SQL, Python, Rust")).toBe(false);
  });
  it("renders a word diff", () => {
    expect(wordDiff("Built a tool", "Developed a tool")).toEqual([{ type: "del", text: "Built" }, { type: "add", text: "Developed" }, { type: "same", text: " a tool" }]);
  });
});

describe("fact lock", () => {
  it("blocks changed metrics, direction, and new skills", () => {
    const bullet = original.split("\n")[2];
    expect(factLock(bullet, bullet.replace("38%", "58%"), original).safe).toBe(false);
    expect(factLock(bullet, bullet.replace("reduced", "increased"), original).safe).toBe(false);
    expect(factLock(bullet, bullet + " Also used Kubernetes.", original).safe).toBe(false);
    expect(factLock(bullet, bullet.replace("React", "React and Flink"), original, [], ["Flink"]).safe).toBe(false);
    expect(factLock(bullet, bullet, original).safe).toBe(true);
  });
  it("treats same-meaning verbs as style, not a new claim", () => {
    const bullet = original.split("\n")[2];
    expect(factLock(bullet, bullet.replace("Built", "Developed").replace("reduced", "cut"), original).safe).toBe(true);
    expect(factLock(bullet, bullet.replace("Built", "Maintained"), original).safe).toBe(false);
  });
  it("allows bullet, summary and skill-order edits but nothing else on export", () => {
    expect(validateFinalResume(original, original.replace("Northstar", "Acme")).safe).toBe(false);
    expect(validateFinalResume(original, original).safe).toBe(true);
    expect(validateFinalResume(original, original.replace("React, PostgreSQL", "PostgreSQL, React")).safe).toBe(true);
    expect(validateFinalResume(original, original.replace("React, PostgreSQL", "PostgreSQL, React, Go")).safe).toBe(false);
    expect(validateFinalResume(resume, resume.replace("Results-driven product engineer passionate about building dynamic tools", "Product engineer focused on building tools")).safe).toBe(true);
    expect(validateFinalResume(original, `${original}\n\n${VERIFIED_HEADING}\nTypeScript`, ["TypeScript"]).safe).toBe(true);
  });
  it("flags missing headings in formatting check", () => {
    expect(formattingCheck({ content: "Hello\nWorld", filename: "cv.pdf", mimeType: "application/pdf" }).checks[0].passed).toBe(false);
  });
});

describe("built-in humanizer", () => {
  const lines = parseResume(resume);
  it("removes stock AI phrasing while keeping every fact", () => {
    const summary = lines.find(l => l.kind === "summary")!.text;
    const out = builtInHumanize(summary, { intensity: "MEDIUM" });
    expect(out).not.toMatch(/results-driven|passionate about|dynamic/i);
    expect(builtInHumanize("• Leveraging Python and leveraged dbt to utilize Snowflake")).toBe("• Using Python and used dbt to use Snowflake");
    expect(factLock(summary, out, resume).safe).toBe(true);
  });
  it("varies repeated bullet openers with synonyms that pass the fact lock", () => {
    const bullets = lines.filter(l => l.kind === "bullet").map(l => l.text);
    const out = varyOpeners(bullets, "MEDIUM");
    expect(new Set(out.map(b => b.split(" ")[1])).size).toBe(3);
    out.forEach((b, i) => expect(factLock(bullets[i], b, resume).safe).toBe(true));
    expect(out[2]).not.toMatch(/successfully/);
    expect(varyOpeners(bullets, "LIGHT")).toEqual(bullets);
  });
  it("uses resume shorthand at strong intensity and never drops a protected keyword", () => {
    expect(builtInHumanize("• Was responsible for cutting costs by approximately 20 percent", { intensity: "STRONG" })).toBe("• Cutting costs by ~20%");
    expect(builtInHumanize("• Built a robust pipeline", { keepTerms: ["robust"] })).toBe("• Built a robust pipeline");
  });
  it("scores stock phrasing higher than concrete writing", async () => {
    expect(await builtInDetector.score("Results-driven, passionate about leveraging cutting-edge synergy seamlessly.")).toBeGreaterThan(
      await builtInDetector.score("Cut Postgres p95 latency from 900ms to 120ms by adding two partial indexes."));
  });
});
