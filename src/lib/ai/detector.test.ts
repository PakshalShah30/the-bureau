import { describe, expect, it } from "vitest";
import { adapterFor, builtInScore, DETECTOR_ADAPTERS, writingSignals } from "./detector";
const templated = `• Spearheaded cross-functional initiatives, ensuring seamless delivery across teams.
• Leveraged innovative solutions to enhance stakeholder engagement, resulting in improved outcomes.
• Spearheaded comprehensive process improvements, ensuring robust and scalable operations.
• Leveraged dynamic strategies to streamline workflows, resulting in enhanced efficiency.`;
const concrete = `• Cut Postgres p95 latency from 900ms to 120ms by adding two partial indexes.
• Wrote the Airflow DAG that loads 40M Stripe events a day into Snowflake.
• On-call for payments; ran 14 incident reviews in 2025.
• Migrated 3 services from Heroku to AWS ECS with zero downtime.`;
describe("built-in AI-likelihood estimate", () => {
  it("separates template-like writing from concrete writing by a wide margin", () => {
    expect(builtInScore(templated)).toBeGreaterThanOrEqual(70);
    expect(builtInScore(concrete)).toBeLessThanOrEqual(20);
  });
  it("exposes the signals it uses", () => {
    const s = writingSignals(templated);
    expect(s.repeatedOpeners).toBe(2);
    expect(s.repeatedTails).toBeGreaterThanOrEqual(2);
    expect(s.stockPerHundred).toBeGreaterThan(5);
    expect(writingSignals(concrete).specificsPerUnit).toBeGreaterThan(2);
  });
  it("is stable for empty and tiny inputs", () => {
    expect(builtInScore("")).toBe(0);
    expect(builtInScore("Hi")).toBe(10);
  });
});
describe("external detector adapters", () => {
  it("picks the adapter from the endpoint host and parses each service's response", () => {
    const gptzero = adapterFor("https://api.gptzero.me/v2/predict/text");
    expect(gptzero.id).toBe("gptzero");
    expect(gptzero.request("abc", "k")).toEqual({ headers: { "x-api-key": "k" }, body: { document: "abc" } });
    expect(gptzero.parse({ documents: [{ class_probabilities: { ai: 0.42 } }] })).toBe(42);
    const sapling = adapterFor("https://api.sapling.ai/api/v1/aidetect");
    expect(sapling.request("abc", "k")).toEqual({ headers: {}, body: { key: "k", text: "abc" } });
    expect(sapling.parse({ score: 0.9 })).toBe(90);
    const custom = adapterFor("https://detector.example.com/score");
    expect(custom.id).toBe("custom");
    expect(custom.request("abc", "k").headers).toEqual({ Authorization: "Bearer k" });
    expect(custom.parse({ score: 55 })).toBe(55);
    expect(() => custom.parse({ nope: 1 })).toThrow();
    expect(DETECTOR_ADAPTERS.every(a => a.url.startsWith("https://"))).toBe(true);
  });
});
