import type { Intensity } from "../types";
import { decrypt } from "../secrets";
import { assertPublicHost } from "../network";

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
export function builtInHumanize(text: string) {
  return text.replace(/\bspearheaded\b/gi, "Led").replace(/\bleveraged\b/gi, "used")
    .replace(/\butilized\b/gi, "used").replace(/\bseamlessly\s+/gi, "")
    .replace(/\bdynamic\s+/gi, "").replace(/\bresults-driven\s+/gi, "")
    .replace(/\bpassionate about\b/gi, "focused on").replace(/\s{2,}/g, " ").trim();
}
export const builtInHumanizer: HumanizerProvider = {
  async humanize(original, proposal, intensity, keywords) {
    const cleaned = builtInHumanize(proposal);
    if (!process.env.LLM_API_KEY || intensity === "LIGHT") return cleaned;
    try {
      const answer = await llm.completeJson<{ text: string }>(
        "You are a careful resume editor. JSON only: {\"text\":\"...\"}. Rewrite ONLY the given bullet naturally. Vary structure, avoid generic AI phrasing, use concrete nouns and resume shorthand. Preserve every original fact, employer, title, number, date, tool and achievement. Do not add a skill. Keep all required ATS keywords when they are truthful. Strong intensity is concise and conversational, Medium is polished, Light is minimal. If uncertain, return the original bullet unchanged.",
        JSON.stringify({ original, proposal: cleaned, intensity, mustKeepKeywords: keywords })
      );
      return typeof answer.text === "string" ? builtInHumanize(answer.text) : cleaned;
    } catch { return cleaned; } // built-in fallback on network/provider failure
  },
};
export const builtInDetector: DetectorProvider = {
  async score(text) {
    if (!text.trim()) return 0;
    const bullets = text.split(/\n/).filter(line => /^\s*[-•*]/.test(line));
    const cliches = (text.match(/\b(spearheaded|leveraged|seamlessly|dynamic|results-driven|passionate about|cutting-edge|robust|innovative|fast-paced)\b/gi) || []).length;
    const sameStart = bullets.map(b => b.replace(/^\s*[-•*]\s*/, "").split(" ")[0].toLowerCase());
    const repeats = sameStart.length - new Set(sameStart).size;
    const uniform = bullets.length >= 3 && Math.max(...bullets.map(b => b.length)) - Math.min(...bullets.map(b => b.length)) < 25;
    return Math.min(100, Math.round(18 + cliches * 15 + repeats * 12 + (uniform ? 12 : 0)));
  },
};

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
      return result.text ? builtInHumanize(result.text) : builtInHumanizer.humanize(original, proposal, intensity, keywords);
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
