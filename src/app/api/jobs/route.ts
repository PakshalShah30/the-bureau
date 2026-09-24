import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/api";
import { store, isDemo } from "@/lib/store";
import { filterJobs } from "@/lib/utils";
import { rankByFit } from "@/lib/fit";
import type { JobFilters } from "@/lib/types";
export async function GET(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const url = new URL(req.url); const p = url.searchParams;
  const filters: JobFilters = { q: p.get("q") || undefined, company: p.get("company") || undefined,
    source: p.get("source") || undefined, batch: p.get("batch") || undefined, size: p.get("size") || undefined,
    location: p.get("location") || undefined, workplace: p.get("workplace") || undefined,
    department: p.get("department") || undefined, days: p.get("days") || undefined,
    sponsorship: p.get("sponsorship") || undefined, friendly: p.get("friendly") === "true",
    saved: p.get("saved") === "true", closed: p.get("closed") === "true" };
  const all = await store.listJobs(uid);
  let jobs = filterJobs(all, filters);
  // Optional: score every job against one of the user's resumes and sort by fit.
  const resumeId = p.get("resumeId");
  let fitResume: { id: string; name: string } | null = null;
  if (resumeId) {
    const resume = await store.getResume(uid, resumeId);
    if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    fitResume = { id: resume.id, name: resume.name };
    jobs = rankByFit(jobs, resume.content, { sort: p.get("sort") !== "newest", minFit: Number(p.get("minFit")) || 0 });
  }
  const page = Math.max(1, Math.min(10000, Number(p.get("page")) || 1));
  const limit = Math.max(1, Math.min(100, Number(p.get("limit")) || 20));
  const facets = {
    companies: [...new Set(all.filter(j => !j.closedAt).map(j => j.companyName))].sort(),
    batches: [...new Set(all.map(j => j.ycBatch).filter(Boolean))].sort(),
    departments: [...new Set(all.map(j => j.department).filter(Boolean))].sort(),
  };
  return NextResponse.json({ jobs: jobs.slice((page - 1) * limit, page * limit), total: jobs.length,
    page, pages: Math.ceil(jobs.length / limit), facets, fitResume, lastRun: await store.lastRun(uid), demo: isDemo });
}
