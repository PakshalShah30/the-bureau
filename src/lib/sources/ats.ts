import { htmlToText } from "html-to-text";
import he from "he";
import { sourceJson } from "./http";
import type { AtsType, Company, JobInput, Workplace } from "../types";
import { jobKey } from "../urls";

export type RawPosting = Pick<JobInput, "title" | "externalId" | "originalUrl" | "description" | "department" | "location" | "workplace" | "postedAt">;
export function toPlain(input: string | undefined | null): string {
  if (!input) return "";
  return htmlToText(he.decode(he.decode(input)), { wordwrap: false, selectors: [{ selector: "a", options: { ignoreHref: true } }, { selector: "img", format: "skip" }] }).replace(/\n{3,}/g, "\n\n").trim().slice(0, 80_000);
}
function date(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function mode(text: string): Workplace {
  if (/hybrid/i.test(text)) return "HYBRID";
  if (/remote/i.test(text)) return "REMOTE";
  if (/on.?site|in.?office/i.test(text)) return "ONSITE";
  return "UNSPECIFIED";
}
export function boardUrl(type: AtsType, slug: string) {
  if (!slug.trim() || slug.length > 120 || /[/\\?#]/.test(slug)) throw new Error("Invalid board slug");
  const s = encodeURIComponent(slug.trim());
  switch (type) {
    case "GREENHOUSE": return `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`;
    case "LEVER": return `https://api.lever.co/v0/postings/${s}?mode=json`;
    case "ASHBY": return `https://api.ashbyhq.com/posting-api/job-board/${s}`;
    case "WORKABLE": return `https://apply.workable.com/api/v1/widget/accounts/${s}?details=true`;
  }
}
function validatePostings(type: AtsType, count: number, postings: RawPosting[]) {
  // A partial or changed response must never be mistaken for jobs disappearing.
  if (count !== postings.length) throw new Error(`${type} returned incomplete job records; closing skipped`);
  for (const job of postings) {
    let url: URL;
    try { url = new URL(job.originalUrl); } catch { throw new Error(`${type} returned an invalid original URL`); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || !host.includes(".") ||
        /(?:linkedin|indeed|glassdoor|ziprecruiter|wellfound|workatastartup|hnwork)\./i.test(host) ||
        (type === "ASHBY" && host !== "jobs.ashbyhq.com") ||
        (type === "LEVER" && host !== "jobs.lever.co") ||
        (type === "WORKABLE" && host !== "apply.workable.com"))
      throw new Error(`${type} returned a non-company application URL; closing skipped`);
  }
  return postings;
}
export async function fetchBoard(type: AtsType, slug: string): Promise<RawPosting[]> {
  const data = await sourceJson<unknown>(boardUrl(type, slug));
  if (type === "GREENHOUSE") {
    const jobs = (data as { jobs?: Array<Record<string, unknown>> }).jobs;
    if (!Array.isArray(jobs)) throw new Error("Greenhouse board not found");
    return validatePostings(type, jobs.length, jobs.filter(j => j.id && j.title && j.absolute_url).map(j => ({
      title: String(j.title), externalId: String(j.id), originalUrl: String(j.absolute_url),
      description: toPlain(j.content as string), department: (j.departments as Array<{ name: string }> | undefined)?.[0]?.name || null,
      location: (j.location as { name?: string } | undefined)?.name || null,
      workplace: mode(String((j.location as { name?: string } | undefined)?.name || "") + " " + toPlain(j.content as string).slice(0, 350)),
      // first_published is the actual publication date. updated_at is NOT a posted date.
      postedAt: date(j.first_published as string),
    })));
  }
  if (type === "LEVER") {
    if (!Array.isArray(data)) throw new Error("Lever board not found");
    return validatePostings(type, (data as Array<Record<string, unknown>>).length, (data as Array<Record<string, unknown>>).filter(j => j.id && j.text && j.hostedUrl).map(j => {
      const cats = j.categories as { team?: string; location?: string } | undefined;
      return { title: String(j.text), externalId: String(j.id), originalUrl: String(j.hostedUrl),
        description: toPlain([j.descriptionPlain || j.description, ...((j.lists as Array<{ text: string; content: string }> | undefined) || []).map(x => `${x.text}\n${toPlain(x.content)}`), j.additionalPlain].filter(Boolean).join("\n\n")),
        department: cats?.team || null, location: cats?.location || null,
        workplace: mode(String(j.workplaceType || "") + " " + (cats?.location || "")), postedAt: date(j.createdAt as number) };
    }));
  }
  if (type === "ASHBY") {
    const jobs = (data as { jobs?: Array<Record<string, unknown>> }).jobs;
    if (!Array.isArray(jobs)) throw new Error("Ashby board not found");
    const listed = jobs.filter(j => j.isListed !== false);
    return validatePostings(type, listed.length, listed.filter(j => j.id && j.title && j.jobUrl).map(j => ({
      title: String(j.title), externalId: String(j.id), originalUrl: String(j.jobUrl),
      description: toPlain((j.descriptionPlain || j.descriptionHtml) as string), department: (j.department as string) || null,
      location: (j.location as string) || null, workplace: mode(String(j.workplaceType || "") + " " + (j.isRemote ? "remote" : "")),
      postedAt: date(j.publishedAt as string),
    })));
  }
  const jobs = (data as { jobs?: Array<Record<string, unknown>> }).jobs;
  if (!Array.isArray(jobs)) throw new Error("Workable board not found");
  const seen = new Set<string>();
  if (jobs.some(j => !j.shortcode || !j.title)) throw new Error("Workable returned incomplete job records; closing skipped");
  const postings = jobs.filter(j => {
    const key = String(j.shortcode);
    if (!j.shortcode || seen.has(key)) return false;
    seen.add(key); return !!j.title;
  }).map(j => ({ title: String(j.title), externalId: String(j.shortcode),
    originalUrl: String(j.url || `https://apply.workable.com/${encodeURIComponent(slug)}/j/${j.shortcode}`),
    description: toPlain(j.description as string), department: (j.department as string) || null,
    location: [j.city, j.country].filter(Boolean).join(", ") || null,
    workplace: j.telecommuting ? "REMOTE" as const : "UNSPECIFIED" as const, postedAt: date(j.published_on as string) }));
  return validatePostings(type, postings.length, postings);
}
export async function testBoard(type: AtsType, slug: string) {
  const jobs = await fetchBoard(type, slug);
  return { count: jobs.length, sample: jobs[0]?.title || null, url: boardUrl(type, slug) };
}
export function postingToJob(raw: RawPosting, company: Company): JobInput {
  return { ...raw, companyId: company.id, companyName: company.name,
    source: company.ycBatch ? "YC_STARTUP" : "COMPANY_BOARD", atsType: company.atsType,
    canonicalKey: jobKey(raw.originalUrl), sourceUrl: company.ycUrl || company.careersUrl || boardUrl(company.atsType, company.boardSlug),
    hnUrl: null, ycBatch: company.ycBatch, companySize: company.teamSize,
    sponsorship: "UNKNOWN", sponsorshipEvidence: null, evidenceSource: null };
}
