import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { demoApplications, demoCompanies, demoJobs, demoResumes, demoUser } from "../demo-fixtures";
import type { Application, ApplicationInput, Company, CompanyInput, Job, JobInput, Resume, ResumeInput, SavedJob, SourceRun, UserRecord, VisaFiling } from "../types";
import { id, iso } from "../utils";
import { employerMatches } from "../sponsorship";
import { sampleFilings } from "../h1b-sample";
import { mergedSponsorship, pickSameRole } from "../dedupe";

type State = { users: UserRecord[]; companies: Company[]; jobs: Job[]; saved: SavedJob[]; applications: Application[]; resumes: Resume[]; filings: VisaFiling[]; runs: SourceRun[] };
const file = join(process.cwd(), ".data", "demo.json");
function initial(): State { return { users: [demoUser], companies: demoCompanies, jobs: demoJobs, saved: [], applications: demoApplications, resumes: demoResumes, filings: sampleFilings(), runs: [] }; }
const globalState = globalThis as typeof globalThis & { __bureauDemo?: State };
function state(): State {
  if (!globalState.__bureauDemo) {
    try { globalState.__bureauDemo = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as State : initial(); }
    catch { globalState.__bureauDemo = initial(); }
  }
  return globalState.__bureauDemo;
}
function persist() {
  mkdirSync(dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(state())); renameSync(temp, file);
}
const demoLocks = new Map<string, number>();
export const demoStore = {
  async getUser(uid: string) { return state().users.find(u => u.id === uid) || null; },
  async getUserByEmail(email: string) { return state().users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null; },
  async createUser(input: { email: string; name: string; passwordHash: string }) {
    if (state().users.some(u => u.email.toLowerCase() === input.email.toLowerCase())) throw new Error("Email already registered");
    const user: UserRecord = { id: id(), ...input, lastVisitedAt: null, humanizationIntensity: "MEDIUM", humanizerKey: null, detectorKey: null, humanizerUrl: null, detectorUrl: null };
    state().users.push(user); persist(); return user;
  },
  async listUsers() { return state().users; },
  async updateUser(uid: string, input: Partial<UserRecord>) {
    const user = state().users.find(u => u.id === uid);
    if (!user) throw new Error("User not found");
    Object.assign(user, input); persist(); return user;
  },
  async listCompanies(uid: string) { return state().companies.filter(c => c.userId === uid); },
  async getCompany(uid: string, cid: string) { return state().companies.find(c => c.userId === uid && c.id === cid) || null; },
  async addCompany(uid: string, input: CompanyInput) {
    if (state().companies.some(c => c.userId === uid && c.atsType === input.atsType && c.boardSlug.toLowerCase() === input.boardSlug.toLowerCase())) throw new Error("Already tracking this board");
    const company: Company = { ...input, id: id(), userId: uid, createdAt: iso(), lastFetchedAt: null, lastError: null };
    state().companies.push(company); persist(); return company;
  },
  async updateCompany(uid: string, cid: string, input: Partial<CompanyInput> & { lastFetchedAt?: string | null; lastError?: string | null }) {
    const co = state().companies.find(c => c.userId === uid && c.id === cid);
    if (!co) return null;
    Object.assign(co, input); persist(); return co;
  },
  async deleteCompany(uid: string, cid: string) {
    const co = state().companies.find(c => c.userId === uid && c.id === cid);
    if (!co) return false;
    state().companies = state().companies.filter(c => c.id !== cid);
    for (const job of state().jobs) if (job.userId === uid && job.companyId === cid) { job.companyId = null; job.closedAt = iso(); }
    persist(); return true;
  },
  async listJobs(uid: string) {
    const saved = new Set(state().saved.filter(s => s.userId === uid).map(s => s.jobId));
    return state().jobs.filter(j => j.userId === uid).map(j => ({ ...j, saved: saved.has(j.id) }));
  },
  async getJob(uid: string, jid: string) {
    const job = state().jobs.find(j => j.userId === uid && j.id === jid);
    return job ? { ...job, saved: state().saved.some(s => s.jobId === jid && s.userId === uid) } : null;
  },
  async upsertJob(uid: string, input: JobInput, opts: { fuzzy?: boolean } = {}): Promise<{ job: Job; created: boolean }> {
    let existing = state().jobs.find(j => j.userId === uid && j.canonicalKey === input.canonicalKey);
    // Cross-source dedupe (same company + role): the first-party board posting stays canonical.
    if (!existing && opts.fuzzy) existing = pickSameRole(input, state().jobs.filter(j => j.userId === uid && !j.closedAt &&
      (input.source === "HN_HIRING" ? j.source !== "HN_HIRING" : j.source === "HN_HIRING"))) || undefined;
    if (existing) {
      if (input.source === "HN_HIRING" && existing.source !== "HN_HIRING") {
        existing.hnUrl = input.hnUrl; // keep original first-party ATS posting as canonical
        Object.assign(existing, mergedSponsorship(existing, input));
      } else {
        const hnPolicy = existing.source === "HN_HIRING" && input.source !== "HN_HIRING" ? mergedSponsorship(input, existing) : null;
        const source = existing.source === "YC_STARTUP" && input.source === "COMPANY_BOARD" ? "YC_STARTUP" : input.source;
        Object.assign(existing, { ...input, source, description: input.description || existing.description,
          hnUrl: input.hnUrl || existing.hnUrl, sponsorship: input.description ? input.sponsorship : existing.sponsorship,
          sponsorshipEvidence: input.description ? input.sponsorshipEvidence : existing.sponsorshipEvidence,
          evidenceSource: input.description ? input.evidenceSource : existing.evidenceSource }, hnPolicy);
      }
      // A live fetch replaces the dated preview snapshot.
      existing.lastSeenAt = iso(); existing.closedAt = null; existing.snapshotAt = null; persist(); return { job: existing, created: false };
    }
    const job: Job = { ...input, id: id(), userId: uid, firstSeenAt: iso(), lastSeenAt: iso(), closedAt: null };
    state().jobs.push(job); persist(); return { job, created: true };
  },
  async closeMissing(uid: string, source: "HN_HIRING" | "COMPANY_BOARD", seen: string[], companyId?: string, sourceUrl?: string) {
    let closed = 0;
    for (const job of state().jobs) {
      if (job.userId !== uid || job.closedAt || seen.includes(job.canonicalKey)) continue;
      if (source === "HN_HIRING" ? (job.source !== "HN_HIRING" || job.sourceUrl !== sourceUrl) : job.companyId !== companyId) continue;
      job.closedAt = iso(); closed++;
    }
    if (closed) persist(); return closed;
  },
  async listSaved(uid: string) { return state().saved.filter(s => s.userId === uid).map(s => ({ ...s, job: state().jobs.find(j => j.id === s.jobId) })); },
  async getSaved(uid: string, jid: string) { return state().saved.find(s => s.userId === uid && s.jobId === jid) || null; },
  async saveJob(uid: string, jid: string) {
    if (!state().jobs.some(j => j.id === jid && j.userId === uid)) throw new Error("Job not found");
    const saved = state().saved.find(s => s.userId === uid && s.jobId === jid);
    if (saved) return saved;
    const value: SavedJob = { id: id(), userId: uid, jobId: jid, notes: "", tags: [], createdAt: iso() };
    state().saved.push(value); persist(); return value;
  },
  async updateSaved(uid: string, jid: string, data: { notes?: string; tags?: string[] }) {
    const saved = state().saved.find(s => s.userId === uid && s.jobId === jid);
    if (!saved) return null;
    Object.assign(saved, data); persist(); return saved;
  },
  async unsaveJob(uid: string, jid: string) {
    const exists = state().saved.some(s => s.userId === uid && s.jobId === jid);
    state().saved = state().saved.filter(s => !(s.userId === uid && s.jobId === jid)); persist(); return exists;
  },
  async listApplications(uid: string) { return state().applications.filter(a => a.userId === uid).map(a => ({ ...a, job: state().jobs.find(j => j.id === a.jobId) || null })); },
  async getApplication(uid: string, aid: string) { return state().applications.find(a => a.userId === uid && a.id === aid) || null; },
  async addApplication(uid: string, input: ApplicationInput) {
    const now = iso(); const app: Application = { ...input, id: id(), userId: uid, createdAt: now, updatedAt: now };
    state().applications.push(app); persist(); return app;
  },
  async updateApplication(uid: string, aid: string, input: Partial<ApplicationInput>) {
    const app = state().applications.find(a => a.userId === uid && a.id === aid);
    if (!app) return null;
    Object.assign(app, input, { updatedAt: iso() }); persist(); return app;
  },
  async deleteApplication(uid: string, aid: string) {
    const exists = state().applications.some(a => a.userId === uid && a.id === aid);
    state().applications = state().applications.filter(a => !(a.userId === uid && a.id === aid)); persist(); return exists;
  },
  async listResumes(uid: string) { return state().resumes.filter(r => r.userId === uid).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  async getResume(uid: string, rid: string) { return state().resumes.find(r => r.userId === uid && r.id === rid) || null; },
  async addResume(uid: string, input: ResumeInput) {
    const resume: Resume = { ...input, id: id(), userId: uid, createdAt: iso() };
    state().resumes.push(resume); persist(); return resume;
  },
  async updateResume(uid: string, rid: string, input: Partial<ResumeInput>) {
    const resume = state().resumes.find(r => r.userId === uid && r.id === rid);
    if (!resume) return null;
    Object.assign(resume, input); persist(); return resume;
  },
  async deleteResume(uid: string, rid: string) {
    const exists = state().resumes.some(r => r.userId === uid && r.id === rid);
    state().resumes = state().resumes.filter(r => !(r.userId === uid && r.id === rid));
    for (const app of state().applications) if (app.userId === uid && app.resumeId === rid) app.resumeId = null;
    persist(); return exists;
  },
  async allFilings() { return state().filings; },
  async filingsForCompany(name: string, override?: string | null) { return state().filings.filter(f => employerMatches(name, f.employerName, override)); },
  async insertFilings(rows: VisaFiling[]) {
    const keys = new Set(state().filings.map(f => f.externalKey));
    const fresh = rows.filter(r => !keys.has(r.externalKey)); state().filings.push(...fresh); persist(); return fresh.length;
  },
  async acquireRefreshLock(uid: string, ms: number) {
    const until = demoLocks.get(uid);
    if (until && until > Date.now()) return false;
    demoLocks.set(uid, Date.now() + ms); return true;
  },
  async releaseRefreshLock(uid: string) { demoLocks.delete(uid); },
  async lastRefreshTimes() {
    const map = new Map<string, string | null>();
    for (const run of state().runs) if (!map.get(run.userId) || map.get(run.userId)! < run.startedAt) map.set(run.userId, run.startedAt);
    return map;
  },
  async lastRun(uid: string) { return state().runs.filter(r => r.userId === uid).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null; },
  async recordRun(uid: string, input: Omit<SourceRun, "id" | "userId">) {
    const run: SourceRun = { ...input, id: id(), userId: uid }; state().runs.push(run); persist(); return run;
  },
};
