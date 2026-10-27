// Built-in AI-likelihood estimate and adapters for external detectors.
// The built-in score is a transparent combination of measurable writing signals. It is an
// ESTIMATE of how template-like text reads, not proof of authorship.

const STOCK = /\b(spearhead(?:ed|ing)?|leverag(?:e|ed|es|ing)|utiliz(?:e|ed|es|ing)|seamless(?:ly)?|dynamic|results-driven|passionate about|cutting-edge|robust|innovative|fast-paced|synerg\w*|orchestrat(?:e|ed|ing)|meticulous(?:ly)?|pivotal|testament|delv(?:e|ed|es|ing)|state-of-the-art|best-in-class|world-class|foster(?:ed|ing)?)\b/gi;
// Words that are fine in moderation but heavily over-used in generated professional prose.
const OVERUSED = /\b(ensur(?:e|ed|ing)|enhanc(?:e|ed|ing)|streamlin(?:e|ed|ing)|facilitat(?:e|ed|ing)|comprehensive|showcas(?:e|ed|ing)|navigat(?:e|ed|ing)|landscape|realm|elevat(?:e|ed|ing)|empower(?:ed|ing)?|holistic|crucial|vital|diverse|myriad|tapestry|key stakeholders|cross-functional|impactful|proactive(?:ly)?|strategic(?:ally)?)\b/gi;
// Participle tails stamped onto every bullet: "…, resulting in…", "…, ensuring…".
const TAIL = /,\s+(?:resulting in|ensuring|leading to|driving|enabling|improving|enhancing|contributing to|demonstrating|showcasing)\b/i;

export type WritingSignals = {
  words: number; units: number;
  stockPerHundred: number; overusedPerHundred: number;
  repeatedOpeners: number; repeatedTails: number;
  lengthVariation: number | null; lexicalDiversity: number; specificsPerUnit: number;
};
function units(text: string) {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => /^[-•*·▪◦]/.test(l)).map(b => b.replace(/^[-•*·▪◦]\s*/, ""));
  const prose = lines.filter(l => !/^[-•*·▪◦]/.test(l)).join(" ").split(/(?<=[.!?])\s+(?=[A-Z])/);
  return [...bullets, ...prose].map(s => s.trim()).filter(s => s.split(/\s+/).length > 3);
}
/** Moving-average type/token ratio over 40-word windows (stable for short and long texts). */
function diversity(words: string[]) {
  if (words.length < 8) return 1;
  const size = Math.min(40, words.length);
  let total = 0, windows = 0;
  for (let i = 0; i + size <= words.length; i += Math.max(1, Math.floor(size / 2))) { total += new Set(words.slice(i, i + size)).size / size; windows++; }
  return total / windows;
}
export function writingSignals(text: string): WritingSignals {
  const parts = units(text);
  const words = (text.toLowerCase().match(/[a-z][a-z'-]*/g) || []);
  const per100 = (n: number) => words.length ? (n / words.length) * 100 : 0;
  const openers = parts.map(p => p.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ""));
  const lengths = parts.map(p => p.split(/\s+/).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lengths.length));
  // Concrete details: numbers, metrics, dates, and product/tool names (CamelCase, acronyms, Capitalized mid-sentence).
  const specifics = parts.reduce((n, p) => n + (p.match(/\d[\d,.]*\s*(?:%|x|k|m|ms|hrs?|days?|users|customers)?|\$\d|\b[A-Z]{2,}\b|\b[A-Z][a-z]+[A-Z]\w*|(?<=\s)[A-Z][a-z]{2,}/g) || []).length, 0);
  return {
    words: words.length, units: parts.length,
    stockPerHundred: per100((text.match(STOCK) || []).length),
    overusedPerHundred: per100((text.match(OVERUSED) || []).length),
    repeatedOpeners: openers.length - new Set(openers).size,
    repeatedTails: Math.max(0, parts.filter(p => TAIL.test(p)).length - 1),
    lengthVariation: lengths.length >= 3 ? sd / Math.max(1, mean) : null,
    lexicalDiversity: diversity(words),
    specificsPerUnit: parts.length ? specifics / parts.length : 0,
  };
}
/** 0–100. Each signal adds a bounded amount so no single feature dominates. */
export function builtInScore(text: string) {
  if (!text.trim()) return 0;
  const s = writingSignals(text);
  if (s.words < 4) return 10;
  let score = 10;
  score += Math.min(30, s.stockPerHundred * 9);
  score += Math.min(15, s.overusedPerHundred * 5);
  score += Math.min(18, (s.repeatedOpeners / Math.max(1, s.units)) * 30);
  score += Math.min(14, s.repeatedTails * 7);
  if (s.lengthVariation != null) score += s.lengthVariation < 0.15 ? 12 : s.lengthVariation < 0.25 ? 6 : 0;
  if (s.words >= 40) score += s.lexicalDiversity < 0.62 ? 10 : s.lexicalDiversity < 0.7 ? 5 : 0;
  score -= Math.min(15, s.specificsPerUnit * 5);
  if (s.units > 0 && s.specificsPerUnit < 0.5) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------- External detector adapters ----------
export type DetectorAdapter = { id: string; label: string; url: string;
  request(text: string, key: string): { headers: Record<string, string>; body: unknown };
  parse(json: unknown): number };
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
export const DETECTOR_ADAPTERS: DetectorAdapter[] = [
  { id: "gptzero", label: "GPTZero", url: "https://api.gptzero.me/v2/predict/text",
    request: (text, key) => ({ headers: { "x-api-key": key }, body: { document: text } }),
    parse: json => {
      const doc = (json as { documents?: Array<{ class_probabilities?: { ai?: number }; completely_generated_prob?: number }> }).documents?.[0];
      const p = num(doc?.class_probabilities?.ai) ?? num(doc?.completely_generated_prob);
      if (p == null) throw new Error("Unexpected GPTZero response");
      return p * 100;
    } },
  { id: "sapling", label: "Sapling AI Detector", url: "https://api.sapling.ai/api/v1/aidetect",
    request: (text, key) => ({ headers: {}, body: { key, text } }),
    parse: json => { const p = num((json as { score?: number }).score); if (p == null) throw new Error("Unexpected Sapling response"); return p * 100; } },
];
/** The generic contract documented in the README: POST { text } with a Bearer key → { score: 0..100 }. */
export const GENERIC_ADAPTER: DetectorAdapter = { id: "custom", label: "Custom endpoint", url: "",
  request: (text, key) => ({ headers: { Authorization: `Bearer ${key}` }, body: { text } }),
  parse: json => { const p = num((json as { score?: number }).score); if (p == null) throw new Error("Invalid score"); return p; } };
export function adapterFor(url: string): DetectorAdapter {
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { /* invalid URL handled by caller */ }
  return DETECTOR_ADAPTERS.find(a => new URL(a.url).hostname === host) || GENERIC_ADAPTER;
}
