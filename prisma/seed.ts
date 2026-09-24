/**
 * Demo account seed for a real PostgreSQL database. NO JOB FIXTURES are inserted: postings are
 * fetched live from the tracked first-party boards and the latest HN thread.
 * Safe to re-run: it links sample applications to real jobs once a refresh has succeeded.
 */
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { demoCompanies, demoResumes } from "../src/lib/demo-fixtures";
import { sampleFilings } from "../src/lib/h1b-sample";
import { refreshUser } from "../src/lib/refresh";
if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true")
  throw new Error("Refusing to seed a known demo password in production. Run SEED_DEMO=true npm run db:seed only on a private deployment.");
const prisma = new PrismaClient();
async function main() {
  if (!process.env.DATABASE_URL || process.env.DEMO_MODE === "true") throw new Error("db:seed requires PostgreSQL mode and DATABASE_URL");
  const email = "demo@thebureau.app";
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: "Alex Morgan",
    passwordHash: await hash("demo1234", 12), lastVisitedAt: new Date(Date.now() - 7 * 86400000) } });
  // Labelled illustrative filings so every sponsorship badge type can appear before an official
  // import. Skipped as soon as real government rows exist; the importer deletes them.
  if (!await prisma.visaFiling.count({ where: { isSample: false } })) {
    const { count } = await prisma.visaFiling.createMany({ data: sampleFilings().map(({ id: _id, ...r }) => r), skipDuplicates: true });
    console.log(`Added ${count} ILLUSTRATIVE sample H-1B rows (labelled "sample" in the UI; replaced by npm run h1b:import).`);
  }
  for (const co of demoCompanies) {
    const { id: _id, userId: _uid, createdAt: _created, lastFetchedAt: _fetched, lastError: _error, ...data } = co;
    await prisma.trackedCompany.upsert({ where: { userId_atsType_boardSlug: { userId: user.id, atsType: co.atsType, boardSlug: co.boardSlug } },
      create: { userId: user.id, ...data }, update: { active: true } });
  }
  let resume = await prisma.resume.findFirst({ where: { userId: user.id, parentId: null } });
  if (!resume) resume = await prisma.resume.create({ data: { userId: user.id, name: demoResumes[0].name, content: demoResumes[0].content,
    filename: demoResumes[0].filename, mimeType: demoResumes[0].mimeType } });
  console.log(`Seeded ${demoCompanies.length} verified first-party boards for ${email}. Fetching live postings…`);
  try {
    const run = await refreshUser(user.id);
    console.log(`Refresh: +${run.added} new, ${run.updated} updated; ${run.errors.length} source errors. No postings were fabricated.`);
    if (run.errors.length) console.warn(run.errors.join("\n"));
  } catch (e) { console.warn(`Live refresh failed: ${e instanceof Error ? e.message : e}`); }
  // Prefer a spread of companies for the sample pipeline.
  const open = await prisma.job.findMany({ where: { userId: user.id, closedAt: null }, orderBy: { postedAt: "desc" }, take: 50 });
  const jobs = open.filter((j, i) => open.findIndex(x => x.companyName === j.companyName) === i).concat(open).slice(0, 5);
  const statuses = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;
  let unlinked = 0;
  for (let i = 0; i < statuses.length; i++) {
    // Sample activity is fictional, but each linked job is a real source posting.
    const job = jobs[i];
    const existing = await prisma.application.findFirst({ where: { userId: user.id, status: statuses[i] } });
    if (existing) {
      if (!existing.jobId && job) await prisma.application.update({ where: { id: existing.id }, data: { jobId: job.id, title: job.title, companyName: job.companyName } });
      else if (!existing.jobId) unlinked++;
      continue;
    }
    if (!job) unlinked++;
    await prisma.application.create({ data: { userId: user.id, jobId: job?.id || null,
      title: job?.title || `Sample ${statuses[i].toLowerCase()} application`, companyName: job?.companyName || "Demo application (not a job posting)",
      status: statuses[i], appliedAt: i === 0 ? null : new Date(Date.now() - (i + 2) * 86400000),
      followUpAt: i === 1 || i === 2 ? new Date(Date.now() + (i + 2) * 86400000) : null,
      resumeId: i === 0 ? null : resume.id, notes: i === 2 ? "Prepare questions about the engineering team." : "" } });
  }
  console.log("Sample applications are in place across all five stages.");
  if (unlinked) console.warn(`${unlinked} sample application(s) have no live job yet (sources unreachable). Re-run npm run db:seed after a successful refresh to link them.`);
  console.log("Change the demo password before exposing this account publicly.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
