/** Pure helpers for scripts/fetch-h1b.ts: find the newest official file links on an agency page. */
export const OFFICIAL_HOSTS = ["www.dol.gov", "dol.gov", "www.uscis.gov", "uscis.gov"];
export type FileLink = { url: string; fiscalYear: number; quarter: number };
export function isOfficial(url: string) {
  try { const u = new URL(url); return u.protocol === "https:" && OFFICIAL_HOSTS.includes(u.hostname.toLowerCase()); } catch { return false; }
}
/**
 * Extracts links matching `pattern` (group 1 = fiscal year, optional group 2 = quarter) from a page,
 * keeps official hosts only, and returns the newest files covering the last `fiscalYears` years.
 */
export function discoverLinks(html: string, pageUrl: string, pattern: string, fiscalYears: number, maxFiles: number): FileLink[] {
  const re = new RegExp(pattern, "gi");
  const found = new Map<string, FileLink>();
  for (const href of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = href[1].replace(/&amp;/g, "&");
    re.lastIndex = 0;
    const m = re.exec(decodeURI(raw));
    if (!m) continue;
    let url: string;
    try { url = new URL(raw, pageUrl).toString(); } catch { continue; }
    if (!isOfficial(url)) continue;
    found.set(url, { url, fiscalYear: Number(m[1]), quarter: Number(m[2] || 0) });
  }
  const links = [...found.values()].sort((a, b) => b.fiscalYear - a.fiscalYear || b.quarter - a.quarter);
  if (!links.length) return [];
  const newest = links[0].fiscalYear;
  return links.filter(l => l.fiscalYear > newest - fiscalYears).slice(0, maxFiles);
}
export function fileNameFor(url: string) { return decodeURIComponent(new URL(url).pathname.split("/").pop() || "download").replace(/[^\w.-]+/g, "_"); }
