import type { Sponsorship, VisaFiling } from "./types";

export type SponsorshipSignal = { status: Sponsorship; evidence: string | null; evidenceSource: string | null };
// Splitting on paragraphs/newlines preserves the exact evidence sentence, not a paraphrase.
export function sentences(text: string) {
  return text.replace(/\r/g, "").split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
}
// Visa words, singular or plural ("visa", "visas", "H-1B", "H1-B").
const VISA = String.raw`(?:visas?|work\s+visas?|h[\s-]?1[\s-]?b|immigration)`;
const NOT = String.raw`(?:cannot|can't|can\s+not|do\s+not|don't|does\s+not|doesn't|unable\s+to|(?:are|is)\s+not\s+(?:currently\s+)?(?:able|in\s+a\s+position)\s+to|not\s+(?:currently\s+)?able\s+to|won't|will\s+not|are\s+not|is\s+not)`;
const negative = new RegExp(String.raw`\b(?:no\s+(?:new\s+)?${VISA}\s+sponsorship|(?:${VISA}|work\s+authorization)\s+sponsorship\s+(?:is\s+)?(?:not|unavailable)|${NOT}\s+(?:currently\s+)?(?:provide|offer|support|sponsor|consider)s?\b.{0,40}?(?:${VISA}|sponsorship)|${NOT}\s+(?:currently\s+)?sponsor(?:ing)?(?:\s+(?:candidates|applicants|employees|anyone|for\s+this\s+(?:role|position)|at\s+this\s+time))*\s*(?:[.,;!)]|$)|not\s+(?:open|willing)\s+to\s+sponsor(?:ing)?|not\s+eligible\s+for\s+(?:${VISA}\s+)?sponsorship|without\s+(?:the\s+need\s+for\s+)?(?:current\s+or\s+future\s+)?(?:requiring\s+)?(?:employer\s+|visa\s+)?sponsorship|(?:us|u\.s\.)\s+citizens?\s+only|(?:us|u\.s\.)\s+citizens?\s+(?:and|or|\/|,)\s+(?:permanent\s+residents?|green\s+card\s+holders?)\s+only|must\s+(?:be\s+)?(?:currently\s+)?authorized\s+to\s+work\s+.{0,40}without\s+sponsorship|sponsorship\s+(?:is\s+)?not\s+(?:available|offered|provided|possible)|(?:${VISA})\s+sponsorship\s*:\s*(?:no|none)|VISA\s*:\s*(?:no|none|not\s+available))(?![a-z])`, "i");
const positive = new RegExp(String.raw`\b(?:${VISA}\s+sponsorship\s+(?:is\s+)?(?:available|provided|offered|possible|covered|supported|übernehmen|uebernehmen)|(?:we|this\s+role|the\s+company|company|employer)\s+(?:will\s+|can\s+|do\s+|does\s+|may\s+|are\s+able\s+to\s+|is\s+able\s+to\s+)?(?:provide|offer|support|sponsor)s?\s+.{0,35}?(?:${VISA})|(?:open|happy|willing|able)\s+to\s+sponsor(?:ing)?\b|(?:relocation\s+and\s+)?visa\s+sponsorship\s+(?:covered|possible)|(?:${VISA})\s+sponsorship\s*:\s*(?:yes|available|possible)|VISA\s*:\s*(?:yes|available|sponsorship))(?![a-z])`, "i");
export function statedSponsorship(description: string): SponsorshipSignal {
  const parts = sentences(description);
  // A negative in the same sentence takes precedence over a positive token.
  const no = parts.find(s => negative.test(s));
  if (no) return { status: "NO_SPONSORSHIP_STATED", evidence: no, evidenceSource: "Job description" };
  const yes = parts.find(s => positive.test(s));
  if (yes) return { status: "SPONSORS_STATED", evidence: yes, evidenceSource: "Job description" };
  return { status: "UNKNOWN", evidence: null, evidenceSource: null };
}
export function normalizeEmployer(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/\b(incorporated|inc|llc|ltd|limited|corp|corporation|co|company|technologies|technology)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function distance(a: string, b: string): number {
  const last = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, last[j] + 1, last[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    last.splice(0, last.length, ...next);
  }
  return last[b.length];
}
export function employerMatches(company: string, employer: string, override?: string | null) {
  const a = normalizeEmployer(override || company), b = normalizeEmployer(employer);
  if (!a || !b) return false;
  if (override) return a === b; // manual override is an exact alias, never a wildcard
  if (a === b) return true;
  // Short/common names have dangerous false positives; refuse fuzzy matches.
  if (a.length < 7 || b.length < 7) return false;
  return 1 - distance(a, b) / Math.max(a.length, b.length) >= 0.93;
}
export function currentFiscalYear(now = new Date()) { return now.getUTCFullYear() + (now.getUTCMonth() >= 9 ? 1 : 0); }
export function recentFilings(filings: VisaFiling[], company: string, override?: string | null, now = new Date()) {
  const year = currentFiscalYear(now);
  const minYear = year - 2;
  return filings.filter(f => f.fiscalYear >= minYear && f.fiscalYear <= year && employerMatches(company, f.employerName, override));
}
/**
 * Employer history counts as a sponsorship signal only when it shows sponsorship
 * actually happening: a certified LCA or at least one USCIS approval. A company
 * whose recent record is only denials is NOT a likely sponsor.
 */
export function hasSponsorHistory(filings: VisaFiling[]) {
  return filings.some(f => f.source === "DOL_LCA" || (f.approvals || 0) > 0);
}
export function resolveSponsorship(description: string, filings: VisaFiling[], company: string, override?: string | null): SponsorshipSignal {
  const signal = statedSponsorship(description);
  if (signal.status !== "UNKNOWN") return signal;
  const recent = recentFilings(filings, company, override);
  if (hasSponsorHistory(recent))
    return { status: "LIKELY_HISTORY", evidence: null, evidenceSource: "DOL / USCIS employer history" };
  return signal;
}
export function filingSummary(filings: VisaFiling[]) {
  const wages = filings.map(f => f.wage).filter((w): w is number => w != null && w > 0).sort((a, b) => a - b);
  const medianWage = wages.length ? (wages[Math.floor((wages.length - 1) / 2)] + wages[Math.ceil((wages.length - 1) / 2)]) / 2 : null;
  const titleCounts = new Map<string, number>();
  for (const f of filings) if (f.title) titleCounts.set(f.title, (titleCounts.get(f.title) || 0) + 1);
  return { records: filings.length, lcaFilings: filings.filter(f => f.source === "DOL_LCA").length,
    uscisApprovals: filings.filter(f => f.source === "USCIS").reduce((n, f) => n + (f.approvals || 0), 0),
    uscisDenials: filings.filter(f => f.source === "USCIS").reduce((n, f) => n + (f.denials || 0), 0),
    medianWage, commonTitles: [...titleCounts].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, count })),
    years: [...new Set(filings.map(f => f.fiscalYear))].sort((a, b) => b - a) };
}
