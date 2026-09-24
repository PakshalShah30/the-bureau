import { NextResponse } from "next/server";
import { requireUser, unauthorized, notFound } from "@/lib/api";
import { store } from "@/lib/store";
import { filingSummary, recentFilings } from "@/lib/sponsorship";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const job = await store.getJob(uid, (await ctx.params).id);
  if (!job) return notFound();
  const co = job.companyId ? await store.getCompany(uid, job.companyId) : null;
  const filings = recentFilings(await store.filingsForCompany(job.companyName, co?.employerOverride), job.companyName, co?.employerOverride);
  return NextResponse.json({ job, saved: await store.getSaved(uid, job.id), filings: filings.slice(0, 30), filingSummary: filingSummary(filings), matchedEmployer: co?.employerOverride || job.companyName });
}
