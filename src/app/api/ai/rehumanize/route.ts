import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { humanizerFor, detectorFor } from "@/lib/ai/providers";
import { atsScore, factLock } from "@/lib/ai/ats";
const schema = z.object({ resumeId: z.string(), jobId: z.string(), lineIndex: z.number().int().min(0), proposal: z.string().max(2000) });
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const input = schema.parse(await req.json());
    const [resume, job, user] = await Promise.all([store.getResume(uid, input.resumeId), store.getJob(uid, input.jobId), store.getUser(uid)]);
    if (!resume || !job || !user) return notFound();
    const lines = resume.content.replace(/\r/g, "").split("\n");
    const before = lines[input.lineIndex];
    if (!before || !/^\s*[-•*]\s+/.test(before)) throw new Error("Only original resume bullets can be re-humanized");
    const scoreBefore = atsScore(resume.content, job.description);
    const after = await humanizerFor(user).humanize(before, input.proposal, user.humanizationIntensity, scoreBefore.matched);
    const guard = factLock(before, after, resume.content);
    lines[input.lineIndex] = after;
    const scoreAfter = atsScore(lines.join("\n"), job.description).score;
    return NextResponse.json({ before, after, blocked: !guard.safe, reasons: guard.reasons,
      atsDrop: scoreAfter < scoreBefore.score, scoreAfter, aiBefore: await detectorFor(user).score(before), aiAfter: await detectorFor(user).score(after) });
  } catch (e) { return apiError(e); }
}
