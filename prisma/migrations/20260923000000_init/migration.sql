-- Initial PostgreSQL schema for The Bureau. Generated from prisma/schema.prisma.
CREATE TYPE "AtsType" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'WORKABLE');
CREATE TYPE "JobSource" AS ENUM ('COMPANY_BOARD', 'YC_STARTUP', 'HN_HIRING');
CREATE TYPE "Workplace" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNSPECIFIED');
CREATE TYPE "Sponsorship" AS ENUM ('SPONSORS_STATED', 'NO_SPONSORSHIP_STATED', 'LIKELY_HISTORY', 'UNKNOWN');
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEWING', 'OFFER', 'REJECTED');
CREATE TYPE "FilingSource" AS ENUM ('DOL_LCA', 'USCIS');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVisitedAt" TIMESTAMP(3),
    "humanizationIntensity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "humanizerKey" TEXT,
    "detectorKey" TEXT,
    "humanizerUrl" TEXT,
    "detectorUrl" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Account" (
    "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL, "refresh_token" TEXT, "access_token" TEXT,
    "expires_at" INTEGER, "token_type" TEXT, "scope" TEXT, "id_token" TEXT, "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider", "providerAccountId")
);
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL, "userId" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionToken")
);
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL, "token" TEXT NOT NULL, "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "token")
);
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

CREATE TABLE "TrackedCompany" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
    "atsType" "AtsType" NOT NULL, "boardSlug" TEXT NOT NULL,
    "careersUrl" TEXT, "website" TEXT, "ycBatch" TEXT, "ycUrl" TEXT,
    "industry" TEXT, "teamSize" INTEGER, "employerOverride" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" TIMESTAMP(3), "lastError" TEXT,
    CONSTRAINT "TrackedCompany_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrackedCompany_userId_atsType_boardSlug_key" ON "TrackedCompany"("userId", "atsType", "boardSlug");
CREATE INDEX "TrackedCompany_userId_name_idx" ON "TrackedCompany"("userId", "name");

CREATE TABLE "Job" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "companyId" TEXT,
    "companyName" TEXT NOT NULL, "title" TEXT NOT NULL,
    "source" "JobSource" NOT NULL, "atsType" "AtsType", "externalId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL, "canonicalKey" TEXT NOT NULL, "sourceUrl" TEXT, "hnUrl" TEXT,
    "description" TEXT NOT NULL, "department" TEXT, "location" TEXT,
    "workplace" "Workplace" NOT NULL DEFAULT 'UNSPECIFIED',
    "ycBatch" TEXT, "companySize" INTEGER, "postedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "sponsorship" "Sponsorship" NOT NULL DEFAULT 'UNKNOWN',
    "sponsorshipEvidence" TEXT, "evidenceSource" TEXT,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Job_userId_canonicalKey_key" ON "Job"("userId", "canonicalKey");
CREATE INDEX "Job_userId_source_closedAt_postedAt_idx" ON "Job"("userId", "source", "closedAt", "postedAt");
CREATE INDEX "Job_userId_companyId_idx" ON "Job"("userId", "companyId");

CREATE TABLE "SavedJob" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "jobId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '', "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedJob_jobId_key" ON "SavedJob"("jobId");
CREATE INDEX "SavedJob_userId_idx" ON "SavedJob"("userId");

CREATE TABLE "Resume" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
    "content" TEXT NOT NULL, "filename" TEXT, "mimeType" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1, "parentId" TEXT, "jobId" TEXT,
    "atsScore" INTEGER, "aiLikelihood" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Resume_userId_createdAt_idx" ON "Resume"("userId", "createdAt");

CREATE TABLE "Application" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "jobId" TEXT,
    "title" TEXT NOT NULL, "companyName" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "appliedAt" TIMESTAMP(3), "followUpAt" TIMESTAMP(3), "resumeId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");
CREATE INDEX "Application_userId_followUpAt_idx" ON "Application"("userId", "followUpAt");

CREATE TABLE "VisaFiling" (
    "id" TEXT NOT NULL, "externalKey" TEXT NOT NULL,
    "source" "FilingSource" NOT NULL, "sourceUrl" TEXT NOT NULL,
    "employerName" TEXT NOT NULL, "employerNormalized" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL, "title" TEXT, "worksite" TEXT,
    "wage" DOUBLE PRECISION, "approvals" INTEGER, "denials" INTEGER,
    CONSTRAINT "VisaFiling_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VisaFiling_externalKey_key" ON "VisaFiling"("externalKey");
CREATE INDEX "VisaFiling_employerNormalized_fiscalYear_idx" ON "VisaFiling"("employerNormalized", "fiscalYear");

CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3), "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0, "closed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "SourceRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceRun_userId_startedAt_idx" ON "SourceRun"("userId", "startedAt");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrackedCompany" ADD CONSTRAINT "TrackedCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "TrackedCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedJob" ADD CONSTRAINT "SavedJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceRun" ADD CONSTRAINT "SourceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
