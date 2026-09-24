import { NextResponse } from "next/server";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { z } from "zod";
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return NextResponse.json({ saved: await store.listSaved(uid) });
}
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try { const { jobId } = z.object({ jobId: z.string().min(1) }).parse(await req.json());
    return NextResponse.json({ saved: await store.saveJob(uid, jobId) }, { status: 201 });
  } catch (e) { return apiError(e); }
}
