import { NextResponse } from "next/server";
import { applicationSchema } from "@/lib/validators";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { store } from "@/lib/store";
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return NextResponse.json({ applications: await store.listApplications(uid) });
}
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const input = applicationSchema.parse(await req.json());
    if (input.jobId && !await store.getJob(uid, input.jobId)) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (input.resumeId && !await store.getResume(uid, input.resumeId)) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    return NextResponse.json({ application: await store.addApplication(uid, { ...input, jobId: input.jobId || null,
      appliedAt: input.appliedAt || null, followUpAt: input.followUpAt || null, resumeId: input.resumeId || null }) }, { status: 201 });
  } catch (e) { return apiError(e); }
}
