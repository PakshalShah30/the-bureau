import { htmlToText } from "html-to-text";
import he from "he";
import type { JobInput, Workplace } from "../types";
import { jobKey } from "../urls";
import { sourceJson } from "./http";

type HnItem = { id: number; type: string; title?: string; text?: string; time?: number; kids?: number[]; parent?: number; deleted?: boolean; dead?: boolean };
export interface HnThread { id: number; title: string; url: string; jobs: JobInput[]; complete: boolean }
export function parseHnComment(item: HnItem, threadId: number): JobInput | null {
  if (item.deleted || item.dead || item.type !== "comment" || item.parent !== threadId || !item.text || !item.time) return null;
  const text = htmlToText(he.decode(item.text), { wordwrap: false, selectors: [{ selector: "a", options: { ignoreHref: false } }] }).trim();
  const head = text.split(/\n|<p>/)[0].split("|").map(x => x.trim());
  if (head.length < 3) return null;
  const [company, role, location] = head;
  if (!company || !role || /^(we're hiring|multiple roles|various roles|hiring)$/i.test(role) || company.length > 90 || role.length > 120) return null;
  // A direct role-specific link is required to label the action "Apply on company site".
  // Ignore aggregators, personal blogs, and generic company homepages.
  const urls = [...new Set((item.text.match(/https?:\/\/[^\s<>"']+/g) || []).map(s => he.decode(s).replace(/[),.;]+$/, "")))];
  const apply = urls.find(raw => {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" || /(?:linkedin|indeed|glassdoor|ziprecruiter|wellfound|workatastartup|hnwork|github|news\.ycombinator)\./i.test(u.hostname)) return false;
      if (u.hostname === "jobs.ashbyhq.com" || u.hostname === "jobs.lever.co") return /^\/[^/]+\/[^/]{8,}/.test(u.pathname);
      if (u.hostname === "job-boards.greenhouse.io" || u.hostname === "boards.greenhouse.io") return /^\/[^/]+\/jobs\/\d+/.test(u.pathname);
      if (u.hostname === "apply.workable.com") return /^\/(?:j\/[A-Z\d]{8,}|[^/]+\/j\/[A-Z\d]{8,})/i.test(u.pathname);
      // Custom sites must also be plausibly the posting company's own domain.
      // An arbitrary job-board URL is not a first-party application link.
      const brand = company.toLowerCase().replace(/\.(io|com|ai)$/i, "").replace(/[^a-z0-9]/g, "");
      const domain = u.hostname.toLowerCase().replace(/^(?:www|jobs|careers|apply)\./, "").split(".").slice(0, -1).join("").replace(/[^a-z0-9]/g, "");
      if (brand.length < 4 || !domain.includes(brand)) return false;
      const path = u.pathname.toLowerCase();
      if (!/\/(?:careers|jobs|positions|apply)\/[^/?#]{8,}/i.test(path)) return false;
      const roleWords = role.toLowerCase().match(/[a-z]{4,}/g) || [];
      return roleWords.some(w => path.includes(w)) || /\d{4,}/.test(path);

    } catch { return false; }
  });
  if (!apply) return null;
  const upper = head.slice(2).join(" ").toUpperCase();
  const workplace: Workplace = upper.includes("HYBRID") ? "HYBRID" : upper.includes("REMOTE") ? "REMOTE" : upper.includes("ONSITE") ? "ONSITE" : "UNSPECIFIED";
  const hnUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  return { companyId: null, companyName: company.replace(/\.(io|com|ai)$/i, ""), title: role,
    source: "HN_HIRING", atsType: null, externalId: String(item.id), originalUrl: apply,
    canonicalKey: jobKey(apply), sourceUrl: `https://news.ycombinator.com/item?id=${threadId}`, hnUrl, description: text.slice(0, 80000),
    department: null, location: location || null, workplace, ycBatch: null, companySize: null,
    postedAt: new Date(item.time * 1000).toISOString(), sponsorship: "UNKNOWN", sponsorshipEvidence: null, evidenceSource: null };
}
export async function fetchLatestHnThread(): Promise<HnThread> {
  const query = new URLSearchParams({ query: "Ask HN: Who is hiring?", tags: "story", restrictSearchableAttributes: "title", hitsPerPage: "20" });
  const search = await sourceJson<{ hits: Array<{ objectID: string; title: string; created_at_i: number }> }>(`https://hn.algolia.com/api/v1/search_by_date?${query}`);
  const candidates = search.hits.filter(h => /^Ask HN: Who is hiring\? \([A-Za-z]+ 20\d{2}\)$/.test(h.title));
  const latest = candidates.sort((a, b) => b.created_at_i - a.created_at_i)[0];
  if (!latest) throw new Error("Latest monthly Who is hiring? thread not found");
  const threadId = Number(latest.objectID);
  const thread = await sourceJson<HnItem>(`https://hacker-news.firebaseio.com/v0/item/${threadId}.json`);
  if (!thread.kids) throw new Error("HN thread has no comments");
  const ids = thread.kids.slice(0, 1000); // never mark old jobs closed if thread exceeded our limit
  const results: Array<HnItem | null> = [];
  let failures = 0;
  for (let i = 0; i < ids.length; i += 12) {
    const batch = await Promise.all(ids.slice(i, i + 12).map(async id => {
      try { return await sourceJson<HnItem>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`); }
      catch { failures++; return null; }
    }));
    results.push(...batch);
  }
  const jobs = results.filter((x): x is HnItem => !!x).map(x => parseHnComment(x, threadId)).filter((x): x is JobInput => !!x);
  return { id: threadId, title: latest.title, url: `https://news.ycombinator.com/item?id=${threadId}`, jobs, complete: failures === 0 && ids.length === thread.kids.length };
}
