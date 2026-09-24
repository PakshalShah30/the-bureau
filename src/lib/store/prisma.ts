import { PrismaClient, Prisma } from "@prisma/client";
import type { ApplicationInput, CompanyInput, JobInput, ResumeInput, SourceRun, UserRecord, Company, Job, Application, Resume, SavedJob, VisaFiling } from "../types";
import { normalizeEmployer, currentFiscalYear } from "../sponsorship";
const globalPrisma = globalThis as typeof globalThis & { __bureauPrisma?: PrismaClient };
const demoBuild = process.env.DEMO_MODE === "true" || (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL);
export const prisma = demoBuild ? (null as unknown as PrismaClient) : (globalPrisma.__bureauPrisma || new PrismaClient());
if (!demoBuild && process.env.NODE_ENV !== "production") globalPrisma.__bureauPrisma = prisma;
// JSON roundtrip converts Prisma Date objects to public ISO strings and strips Prisma wrappers.
const plain = <T>(v: unknown): T => JSON.parse(JSON.stringify(v)) as T;
const dt = (v: string | null) => v ? new Date(v) : null;
export const prismaStore = {
  async getUser(uid: string) { return plain<UserRecord | null>(await prisma.user.findUnique({ where: { id: uid } })); },
  async getUserByEmail(email: string) { return plain<UserRecord | null>(await prisma.user.findUnique({ where: { email } })); },
  async createUser(input: { email: string; name: string; passwordHash: string }) {
    return plain<UserRecord>(await prisma.user.create({ data: input }));
  },
  async listUsers() { return plain<UserRecord[]>(await prisma.user.findMany()); },
  async updateUser(uid: string, input: Partial<UserRecord>) {
    return plain<UserRecord>(await prisma.user.update({ where: { id: uid }, data: { ...input,
      lastVisitedAt: input.lastVisitedAt === undefined ? undefined : dt(input.lastVisitedAt),
    } as Prisma.UserUpdateInput }));
  },
  async listCompanies(uid: string) { return plain<Company[]>(await prisma.trackedCompany.findMany({ where: { userId: uid }, orderBy: { name: "asc" } })); },
  async getCompany(uid: string, cid: string) { return plain<Company | null>(await prisma.trackedCompany.findFirst({ where: { id: cid, userId: uid } })); },
  async addCompany(uid: string, input: CompanyInput) {
    return plain<Company>(await prisma.trackedCompany.create({ data: { ...input, userId: uid } }));
  },
  async updateCompany(uid: string, cid: string, input: Partial<CompanyInput> & { lastFetchedAt?: string | null; lastError?: string | null }) {
    const result = await prisma.trackedCompany.updateMany({ where: { id: cid, userId: uid }, data: { ...input,
      lastFetchedAt: input.lastFetchedAt === undefined ? undefined : dt(input.lastFetchedAt),
    } as Prisma.TrackedCompanyUpdateManyMutationInput });
    return result.count ? this.getCompany(uid, cid) : null;
  },
  async deleteCompany(uid: string, cid: string) {
    const existing = await prisma.trackedCompany.findFirst({ where: { id: cid, userId: uid } });
    if (!existing) return false;
    await prisma.$transaction([
      prisma.job.updateMany({ where: { userId: uid, companyId: cid }, data: { companyId: null, closedAt: new Date() } }),
      prisma.trackedCompany.delete({ where: { id: cid } }),
    ]); return true;
  },
  async listJobs(uid: string) {
    const jobs = await prisma.job.findMany({ where: { userId: uid }, include: { saved: true }, orderBy: [{ postedAt: "desc" }, { firstSeenAt: "desc" }] });
    return jobs.map(j => ({ ...plain<Job>(j), saved: !!j.saved }));
  },
  async getJob(uid: string, jid: string) {
    const j = await prisma.job.findFirst({ where: { id: jid, userId: uid }, include: { saved: true } });
    return j ? { ...plain<Job>(j), saved: !!j.saved } : null;
  },
  async upsertJob(uid: string, input: JobInput): Promise<{ job: Job; created: boolean }> {
    const existing = await prisma.job.findUnique({ where: { userId_canonicalKey: { userId: uid, canonicalKey: input.canonicalKey } } });
    if (existing) {
      const update: Prisma.JobUpdateInput = input.source === "HN_HIRING" && existing.source !== "HN_HIRING"
        ? { hnUrl: input.hnUrl, lastSeenAt: new Date(), closedAt: null }
        : { ...input, source: existing.source === "YC_STARTUP" && input.source === "COMPANY_BOARD" ? "YC_STARTUP" : input.source,
          description: input.description || existing.description, hnUrl: input.hnUrl || existing.hnUrl,
          sponsorship: input.description ? input.sponsorship : existing.sponsorship,
          sponsorshipEvidence: input.description ? input.sponsorshipEvidence : existing.sponsorshipEvidence,
          evidenceSource: input.description ? input.evidenceSource : existing.evidenceSource,
          postedAt: dt(input.postedAt), company: input.companyId ? { connect: { id: input.companyId } } : { disconnect: true },
          companyId: undefined, lastSeenAt: new Date(), closedAt: null } as Prisma.JobUpdateInput;
      const job = await prisma.job.update({ where: { id: existing.id }, data: update });
      return { job: plain<Job>(job), created: false };
    }
    try {
      const job = await prisma.job.create({ data: { ...input, userId: uid, postedAt: dt(input.postedAt) } as Prisma.JobUncheckedCreateInput });
      return { job: plain<Job>(job), created: true };
    } catch (err) {
      // Concurrent ingestion of the same canonical URL: unique index wins.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const job = await prisma.job.findUniqueOrThrow({ where: { userId_canonicalKey: { userId: uid, canonicalKey: input.canonicalKey } } });
        return { job: plain<Job>(job), created: false };
      }
      throw err;
    }
  },
  async closeMissing(uid: string, source: "HN_HIRING" | "COMPANY_BOARD", seen: string[], companyId?: string, sourceUrl?: string) {
    const result = await prisma.job.updateMany({ where: { userId: uid, closedAt: null, canonicalKey: { notIn: seen },
      ...(source === "HN_HIRING" ? { source: "HN_HIRING" as const, sourceUrl } : { companyId }) }, data: { closedAt: new Date() } });
    return result.count;
  },
  async listSaved(uid: string) { return plain<SavedJob[]>(await prisma.savedJob.findMany({ where: { userId: uid }, include: { job: true }, orderBy: { createdAt: "desc" } })); },
  async getSaved(uid: string, jid: string) { return plain<SavedJob | null>(await prisma.savedJob.findFirst({ where: { userId: uid, jobId: jid } })); },
  async saveJob(uid: string, jid: string) {
    if (!await prisma.job.findFirst({ where: { id: jid, userId: uid }, select: { id: true } })) throw new Error("Job not found");
    return plain<SavedJob>(await prisma.savedJob.upsert({ where: { jobId: jid }, create: { userId: uid, jobId: jid }, update: {} }));
  },
  async updateSaved(uid: string, jid: string, data: { notes?: string; tags?: string[] }) {
    const result = await prisma.savedJob.updateMany({ where: { userId: uid, jobId: jid }, data });
    return result.count ? this.getSaved(uid, jid) : null;
  },
  async unsaveJob(uid: string, jid: string) { return (await prisma.savedJob.deleteMany({ where: { userId: uid, jobId: jid } })).count > 0; },
  async listApplications(uid: string) { return plain<Application[]>(await prisma.application.findMany({ where: { userId: uid }, include: { job: true }, orderBy: { updatedAt: "desc" } })); },
  async getApplication(uid: string, aid: string) { return plain<Application | null>(await prisma.application.findFirst({ where: { userId: uid, id: aid } })); },
  async addApplication(uid: string, input: ApplicationInput) {
    return plain<Application>(await prisma.application.create({ data: { ...input, userId: uid,
      appliedAt: dt(input.appliedAt), followUpAt: dt(input.followUpAt) } as Prisma.ApplicationUncheckedCreateInput }));
  },
  async updateApplication(uid: string, aid: string, input: Partial<ApplicationInput>) {
    const result = await prisma.application.updateMany({ where: { id: aid, userId: uid }, data: { ...input,
      appliedAt: input.appliedAt === undefined ? undefined : dt(input.appliedAt),
      followUpAt: input.followUpAt === undefined ? undefined : dt(input.followUpAt) } });
    return result.count ? this.getApplication(uid, aid) : null;
  },
  async deleteApplication(uid: string, aid: string) { return (await prisma.application.deleteMany({ where: { id: aid, userId: uid } })).count > 0; },
  async listResumes(uid: string) { return plain<Resume[]>(await prisma.resume.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" } })); },
  async getResume(uid: string, rid: string) { return plain<Resume | null>(await prisma.resume.findFirst({ where: { id: rid, userId: uid } })); },
  async addResume(uid: string, input: ResumeInput) {
    return plain<Resume>(await prisma.resume.create({ data: { ...input, userId: uid } as Prisma.ResumeUncheckedCreateInput }));
  },
  async updateResume(uid: string, rid: string, input: Partial<ResumeInput>) {
    const result = await prisma.resume.updateMany({ where: { id: rid, userId: uid }, data: input });
    return result.count ? this.getResume(uid, rid) : null;
  },
  async deleteResume(uid: string, rid: string) { return (await prisma.resume.deleteMany({ where: { id: rid, userId: uid } })).count > 0; },
  async allFilings() { return plain<VisaFiling[]>(await prisma.visaFiling.findMany({ where: { fiscalYear: { gte: currentFiscalYear() - 2 } } })); },
  async filingsForCompany(name: string, override?: string | null) {
    const normalized = normalizeEmployer(override || name);
    if (!normalized) return [];
    return plain<VisaFiling[]>(await prisma.visaFiling.findMany({ where: { fiscalYear: { gte: currentFiscalYear() - 2 }, employerNormalized: { startsWith: normalized.slice(0, Math.min(normalized.length, 4)) } }, take: 5000 }));
  },
  async insertFilings(rows: VisaFiling[]) { return (await prisma.visaFiling.createMany({ data: rows.map(({ id: _id, ...r }) => r), skipDuplicates: true })).count; },
  async lastRun(uid: string) { return plain<SourceRun | null>(await prisma.sourceRun.findFirst({ where: { userId: uid }, orderBy: { startedAt: "desc" } })); },
  async recordRun(uid: string, input: Omit<SourceRun, "id" | "userId">) {
    return plain<SourceRun>(await prisma.sourceRun.create({ data: { ...input, userId: uid, startedAt: new Date(input.startedAt), endedAt: dt(input.endedAt) } }));
  },
};
