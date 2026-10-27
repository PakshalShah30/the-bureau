import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { tailorResume } from "@/lib/ai/tailor";
export const maxDuration = 120;
const schema = z.object({ resumeId: z.string().min(1), jobId: z.string().min(1) });
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const { resumeId, jobId } = schema.parse(await req.json());
    const [resume, job, user] = await Promise.all([store.getResume(uid, resumeId), store.getJob(uid, jobId), store.getUser(uid)]);
    if (!resume || !job || !user) return notFound();
    return NextResponse.json(await tailorResume({ resume, job, user }));
  } catch (e) { return apiError(e); }
}
