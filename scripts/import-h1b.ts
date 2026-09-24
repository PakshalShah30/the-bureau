/** Import official, locally downloaded DOL OFLC LCA / USCIS Employer Data Hub files. */
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { resolve } from "node:path";
import { parse } from "csv-parse";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { clean, lcaRow, uscisRow, type Row } from "../src/lib/h1b";
import type { VisaFiling } from "../src/lib/types";
const prisma = new PrismaClient();
async function* rows(file: string): AsyncGenerator<Row> {
  const path = resolve(file);
  if (/\.xlsx$/i.test(path)) {
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, { worksheets: "emit", sharedStrings: "cache", hyperlinks: "ignore", styles: "ignore" });
    for await (const sheet of reader) {
      let headers: string[] | null = null;
      for await (const row of sheet) {
        const cells = (row.values as unknown[]).slice(1).map(clean);
        if (!headers) { headers = cells; continue; }
        yield Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""]));
      }
    }
  } else if (/\.csv(\.gz)?$/i.test(path)) {
    const stream = createReadStream(path);
    const input = path.endsWith(".gz") ? stream.pipe(createGunzip()) : stream;
    const parser = input.pipe(parse({ columns: true, bom: true, skip_empty_lines: true, relax_column_count: true }));
    for await (const row of parser) yield row as Row;
  } else throw new Error("Use a government CSV, .csv.gz or .xlsx download");
}
async function importFile(file: string, kind: "lca" | "uscis") {
  let read = 0, accepted = 0, inserted = 0; const batch: VisaFiling[] = [];
  async function flush() {
    if (!batch.length) return;
    if (kind === "uscis") {
      // A later USCIS quarterly release can revise decisions; upsert counts instead of freezing them.
      for (const r of batch) await prisma.visaFiling.upsert({ where: { externalKey: r.externalKey },
        create: { ...r, source: "USCIS" }, update: { approvals: r.approvals, denials: r.denials, employerName: r.employerName, fiscalYear: r.fiscalYear } });
      inserted += batch.length;
    } else inserted += (await prisma.visaFiling.createMany({ data: batch.map(({ id: _id, ...r }) => r), skipDuplicates: true })).count;
    batch.length = 0;
  }
  for await (const raw of rows(file)) {
    read++;
    const result = kind === "lca" ? lcaRow(raw) : uscisRow(raw);
    if (result) { batch.push(result); accepted++; }
    if (batch.length >= 500) await flush();
    if (read % 50000 === 0) console.log(`${kind}: ${read.toLocaleString()} rows read, ${accepted.toLocaleString()} recent H-1B rows accepted…`);
  }
  if (!accepted) throw new Error(`${kind}: no recent H-1B records parsed from ${file}. Check the official download’s headers, fiscal years and file type.`);
  await flush(); console.log(`${kind}: read ${read}, accepted ${accepted}, inserted/updated ${inserted}`);
}
async function main() {
  if (!process.env.DATABASE_URL || process.env.DEMO_MODE === "true") throw new Error("Government import requires PostgreSQL mode");
  const args = process.argv.slice(2);
  if (!args.includes("--lca") && !args.includes("--uscis")) throw new Error("Usage: npm run h1b:import -- --lca path/to/DOL.xlsx --uscis path/to/USCIS.csv");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--lca" && args[i + 1]) await importFile(args[++i], "lca");
    else if (args[i] === "--uscis" && args[i + 1]) await importFile(args[++i], "uscis");
  }
  console.log("Refresh jobs to recompute sponsorship badges. Explicit job policies always override employer history.");
}
if (process.argv[1]?.endsWith("import-h1b.ts")) main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
