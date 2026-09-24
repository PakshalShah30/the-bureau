import { atsScore } from "./ai/ats";
import type { Job } from "./types";

/**
 * Score jobs against one resume with the same transparent skill match the
 * tailoring screen uses, then (optionally) sort best-fit first.
 *
 * Jobs whose excerpt names no known skills get `fit: null` and sink to the
 * bottom rather than being shown as a 0% match: "we can't tell" is not "bad fit".
 */
export function rankByFit(jobs: Job[], resume: string, options: { sort?: boolean; minFit?: number } = {}) {
  const scored = jobs.map(job => {
    const match = atsScore(resume, job.description);
    const fit = match.total ? { score: match.score, matched: match.matched.length, total: match.total, missingRequired: match.missingRequired.slice(0, 5) } : null;
    return { ...job, fit };
  });
  const filtered = options.minFit ? scored.filter(j => j.fit && j.fit.score >= options.minFit!) : scored;
  if (options.sort === false) return filtered;
  const time = (j: Job) => new Date(j.postedAt || j.firstSeenAt).getTime();
  return [...filtered].sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1) || time(b) - time(a));
}
