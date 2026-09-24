import { NextResponse } from "next/server";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { applicationSchema } from "@/lib/validators";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const aid = (await ctx.params).id;
  if (!await store.getApplication(uid, aid)) return notFound();
  try {
    const input = applicationSchema.partial().parse(await req.json());
    if (input.jobId && !await store.getJob(uid, input.jobId)) return notFound();
    if (input.resumeId && !await store.getResume(uid, input.resumeId)) return notFound();
    return NextResponse.json({ application: await store.updateApplication(uid, aid, input) });
  } catch (e) { return apiError(e); }
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return await store.deleteApplication(uid, (await ctx.params).id) ? NextResponse.json({ ok: true }) : notFound();
}
