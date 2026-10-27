/**
 * Downloads the newest official H-1B files and imports them:
 *   - DOL OFLC LCA disclosure data (quarterly .xlsx) for the last 3 fiscal years
 *   - USCIS H-1B Employer Data Hub exports (.csv) for the last 3 fiscal years
 * then deletes the illustrative sample rows. Files are cached in data/h1b/ (git-ignored).
 *   npm run h1b:fetch                 # discover, download, import
 *   npm run h1b:fetch -- --dry-run    # only list what would be downloaded
 * Links are found on the agencies' own pages (scripts/h1b-sources.json); only dol.gov and uscis.gov are fetched.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebStream } from "node:stream/web";
import { discoverLinks, fileNameFor, isOfficial, type FileLink } from "../src/lib/h1b-fetch";

type Source = { page: string; linkPattern: string; fiscalYears: number; maxFiles: number };
const config = JSON.parse(readFileSync(join(__dirname, "h1b-sources.json"), "utf8")) as { lca: Source; uscis: Source; overrides: { lca: string[]; uscis: string[] } };
const DIR = join(process.cwd(), "data", "h1b");
const MAX_BYTES = 2_500_000_000;
const UA = { "User-Agent": "TheBureau/1.0 (personal career tracker; H-1B public data import)" };

async function officialFetch(url: string, init: RequestInit = {}) {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    if (!isOfficial(current)) throw new Error(`Refusing non-government URL: ${current}`);
    const res = await fetch(current, { ...init, redirect: "manual", headers: { ...UA, ...init.headers }, signal: AbortSignal.timeout(30 * 60_000) });
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get("location")) { current = new URL(res.headers.get("location")!, current).toString(); continue; }
    if (!res.ok) throw new Error(`${new URL(current).hostname}: HTTP ${res.status} for ${current}`);
    return res;
  }
  throw new Error(`Too many redirects for ${url}`);
}
async function discover(kind: "lca" | "uscis"): Promise<FileLink[]> {
  if (config.overrides[kind].length) return config.overrides[kind].map(url => ({ url, fiscalYear: 0, quarter: 0 }));
  const source = config[kind];
  const html = await (await officialFetch(source.page)).text();
  const links = discoverLinks(html, source.page, source.linkPattern, source.fiscalYears, source.maxFiles);
  if (!links.length) throw new Error(`${kind}: no files matched on ${source.page}. The agency may have renamed them: update linkPattern or overrides in scripts/h1b-sources.json.`);
  return links;
}
async function download(link: FileLink) {
  mkdirSync(DIR, { recursive: true });
  const target = join(DIR, fileNameFor(link.url));
  const res = await officialFetch(link.url);
  const size = Number(res.headers.get("content-length") || 0);
  if (size > MAX_BYTES) throw new Error(`${link.url} is larger than ${MAX_BYTES} bytes`);
  if (existsSync(target) && size && statSync(target).size === size) { await res.body?.cancel(); console.log(`cached  ${target}`); return target; }
  if (!res.body) throw new Error(`Empty response for ${link.url}`);
  const partial = `${target}.part`;
  let bytes = 0;
  const body = Readable.fromWeb(res.body as unknown as WebStream<Uint8Array>);
  body.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > MAX_BYTES) body.destroy(new Error("Download exceeded size limit")); });
  try { await pipeline(body, createWriteStream(partial)); }
  catch (e) { if (existsSync(partial)) unlinkSync(partial); throw e; }
  renameSync(partial, target);
  console.log(`saved   ${target} (${(bytes / 1e6).toFixed(1)} MB)`);
  return target;
}
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const plan = { lca: await discover("lca"), uscis: await discover("uscis") };
  for (const [kind, links] of Object.entries(plan)) for (const l of links) console.log(`${kind.padEnd(5)} FY${l.fiscalYear || "?"}${l.quarter ? ` Q${l.quarter}` : ""}  ${l.url}`);
  if (dryRun) return;
  if (!process.env.DATABASE_URL || process.env.DEMO_MODE === "true") throw new Error("h1b:fetch imports into PostgreSQL: set DATABASE_URL (use --dry-run to only list files)");
  const files = { lca: [] as string[], uscis: [] as string[] };
  for (const l of plan.lca) files.lca.push(await download(l));
  for (const l of plan.uscis) files.uscis.push(await download(l));
  const { importFiles, prisma } = await import("./import-h1b");
  try { await importFiles(files); } finally { await prisma.$disconnect(); }
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
