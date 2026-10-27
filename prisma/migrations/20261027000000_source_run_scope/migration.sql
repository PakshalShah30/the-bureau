-- "full" = every tracked board + HN; "company" = one board refreshed on demand.
-- The scheduler only counts full runs when deciding who is due for a refresh.
ALTER TABLE "SourceRun" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'full';
CREATE INDEX "SourceRun_userId_scope_startedAt_idx" ON "SourceRun"("userId", "scope", "startedAt");
