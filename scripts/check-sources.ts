/**
 * Live connectivity check for every job source. Prints one PASS/FAIL line per source.
 *   npm run sources:check            # the 10 seed boards + HN + YC directory
 *   npm run sources:check -- --db    # every tracked board in PostgreSQL (DATABASE_URL)
 * Exit code 1 if any source fails, so it can gate a deploy or CI job.
 */
import { fetchBoard } from "../src/lib/sources/ats";
import { fetchLatestHnThread } from "../src/lib/sources/hn";
import { discoverYc } from "../src/lib/sources/yc";
import { demoCompanies } from "../src/lib/demo-fixtures";
import type { AtsType } from "../src/lib/types";

type Result = { source: string; ok: boolean; detail: string; ms: number };
async function timed(source: string, run: () => Promise<string>): Promise<Result> {
  const start = Date.now();
  try { return { source, ok: true, detail: await run(), ms: Date.now() - start }; }
  catch (e) {
    // Node's fetch hides the network reason (DNS, refused, TLS) in `cause`.
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${(e.cause as Error & { code?: string }).code || e.cause.message})` : "";
    return { source, ok: false, detail: (e instanceof Error ? e.message : String(e)) + cause, ms: Date.now() - start };
  }
}
async function boards(fromDb: boolean): Promise<Array<{ name: string; atsType: AtsType; boardSlug: string }>> {
  if (!fromDb) return demoCompanies;
  if (!process.env.DATABASE_URL) throw new Error("--db needs DATABASE_URL");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.trackedCompany.findMany({ where: { active: true }, select: { name: true, atsType: true, boardSlug: true } });
    // The same board can be tracked by several users; check it once.
    return [...new Map(rows.map(r => [`${r.atsType}:${r.boardSlug.toLowerCase()}`, r])).values()];
  } finally { await prisma.$disconnect(); }
}
async function main() {
  const list = await boards(process.argv.includes("--db"));
  const results: Result[] = [];
  for (let i = 0; i < list.length; i += 4) results.push(...await Promise.all(list.slice(i, i + 4).map(co =>
    timed(`${co.atsType.padEnd(10)} ${co.name} (${co.boardSlug})`, async () => {
      const jobs = await fetchBoard(co.atsType, co.boardSlug);
      const dated = jobs.filter(j => j.postedAt).length;
      return `${jobs.length} open postings, ${dated} with a posted date${jobs[0] ? ` · e.g. "${jobs[0].title}"` : ""}`;
    }))));
  results.push(await timed("HN         latest Who is Hiring? thread", async () => {
    const thread = await fetchLatestHnThread();
    return `${thread.title}: ${thread.jobs.length} parseable roles${thread.complete ? "" : " (partial fetch: closing would be skipped)"}`;
  }));
  results.push(await timed("YC         company directory (W25, hiring)", async () => {
    const found = await discoverYc({ batch: "W25" });
    return `${found.total} hiring companies in W25; first page returned ${found.companies.length}`;
  }));
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.source}  ${String(r.ms).padStart(5)} ms  ${r.detail}`);
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} sources reachable.`);
  if (failed) {
    console.log("A failing board keeps its existing jobs (nothing is closed). Check the slug in Companies, or the network/egress policy.");
    process.exitCode = 1;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
