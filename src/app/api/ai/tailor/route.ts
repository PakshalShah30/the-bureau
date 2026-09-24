import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { llm, humanizerFor, detectorFor } from "@/lib/ai/providers";
import { atsScore, factLock, formattingCheck } from "@/lib/ai/ats";
export const maxDuration = 120;
const schema = z.object({ resumeId: z.string().min(1), jobId: z.string().min(1) });
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const { resumeId, jobId } = schema.parse(await req.json());
    const [resume, job, user] = await Promise.all([store.getResume(uid, resumeId), store.getJob(uid, jobId), store.getUser(uid)]);
    if (!resume || !job || !user) return notFound();
    const match = atsScore(resume.content, job.description);
    const lines = resume.content.replace(/\r/g, "").split("\n");
    const bullets = lines.map((text, index) => ({ text, index })).filter(x => /^\s*[-•*]\s+/.test(x.text)).slice(0, 20);
    let proposals: Array<{ index: number; text: string }> = [];
    let message = "";
    if (process.env.LLM_API_KEY && bullets.length) {
      try {
        const answer = await llm.completeJson<{ suggestions: Array<{ index: number; text: string }> }>(
          "You edit resumes without inventing facts. Respond JSON {\"suggestions\":[{\"index\":number,\"text\":string}]}. For each indexed bullet, suggest ONE ATS-aligned rewrite. Preserve every employer, title, date, tool, number and achievement EXACTLY. Do not add skills absent from the original resume, even if job requires them. Keep source bullet marker. If in doubt, return unchanged. No exaggerated verbs or generic AI jargon.",
          JSON.stringify({ resume: resume.content, jobTitle: job.title, jobDescription: job.description.slice(0, 18000), bullets, matchedKeywords: match.matched, missingSkillsDoNotAdd: match.missing })
        );
        proposals = Array.isArray(answer.suggestions) ? answer.suggestions : [];
      } catch (e) { message = `AI rewrite unavailable: ${e instanceof Error ? e.message : "Provider error"}. ATS analysis is still available.`; }
    } else message = "Set LLM_API_KEY in the server environment to generate rewrites. ATS analysis is available without an AI key.";
    const detector = detectorFor(user), humanizer = humanizerFor(user);
    const suggestions: Array<{ lineIndex: number; before: string; after: string; blocked: boolean; reasons: string[]; scoreBefore: number; scoreAfter: number; atsDrop: boolean; aiBefore: number; aiAfter: number }> = [];
    for (const bullet of bullets) {
      const suggestion = proposals.find(x => x.index === bullet.index)?.text || bullet.text;
      const humanized = await humanizer.humanize(bullet.text, suggestion, user.humanizationIntensity, match.matched);
      const guard = factLock(bullet.text, humanized, resume.content);
      const proposedScore = atsScore(lines.map((l, i) => i === bullet.index ? humanized : l).join("\n"), job.description).score;
      suggestions.push({ lineIndex: bullet.index, before: bullet.text, after: humanized,
        blocked: !guard.safe, reasons: guard.reasons, scoreBefore: match.score, scoreAfter: proposedScore,
        atsDrop: proposedScore < match.score, aiBefore: await detector.score(bullet.text), aiAfter: await detector.score(humanized) });
    }
    return NextResponse.json({ match, formatting: formattingCheck(resume), suggestions,
      aiBefore: await detector.score(resume.content), aiAfter: await detector.score(lines.map((l, i) => suggestions.find(s => s.lineIndex === i && !s.blocked)?.after || l).join("\n")),
      message: [message, process.env.DEMO_MODE === "true" ? "Preview uses excerpts from source descriptions: ATS scores are illustrative until a live board refresh." : ""].filter(Boolean).join(" "), sourceResumeId: resume.id, sourceJobId: job.id, intensity: user.humanizationIntensity });
  } catch (e) { return apiError(e); }
}
