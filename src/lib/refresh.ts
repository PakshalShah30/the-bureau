import { store } from "./store";
import { fetchBoard, postingToJob } from "./sources/ats";
import { fetchLatestHnThread } from "./sources/hn";
import { hasSponsorHistory, recentFilings, resolveSponsorship } from "./sponsorship";
import { llm } from "./ai/providers";
import type { JobInput, SourceRun, VisaFiling } from "./types";
import { iso } from "./utils";

async function sponsorshipFor(job: JobInput, filings: VisaFiling[], employerOverride?: string | null): Promise<JobInput> {
  let signal = resolveSponsorship(job.description, filings, job.companyName, employerOverride);
  if (signal.status === "UNKNOWN" && process.env.LLM_API_KEY && /\b(visa|sponsor|work authorization|h[ -]?1b)\b/i.test(job.description)) {
    try {
      const response = await llm.completeJson<{ status: string; evidence: string | null }>(
        "Classify ONLY explicit job posting policy. JSON {\"status\":\"SPONSORS_STATED|NO_SPONSORSHIP_STATED|UNKNOWN\",\"evidence\":\"exact sentence or null\"}. Quoted evidence MUST be verbatim in the description. Do not infer from employer history. For uncertainty return UNKNOWN.",
        job.description.slice(0, 25000));
      if (["SPONSORS_STATED", "NO_SPONSORSHIP_STATED"].includes(response.status) && response.evidence && job.description.includes(response.evidence))
        signal = { status: response.status as "SPONSORS_STATED" | "NO_SPONSORSHIP_STATED", evidence: response.evidence, evidenceSource: "Job description · AI verified" };
    } catch { /* Rule-based classifier remains authoritative when model unavailable. */ }
  }
  // Explicit statements always override history; history only from imported government rows.
  // (bug fix) this used to accept ANY recent filing, so an employer with only USCIS
  // denials was labelled a likely sponsor. Use the same rule as resolveSponsorship.
  if (signal.status === "UNKNOWN" && hasSponsorHistory(recentFilings(filings, job.companyName, employerOverride)))
    signal = { status: "LIKELY_HISTORY", evidence: null, evidenceSource: "DOL / USCIS employer history" };
  return { ...job, sponsorship: signal.status, sponsorshipEvidence: signal.evidence, evidenceSource: signal.evidenceSource };
}
// Avoid duplicate on-demand runs for the same user. Scheduled runs can be retried after failure.
const inFlight = new Set<string>();
export async function refreshUser(uid: string, options: { includeHn?: boolean; companyId?: string } = {}) {
  if (inFlight.has(uid)) throw new Error("A refresh is already running for this account");
  inFlight.add(uid);
  const startedAt = iso();
  let added = 0, updated = 0, closed = 0;
  const errors: string[] = [];
  try {
    const all = await store.listCompanies(uid);
    const companies = all.filter(c => c.active && (!options.companyId || c.id === options.companyId));
    const filingCache = new Map<string, VisaFiling[]>();
    async function filingsFor(name: string, override?: string | null) {
      const key = `${name}::${override || ""}`;
      if (!filingCache.has(key)) filingCache.set(key, await store.filingsForCompany(name, override));
      return filingCache.get(key)!;
    }
    for (let i = 0; i < companies.length; i += 3) {
      await Promise.all(companies.slice(i, i + 3).map(async co => {
        try {
          const postings = await fetchBoard(co.atsType, co.boardSlug);
          const seen = new Set<string>();
          for (const raw of postings) {
            const input = await sponsorshipFor(postingToJob(raw, co), await filingsFor(co.name, co.employerOverride), co.employerOverride);
            seen.add(input.canonicalKey);
            const result = await store.upsertJob(uid, input);
            if (result.created) added++; else updated++;
          }
          closed += await store.closeMissing(uid, "COMPANY_BOARD", [...seen], co.id);
          await store.updateCompany(uid, co.id, { lastFetchedAt: iso(), lastError: null });
        } catch (e) {
          const message = `${co.name}: ${e instanceof Error ? e.message : "Source unavailable"}`;
          errors.push(message);
          await store.updateCompany(uid, co.id, { lastError: message });
          // An unavailable source must NEVER close previously verified jobs.
        }
      }));
    }
    if (options.includeHn !== false && !options.companyId) {
      try {
        const thread = await fetchLatestHnThread();
        const seen: string[] = [];
        for (const job of thread.jobs) {
          const input = await sponsorshipFor(job, await filingsFor(job.companyName));
          seen.push(input.canonicalKey);
          const result = await store.upsertJob(uid, input);
          if (result.created) added++; else updated++;
        }
        if (thread.complete) closed += await store.closeMissing(uid, "HN_HIRING", seen, undefined, thread.url);
        else errors.push("HN: partial thread fetch; closing skipped");
      } catch (e) { errors.push(`HN: ${e instanceof Error ? e.message : "Source unavailable"}`); }
    }
    const result: Omit<SourceRun, "id" | "userId"> = { startedAt, endedAt: iso(), added, updated, closed, errors };
    return await store.recordRun(uid, result);
  } finally { inFlight.delete(uid); }
}
