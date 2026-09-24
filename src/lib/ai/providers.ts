import type { Intensity } from "../types";
import { decrypt } from "../secrets";
import { assertPublicHost } from "../network";
import { builtInHumanize } from "./humanize";

export interface LLMProvider {
  completeJson<T>(system: string, user: string): Promise<T>;
}
class OpenAICompatibleLLM implements LLMProvider {
  async completeJson<T>(system: string, user: string): Promise<T> {
    if (!process.env.LLM_API_KEY) throw new Error("Set LLM_API_KEY to generate rewrite suggestions. ATS analysis works without it.");
    const base = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const url = new URL(`${base}/chat/completions`);
    if (url.protocol !== "https:") throw new Error("LLM endpoint must use HTTPS");
    const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(45000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({ model: process.env.LLM_MODEL || "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
    if (!res.ok) throw new Error(`LLM request failed (HTTP ${res.status})`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    if (!text) throw new Error("LLM returned no text");
    return JSON.parse(text) as T;
  }
}
export const llm: LLMProvider = new OpenAICompatibleLLM();

export interface HumanizerProvider {
  humanize(original: string, proposal: string, intensity: Intensity, keywords: string[]): Promise<string>;
}
export interface DetectorProvider {
  score(text: string): Promise<number>; // 0-100 heuristic/third-party estimate, NOT detection proof
}
export { builtInHumanize };
export const builtInHumanizer: HumanizerProvider = {
  async humanize(original, proposal, intensity, keywords) {
    const cleaned = builtInHumanize(proposal, { intensity, keepTerms: keywords });
    if (!process.env.LLM_API_KEY || intensity === "LIGHT") return cleaned;
    try {
      const answer = await llm.completeJson<{ text: string }>(
        "You are a careful resume editor. JSON only: {\"text\":\"...\"}. Rewrite ONLY the given bullet naturally. Vary structure, avoid generic AI phrasing, use concrete nouns and resume shorthand. Preserve every original fact, employer, title, number, date, tool and achievement. Do not add a skill. Keep all required ATS keywords when they are truthful. Strong intensity is concise and conversational, Medium is polished, Light is minimal. If uncertain, return the original bullet unchanged.",
        JSON.stringify({ original, proposal: cleaned, intensity, mustKeepKeywords: keywords })
      );
      return typeof answer.text === "string" && answer.text.trim() ? builtInHumanize(answer.text, { intensity, keepTerms: keywords }) : cleaned;
    } catch { return cleaned; } // built-in fallback on network/provider failure
  },
};
const DETECTOR_CLICHES = /\b(spearheaded|leveraged|leveraging|utilized|seamless(?:ly)?|dynamic|results-driven|passionate about|cutting-edge|robust|innovative|fast-paced|synerg\w*|orchestrated|meticulous(?:ly)?|pivotal|testament|delve[ds]?|state-of-the-art|best-in-class|world-class|fostered)\b/gi;
export const builtInDetector: DetectorProvider = {
  // Transparent writing-pattern heuristic (stock phrasing, repeated openers, uniform rhythm).
  async score(text) {
    if (!text.trim()) return 0;
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    const bullets = lines.filter(line => /^[-•*·▪◦]/.test(line)).map(b => b.replace(/^[-•*·▪◦]\s*/, ""));
    const sentences = (bullets.length ? bullets : text.split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(s => s.split(/\s+/).length > 2);
    const words = Math.max(1, text.split(/\s+/).length);
    const cliches = (text.match(DETECTOR_CLICHES) || []).length;
    const starts = sentences.map(b => b.split(/\s+/)[0].toLowerCase());
    const repeats = starts.length - new Set(starts).size;
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
    const spread = lengths.length >= 3 ? Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length) / Math.max(1, mean) : 1;
    const uniform = lengths.length >= 3 && spread < 0.18;
    const noSpecifics = sentences.length > 0 && !/\d/.test(text) && !/\b[A-Z][a-zA-Z]+[A-Z.]/.test(text);
    const density = Math.min(30, Math.round((cliches / words) * 400));
    return Math.max(0, Math.min(100, Math.round(12 + cliches * 10 + density + repeats * 12 + (uniform ? 14 : 0) + (noSpecifics ? 10 : 0))));
  },
};
/** Memoizes a detector for one request so repeated sections/lines are scored once. */
export function memoDetector(detector: DetectorProvider): DetectorProvider {
  const cache = new Map<string, Promise<number>>();
  return { score(text) { if (!cache.has(text)) cache.set(text, detector.score(text)); return cache.get(text)!; } };
}

function safeProviderUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !["", "443"].includes(url.port) || url.username || url.password) throw new Error("Provider URL must be a public HTTPS endpoint");
  return url.toString();
}
async function providerCall<T>(url: string, key: string, body: unknown) {
  const endpoint = safeProviderUrl(url);
  await assertPublicHost(new URL(endpoint).hostname);
  const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(12000),
    headers: { "content-type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}
export function humanizerFor(user: { humanizerKey: string | null; humanizerUrl?: string | null }): HumanizerProvider {
  const key = user.humanizerKey ? decrypt(user.humanizerKey) : process.env.HUMANIZER_API_KEY;
  const url = user.humanizerUrl || process.env.HUMANIZER_API_URL;
  if (!key || !url) return builtInHumanizer;
  return { async humanize(original, proposal, intensity, keywords) {
    try {
      const result = await providerCall<{ text: string }>(url, key, { original, text: proposal, intensity, protectedKeywords: keywords });
      return result.text ? builtInHumanize(result.text, { intensity, keepTerms: keywords }) : builtInHumanizer.humanize(original, proposal, intensity, keywords);
    } catch { return builtInHumanizer.humanize(original, proposal, intensity, keywords); }
  } };
}
export function detectorFor(user: { detectorKey: string | null; detectorUrl?: string | null }): DetectorProvider {
  const key = user.detectorKey ? decrypt(user.detectorKey) : process.env.DETECTOR_API_KEY;
  const url = user.detectorUrl || process.env.DETECTOR_API_URL;
  if (!key || !url) return builtInDetector;
  return { async score(text) {
    try {
      const result = await providerCall<{ score: number }>(url, key, { text });
      if (!Number.isFinite(result.score)) throw new Error("Invalid score");
      return Math.max(0, Math.min(100, Math.round(result.score)));
    } catch { return builtInDetector.score(text); }
  } };
}
