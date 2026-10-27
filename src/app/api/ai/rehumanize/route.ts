import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { rehumanizeLine } from "@/lib/ai/tailor";
const schema = z.object({ resumeId: z.string(), jobId: z.string(), lineIndex: z.number().int().min(0), proposal: z.string().max(2000), attempt: z.number().int().min(0).max(10).default(1) });
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const input = schema.parse(await req.json());
    const [resume, job, user] = await Promise.all([store.getResume(uid, input.resumeId), store.getJob(uid, input.jobId), store.getUser(uid)]);
    if (!resume || !job || !user) return notFound();
    return NextResponse.json(await rehumanizeLine({ resume, job, user }, input.lineIndex, input.proposal, input.attempt));
  } catch (e) { return apiError(e); }
}
