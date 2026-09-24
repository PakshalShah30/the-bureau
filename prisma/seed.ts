/** Opt-in demo account seed for a real PostgreSQL database. NO JOB FIXTURES are inserted. */
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { demoCompanies, demoResumes } from "../src/lib/demo-fixtures";
import { refreshUser } from "../src/lib/refresh";
if (process.env.SEED_DEMO !== "true") throw new Error("Opt-in required: run SEED_DEMO=true npm run db:seed. This creates a known demo password; never seed an unprotected public deployment.");
const prisma = new PrismaClient();
async function main() {
  if (!process.env.DATABASE_URL || process.env.DEMO_MODE === "true") throw new Error("db:seed requires PostgreSQL mode and DATABASE_URL");
  const email = "demo@thebureau.app";
  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: "Alex Morgan",
    passwordHash: await hash("demo1234", 12), lastVisitedAt: new Date(Date.now() - 7 * 86400000) } });
  for (const co of demoCompanies) {
    const { id: _id, userId: _uid, createdAt: _created, lastFetchedAt: _fetched, lastError: _error, ...data } = co;
    await prisma.trackedCompany.upsert({ where: { userId_atsType_boardSlug: { userId: user.id, atsType: co.atsType, boardSlug: co.boardSlug } },
      create: { userId: user.id, ...data }, update: { active: true } });
  }
  let resume = await prisma.resume.findFirst({ where: { userId: user.id, parentId: null } });
  if (!resume) resume = await prisma.resume.create({ data: { userId: user.id, name: demoResumes[0].name, content: demoResumes[0].content,
    filename: demoResumes[0].filename, mimeType: demoResumes[0].mimeType } });
  console.log(`Seeded ${demoCompanies.length} verified first-party boards for ${email}. Fetching live postings…`);
  const run = await refreshUser(user.id);
  console.log(`Refresh: +${run.added} jobs; ${run.errors.length} source errors. No postings were fabricated.`);
  if (run.errors.length) console.warn(run.errors.join("\n"));
  const jobs = await prisma.job.findMany({ where: { userId: user.id, closedAt: null }, take: 5, orderBy: { postedAt: "desc" } });
  const statuses = ["SAVED", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;
  for (let i = 0; i < statuses.length; i++) {
    // Sample activity is fictional, but each linked job (if available) is a real source posting.
    const job = jobs[i];
    const title = job?.title || `Sample ${statuses[i].toLowerCase()} application`;
    const company = job?.companyName || "Demo application (not a job posting)";
    if (await prisma.application.findFirst({ where: { userId: user.id, status: statuses[i] } })) continue;
    await prisma.application.create({ data: { userId: user.id, jobId: job?.id || null, title, companyName: company,
      status: statuses[i], appliedAt: i === 0 ? null : new Date(Date.now() - (i + 2) * 86400000),
      followUpAt: i === 1 || i === 2 ? new Date(Date.now() + (i + 2) * 86400000) : null,
      resumeId: i === 0 ? null : resume.id } });
  }
  console.log("Sample applications added across five stages. Change the demo password before exposing this account publicly.");
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
