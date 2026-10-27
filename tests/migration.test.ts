import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
it("applies every PostgreSQL migration in order with expected tables, columns and constraints", async () => {
  const db = new PGlite();
  try {
    for (const dir of readdirSync("prisma/migrations").filter(d => /^\d{14}_/.test(d)).sort())
      await db.exec(readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
    const result = await db.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    expect(result.rows.map(r => r.tablename)).toEqual(expect.arrayContaining(["User", "Account", "TrackedCompany", "Job", "SavedJob", "Application", "Resume", "VisaFiling", "SourceRun"]));
    const indexes = await db.query<{ indexname: string }>("SELECT indexname FROM pg_indexes WHERE tablename = 'Job'");
    expect(indexes.rows.map(r => r.indexname)).toContain("Job_userId_canonicalKey_key");
    const columns = await db.query<{ table_name: string; column_name: string }>("SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('isSample', 'refreshLockedUntil', 'scope') AND table_name <> 'Account'");
    expect(columns.rows.map(r => `${r.table_name}.${r.column_name}`).sort()).toEqual(["SourceRun.scope", "User.refreshLockedUntil", "VisaFiling.isSample"]);
    // Only full runs count toward the refresh schedule.
    await db.exec(`INSERT INTO "User" ("id", "email") VALUES ('u0', 'z@b.c');
      INSERT INTO "SourceRun" ("id", "userId", "startedAt") VALUES ('r1', 'u0', now() - interval '7 hours');
      INSERT INTO "SourceRun" ("id", "userId", "startedAt", "scope") VALUES ('r2', 'u0', now(), 'company');`);
    const due = await db.query<{ last: string }>(`SELECT max("startedAt") AS last FROM "SourceRun" WHERE "userId" = 'u0' AND "scope" = 'full'`);
    expect(Date.now() - new Date(due.rows[0].last).getTime()).toBeGreaterThan(6 * 3600_000);
    // Refresh lease: a second acquire fails until the first expires or is released.
    await db.exec(`INSERT INTO "User" ("id", "email") VALUES ('u1', 'a@b.c')`);
    const acquire = `UPDATE "User" SET "refreshLockedUntil" = now() + interval '10 minutes' WHERE "id" = 'u1' AND ("refreshLockedUntil" IS NULL OR "refreshLockedUntil" < now())`;
    expect((await db.query(acquire)).affectedRows).toBe(1);
    expect((await db.query(acquire)).affectedRows).toBe(0);
  } finally { await db.close(); }
}, 30_000);
