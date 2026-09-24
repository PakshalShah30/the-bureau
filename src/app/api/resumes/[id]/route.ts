import { NextResponse } from "next/server";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { z } from "zod";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const resume = await store.getResume(uid, (await ctx.params).id);
  return resume ? NextResponse.json({ resume }) : notFound();
}
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const input = z.object({ name: z.string().trim().min(2).max(100).optional(), content: z.string().min(30).max(120000).optional() }).parse(await req.json());
    const resume = await store.updateResume(uid, (await ctx.params).id, input);
    return resume ? NextResponse.json({ resume }) : notFound();
  } catch (e) { return apiError(e); }
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return await store.deleteResume(uid, (await ctx.params).id) ? NextResponse.json({ ok: true }) : notFound();
}
