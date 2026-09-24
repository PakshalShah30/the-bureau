import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
const schema = z.object({ notes: z.string().max(5000).optional(), tags: z.array(z.string().trim().min(1).max(30)).max(12).optional() });
export async function PATCH(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try { const value = await store.updateSaved(uid, (await ctx.params).jobId, schema.parse(await req.json()));
    return value ? NextResponse.json({ saved: value }) : notFound();
  } catch (e) { return apiError(e); }
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return await store.unsaveJob(uid, (await ctx.params).jobId) ? NextResponse.json({ ok: true }) : notFound();
}
