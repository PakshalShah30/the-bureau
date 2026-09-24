import type { Intensity, Job, Resume, UserRecord } from "../types";
import { atsScore, factLock, formattingCheck, parseResume, reorderSkills, type ResumeLine } from "./ats";
import { builtInHumanize, opener, varyOpeners } from "./humanize";
import { detectorFor, humanizerFor, llm, memoDetector } from "./providers";

export const AI_FLAG_THRESHOLD = 60;
const MAX_LINES = 150, CHUNK = 25;
export type Suggestion = {
  lineIndex: number; section: string; kind: "bullet" | "summary" | "skills";
  before: string; after: string; blocked: boolean; reasons: string[];
  scoreBefore: number; scoreAfter: number; atsDrop: boolean; aiBefore: number | null; aiAfter: number | null;
};
export type SectionReport = { name: string; lineIndexes: number[]; aiBefore: number; aiAfter: number; flagged: number };
type Ctx = { resume: Resume; job: Job; user: UserRecord };

function scoreWith(lines: string[], index: number, text: string, job: Job) {
  return atsScore(lines.map((l, i) => i === index ? text : l).join("\n"), job.description, { company: job.companyName }).score;
}
async function llmProposals(ctx: Ctx, editable: ResumeLine[], matched: string[], missing: string[]) {
  const proposals = new Map<number, string>();
  if (!process.env.LLM_API_KEY) return { proposals, message: "Set LLM_API_KEY in the server environment for AI rewrites. The built-in humanizer, ATS analysis and fact-lock still run without it." };
  const chunks: ResumeLine[][] = [];
  for (let i = 0; i < editable.length; i += CHUNK) chunks.push(editable.slice(i, i + CHUNK));
  const failures: string[] = [];
  for (const chunk of chunks) {
    try {
      const answer = await llm.completeJson<{ suggestions: Array<{ index: number; text: string }> }>(
        "You edit resumes without inventing facts. Respond JSON {\"suggestions\":[{\"index\":number,\"text\":string}]}. For each indexed line suggest ONE rewrite that uses the job's own wording where it is TRUE for this person. Lines are grouped by resume section: bullets stay one bullet (keep the bullet marker), summary lines stay prose. Preserve every employer, title, date, tool, number and achievement EXACTLY. Never add skills absent from the original resume, even if the job requires them. Vary sentence structure between bullets, prefer concrete nouns and real metrics, avoid generic AI phrasing (spearheaded, leveraged, seamlessly, dynamic, results-driven, passionate about). If in doubt, return the line unchanged.",
        JSON.stringify({ resume: ctx.resume.content, jobTitle: ctx.job.title, jobDescription: ctx.job.description.slice(0, 18000),
          lines: chunk.map(l => ({ index: l.index, section: l.section, kind: l.kind, text: l.text })), matchedKeywords: matched, missingSkillsDoNotAdd: missing }));
      for (const s of Array.isArray(answer.suggestions) ? answer.suggestions : [])
        if (typeof s?.text === "string" && chunk.some(l => l.index === s.index)) proposals.set(s.index, s.text);
    } catch (e) { failures.push(e instanceof Error ? e.message : "Provider error"); }
  }
  return { proposals, message: failures.length ? `AI rewrite partly unavailable (${failures[0]}). Built-in humanizer suggestions are shown for those lines.` : "" };
}

export async function tailorResume(ctx: Ctx) {
  const { resume, job, user } = ctx;
  const match = atsScore(resume.content, job.description, { company: job.companyName });
  const jobTerms = match.keywords.map(k => k.term);
  const parsed = parseResume(resume.content);
  const lines = parsed.map(l => l.text);
  const editable = parsed.filter(l => l.kind === "bullet" || l.kind === "summary").slice(0, MAX_LINES);
  const { proposals, message } = await llmProposals(ctx, editable, match.matched, match.missing);
  const humanizer = humanizerFor(user), detector = memoDetector(detectorFor(user));
  const intensity: Intensity = user.humanizationIntensity;
  const drafted = new Map<number, string>();
  for (const line of editable) drafted.set(line.index, await humanizer.humanize(line.text, proposals.get(line.index) || line.text, intensity, match.matched));
  // Section-level variety pass: bullets in one section should not share an opener.
  for (const section of new Set(editable.map(l => l.section))) {
    const bullets = editable.filter(l => l.section === section && l.kind === "bullet");
    varyOpeners(bullets.map(b => drafted.get(b.index)!), intensity).forEach((text, i) => drafted.set(bullets[i].index, builtInHumanize(text, { intensity: "LIGHT", keepTerms: match.matched })));
  }
  const suggestions: Suggestion[] = [];
  for (const line of parsed) {
    if (line.kind === "skills") {
      const after = reorderSkills(line.text, match.matched);
      suggestions.push({ lineIndex: line.index, section: line.section, kind: "skills", before: line.text, after, blocked: false, reasons: [],
        scoreBefore: match.score, scoreAfter: scoreWith(lines, line.index, after, job), atsDrop: false, aiBefore: null, aiAfter: null });
      continue;
    }
    if (!drafted.has(line.index)) continue;
    const after = drafted.get(line.index)!;
    const guard = factLock(line.text, after, resume.content, [], jobTerms);
    const scoreAfter = scoreWith(lines, line.index, after, job);
    suggestions.push({ lineIndex: line.index, section: line.section, kind: line.kind as "bullet" | "summary", before: line.text, after,
      blocked: !guard.safe, reasons: guard.reasons, scoreBefore: match.score, scoreAfter, atsDrop: scoreAfter < match.score,
      aiBefore: await detector.score(line.text), aiAfter: await detector.score(after) });
  }
  const applied = lines.map((l, i) => { const s = suggestions.find(x => x.lineIndex === i && !x.blocked); return s ? s.after : l; });
  const sections: SectionReport[] = [];
  for (const name of new Set(suggestions.map(s => s.section))) {
    const members = parsed.filter(l => l.section === name && l.kind !== "heading" && l.kind !== "blank");
    const own = suggestions.filter(s => s.section === name);
    sections.push({ name, lineIndexes: own.map(s => s.lineIndex),
      aiBefore: await detector.score(members.map(l => l.text).join("\n")),
      aiAfter: await detector.score(members.map(l => applied[l.index]).join("\n")),
      flagged: own.filter(s => (s.aiAfter ?? 0) >= AI_FLAG_THRESHOLD).length });
  }
  const truncated = parsed.filter(l => l.kind === "bullet" || l.kind === "summary").length > MAX_LINES;
  return { match, formatting: formattingCheck(resume), suggestions, sections,
    aiBefore: await detector.score(resume.content), aiAfter: await detector.score(applied.join("\n")),
    message: [message, truncated ? `Only the first ${MAX_LINES} editable lines were rewritten.` : "",
      process.env.DEMO_MODE === "true" ? "Preview uses excerpts from source descriptions: ATS scores are illustrative until a live board refresh." : ""].filter(Boolean).join(" "),
    sourceResumeId: resume.id, sourceJobId: job.id, intensity };
}

const ESCALATE: Intensity[] = ["LIGHT", "MEDIUM", "STRONG"];
/** Re-humanizes one line; each attempt escalates intensity and rotates opener choices. */
export async function rehumanizeLine(ctx: Ctx, lineIndex: number, proposal: string, attempt: number) {
  const { resume, job, user } = ctx;
  const parsed = parseResume(resume.content);
  const line = parsed[lineIndex];
  if (!line || (line.kind !== "bullet" && line.kind !== "summary")) throw new Error("Only original bullets and summary lines can be re-humanized");
  const match = atsScore(resume.content, job.description, { company: job.companyName });
  const intensity = ESCALATE[Math.min(2, Math.max(ESCALATE.indexOf(user.humanizationIntensity), attempt))];
  const avoidOpeners = parsed.filter(l => l.section === line.section && l.kind === "bullet" && l.index !== lineIndex).map(l => opener(l.text)).concat(opener(proposal));
  const humanized = await humanizerFor(user).humanize(line.text, proposal, intensity, match.matched);
  const after = builtInHumanize(humanized, { intensity, avoidOpeners, variant: attempt, keepTerms: match.matched });
  const guard = factLock(line.text, after, resume.content, [], match.keywords.map(k => k.term));
  const scoreAfter = scoreWith(parsed.map(l => l.text), lineIndex, after, job);
  const detector = memoDetector(detectorFor(user));
  return { before: line.text, after, blocked: !guard.safe, reasons: guard.reasons, intensity,
    atsDrop: scoreAfter < match.score, scoreAfter, aiBefore: await detector.score(line.text), aiAfter: await detector.score(after) };
}
