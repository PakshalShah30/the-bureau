import { NextResponse } from "next/server";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { testBoard } from "@/lib/sources/ats";
import { companySchema } from "@/lib/validators";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const cid = (await ctx.params).id; const old = await store.getCompany(uid, cid);
  if (!old) return notFound();
  try {
    const input = companySchema.partial().parse(await req.json());
    if ((input.atsType && input.atsType !== old.atsType) || (input.boardSlug && input.boardSlug !== old.boardSlug))
      await testBoard(input.atsType || old.atsType, input.boardSlug || old.boardSlug);
    return NextResponse.json({ company: await store.updateCompany(uid, cid, input) });
  } catch (e) { return apiError(e); }
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const ok = await store.deleteCompany(uid, (await ctx.params).id);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
