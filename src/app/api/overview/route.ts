import { NextResponse } from "next/server";
import { requireUser, unauthorized } from "@/lib/api";
import { store, isDemo } from "@/lib/store";
import { filterJobs } from "@/lib/utils";
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const [user, jobs, apps, companies, resumes, lastRun] = await Promise.all([
    store.getUser(uid), store.listJobs(uid), store.listApplications(uid), store.listCompanies(uid), store.listResumes(uid), store.lastRun(uid),
  ]);
  const open = filterJobs(jobs, {});
  const since = user?.lastVisitedAt ? new Date(user.lastVisitedAt).getTime() : 0;
  const newJobs = open.filter(j => new Date(j.firstSeenAt).getTime() > since);
  const friendly = open.filter(j => ["SPONSORS_STATED", "LIKELY_HISTORY"].includes(j.sponsorship));
  const next = apps.filter(a => a.followUpAt && new Date(a.followUpAt).getTime() >= Date.now() - 86400000).sort((a, b) => new Date(a.followUpAt!).getTime() - new Date(b.followUpAt!).getTime());
  const statusCounts = Object.fromEntries(["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"].map(s => [s, apps.filter(a => a.status === s).length]));
  await store.updateUser(uid, { lastVisitedAt: new Date().toISOString() });
  return NextResponse.json({ user: { name: user?.name, email: user?.email }, counts: { newJobs: newJobs.length, friendly: friendly.length,
    open: open.length, companies: companies.length, applications: apps.length, resumes: resumes.length },
    statusCounts, recentJobs: open.slice(0, 5), friendlyJobs: friendly.slice(0, 3), followUps: next.slice(0, 4),
    lastRun, demo: isDemo });
}
