import { NextResponse } from "next/server";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { refreshUser } from "@/lib/refresh";
import { store } from "@/lib/store";
export const maxDuration = 300;
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const previous = await store.lastRun(uid);
    if (previous?.endedAt && !previous.errors.length && Date.now() - new Date(previous.endedAt).getTime() < 60000)
      return NextResponse.json({ error: "Refreshed less than a minute ago. Try again shortly." }, { status: 429 });
    const body = await req.json().catch(() => ({})) as { companyId?: string };
    if (body.companyId && !await store.getCompany(uid, body.companyId)) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    const run = await refreshUser(uid, { companyId: body.companyId });
    return NextResponse.json({ run });
  } catch (e) { return apiError(e); }
}
