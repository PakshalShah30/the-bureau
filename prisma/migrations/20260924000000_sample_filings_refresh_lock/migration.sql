-- Labelled illustrative H-1B rows (removed automatically by the government importer).
ALTER TABLE "VisaFiling" ADD COLUMN "isSample" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "VisaFiling_isSample_idx" ON "VisaFiling"("isSample");
-- Cross-instance refresh lease so two servers never refresh the same user at once.
ALTER TABLE "User" ADD COLUMN "refreshLockedUntil" TIMESTAMP(3);
