import { createHash } from "node:crypto";
export function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function canonicalUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid posting URL");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const name of [...url.searchParams.keys()]) {
    if (/^(utm_|gh_src|lever-source|source|ref|referrer|src)/i.test(name) || (name === "gh_jid" && /\/jobs\/\d+/.test(url.pathname))) url.searchParams.delete(name);
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  // Workable serves the same posting at /company/j/CODE and /j/CODE.
  if (url.hostname === "apply.workable.com") {
    const code = url.pathname.match(/(?:\/j\/)([A-Za-z0-9]+)/)?.[1];
    if (code) return `https://apply.workable.com/j/${code.toUpperCase()}`;
  }
  return url.toString().replace(/\/$/, "");
}
export function jobKey(url: string) { return hash(canonicalUrl(url)); }
