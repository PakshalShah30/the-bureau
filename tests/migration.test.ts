import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("applies the PostgreSQL migration with all expected tables and unique constraints", async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync("prisma/migrations/20260923000000_init/migration.sql", "utf8"));
    const result = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    expect(result.rows.map(r => r.tablename)).toEqual(expect.arrayContaining(["User", "Account", "TrackedCompany", "Job", "SavedJob", "Application", "Resume", "VisaFiling", "SourceRun"]));
    const indexes = await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'Job'");
    expect(indexes.rows.map(r => r.indexname)).toContain("Job_userId_canonicalKey_key");
  } finally { await db.close(); }
});
