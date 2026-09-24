import { requireUser, unauthorized } from "@/lib/api";
import { store } from "@/lib/store";
import { applicationsCsv } from "@/lib/csv";
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const [applications, resumes] = await Promise.all([store.listApplications(uid), store.listResumes(uid)]);
  const csv = applicationsCsv(applications, resumes);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="applications-${date}.csv"`, "Cache-Control": "private, no-store" } });
}
