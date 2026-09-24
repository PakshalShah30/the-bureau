import { sourceFetch, sourceJson } from "./http";
import type { AtsType } from "../types";
import { lookup } from "node:dns/promises";
import { isPublicAddress } from "../network";

export interface YcCompany { name: string; slug: string; website: string | null; batch: string; industry: string | null; teamSize: number | null; ycUrl: string; }
type YcHit = { name: string; slug: string; website?: string; batch?: string; industry?: string; industries?: string[]; team_size?: number; isHiring?: boolean; status?: string };
export function displayBatch(batch: string) {
  const match = batch.match(/^([WSF])(\d{2})$/i);
  if (!match) return batch;
  return `${{ W: "Winter", S: "Summer", F: "Fall" }[match[1].toUpperCase() as "W" | "S" | "F"]} 20${match[2]}`;
}
export function shortBatch(batch: string) {
  return batch.replace(/^(Winter|Summer|Fall)\s+20(\d{2})$/i, (_, season: string, year: string) => `${season[0].toUpperCase()}${year}`);
}
let keyCache: { key: string; at: number } | null = null;
async function ycPublicKey() {
  if (process.env.YC_ALGOLIA_SEARCH_KEY) return process.env.YC_ALGOLIA_SEARCH_KEY;
  if (keyCache && Date.now() - keyCache.at < 3600000) return keyCache.key;
  const html = await (await sourceFetch("https://www.ycombinator.com/companies", {}, 3_000_000)).text();
  const match = html.match(/window\.AlgoliaOpts\s*=\s*({[^<]+})/);
  if (!match) throw new Error("YC directory search configuration changed; no third-party fallback is used");
  const options = JSON.parse(match[1]) as { app?: string; key?: string };
  if (options.app !== "45BWZJ1SGC" || !options.key) throw new Error("YC directory search configuration changed");
  keyCache = { key: options.key, at: Date.now() };
  return options.key;
}
export async function discoverYc(opts: { batch?: string; industry?: string; minSize?: number; maxSize?: number; page?: number }): Promise<{ companies: YcCompany[]; nextPage: number | null; total: number }> {
  const key = await ycPublicKey();
  // YC exposes hiring/batch/industries as facets; "status" is checked on each result.
  const facets = ["isHiring:true"];
  if (opts.batch) facets.push(`batch:${displayBatch(opts.batch)}`);
  if (opts.industry) facets.push(`industries:${opts.industry}`);
  const numerics: string[] = [];
  if (opts.minSize != null) numerics.push(`team_size>=${opts.minSize}`);
  if (opts.maxSize != null) numerics.push(`team_size<=${opts.maxSize}`);
  // Algolia stops returning results after 1,000: page through 32 per request and
  // require narrower filters beyond that cap rather than silently pretending completeness.
  const page = opts.page || 0, size = 32;
  const data = await sourceJson<{ hits: YcHit[]; nbHits: number }>("https://45bwzj1sgc-dsn.algolia.net/1/indexes/YCCompany_production/query", {
    method: "POST", headers: { "content-type": "application/json", "x-algolia-application-id": "45BWZJ1SGC", "x-algolia-api-key": key },
    body: JSON.stringify({ query: "", filters: facets.join(" AND "), numericFilters: numerics, hitsPerPage: size, page }),
  });
  if (!Array.isArray(data.hits)) throw new Error("YC search response changed");
  const companies = data.hits.filter(hit => hit.isHiring && hit.status === "Active" && hit.slug && hit.name && hit.batch).map(hit => ({
    name: hit.name, slug: hit.slug, website: hit.website || null, batch: shortBatch(hit.batch!),
    industry: hit.industry || hit.industries?.[0] || null, teamSize: hit.team_size || null,
    ycUrl: `https://www.ycombinator.com/companies/${encodeURIComponent(hit.slug)}`,
  }));
  const nextPage = (page + 1) * size < Math.min(data.nbHits, 1000) ? page + 1 : null;
  return { companies, nextPage, total: data.nbHits };
}

// Only crawl the company's own public careers page. Reject private networks/redirects (SSRF).
async function publicPage(url: string) {
  let current = new URL(url);
  for (let i = 0; i < 3; i++) {
    if (!(["http:", "https:"].includes(current.protocol)) || current.username || current.password || !["", "443", "80"].includes(current.port)) throw new Error("Unsafe careers URL");
    const addresses = await lookup(current.hostname, { all: true });
    if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Private careers URL");
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(7000), headers: { "User-Agent": "TheBureau/1.0" } });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Missing redirect target");
      current = new URL(location, current); continue;
    }
    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) return "";
    if (Number(res.headers.get("content-length") || 0) > 550_000) return "";
    const text = await res.text();
    return text.slice(0, 550_000);
  }
  return "";
}
export function detectAtsInHtml(html: string): { type: AtsType; slug: string; careersUrl: string } | null {
  const decoded = html.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const patterns: Array<[AtsType, RegExp]> = [
    ["ASHBY", /https?:\/\/jobs\.ashbyhq\.com\/([a-z\d._%+-]+)/i],
    ["GREENHOUSE", /https?:\/\/(?:job-boards|boards)\.greenhouse\.io\/([a-z\d._%+-]+)/i],
    ["LEVER", /https?:\/\/jobs\.lever\.co\/([a-z\d._%+-]+)/i],
    ["WORKABLE", /https?:\/\/apply\.workable\.com\/([a-z\d._%+-]+)\//i],
  ];
  for (const [type, re] of patterns) {
    const match = decoded.match(re);
    if (match) return { type, slug: decodeURIComponent(match[1]), careersUrl: match[0] };
  }
  return null;
}
export function boardMatchesYcCompany(company: Pick<YcCompany, "name" | "slug">, boardSlug: string) {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const board = clean(boardSlug);
  if (board.length < 4) return false;
  return [company.slug, company.name].map(clean).some(name => name.length >= 4 && (board.includes(name) || name.includes(board)));
}
export async function detectYcBoard(company: YcCompany) {
  if (!company.website) return null;
  try {
    const site = new URL(company.website);
    // Avoid fetching paths on unrelated domains; only these company site paths.
    for (const path of ["/careers", "/jobs", "/about/careers", "/"]) {
      const html = await publicPage(new URL(path, site.origin).toString());
      const detected = detectAtsInHtml(html);
      if (detected && boardMatchesYcCompany(company, detected.slug)) return detected;
      // An unrelated ATS link on a company's site is not proof of its own board.
    }
  } catch { /* No verified ATS: skip instead of inventing postings. */ }
  return null;
}
