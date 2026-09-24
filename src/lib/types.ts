export type AtsType = "GREENHOUSE" | "LEVER" | "ASHBY" | "WORKABLE";
export type JobSource = "COMPANY_BOARD" | "YC_STARTUP" | "HN_HIRING";
export type Workplace = "REMOTE" | "HYBRID" | "ONSITE" | "UNSPECIFIED";
export type Sponsorship = "SPONSORS_STATED" | "NO_SPONSORSHIP_STATED" | "LIKELY_HISTORY" | "UNKNOWN";
export type ApplicationStatus = "SAVED" | "APPLIED" | "INTERVIEWING" | "OFFER" | "REJECTED";
export type Intensity = "LIGHT" | "MEDIUM" | "STRONG";

export interface Company {
  id: string; userId: string; name: string; atsType: AtsType; boardSlug: string;
  careersUrl: string | null; website: string | null; ycBatch: string | null; ycUrl: string | null;
  industry: string | null; teamSize: number | null; employerOverride: string | null;
  active: boolean; createdAt: string; lastFetchedAt: string | null; lastError: string | null;
}
export interface Job {
  id: string; userId: string; companyId: string | null; companyName: string; title: string;
  source: JobSource; atsType: AtsType | null; externalId: string; originalUrl: string;
  canonicalKey: string; sourceUrl: string | null; hnUrl: string | null;
  description: string; department: string | null; location: string | null; workplace: Workplace;
  ycBatch: string | null; companySize: number | null; postedAt: string | null;
  firstSeenAt: string; lastSeenAt: string; closedAt: string | null;
  sponsorship: Sponsorship; sponsorshipEvidence: string | null; evidenceSource: string | null;
  saved?: boolean;
}
export interface SavedJob {
  id: string; userId: string; jobId: string; notes: string; tags: string[]; createdAt: string;
  job?: Job;
}
export interface Application {
  id: string; userId: string; jobId: string | null; title: string; companyName: string;
  status: ApplicationStatus; appliedAt: string | null; followUpAt: string | null;
  resumeId: string | null; notes: string; createdAt: string; updatedAt: string;
  job?: Job | null;
}
export interface Resume {
  id: string; userId: string; name: string; content: string; filename: string | null;
  mimeType: string | null; version: number; parentId: string | null; jobId: string | null;
  atsScore: number | null; aiLikelihood: number | null; createdAt: string;
}
export interface VisaFiling {
  id: string; externalKey: string; source: "DOL_LCA" | "USCIS"; sourceUrl: string;
  employerName: string; employerNormalized: string; fiscalYear: number;
  title: string | null; worksite: string | null; wage: number | null;
  approvals: number | null; denials: number | null;
}
export interface SourceRun {
  id: string; userId: string; startedAt: string; endedAt: string | null;
  added: number; updated: number; closed: number; errors: string[];
}
export interface UserRecord {
  id: string; email: string; name: string | null; passwordHash: string | null;
  lastVisitedAt: string | null; humanizationIntensity: Intensity;
  humanizerKey: string | null; detectorKey: string | null; humanizerUrl: string | null; detectorUrl: string | null;
}
export type JobInput = Omit<Job, "id" | "userId" | "firstSeenAt" | "lastSeenAt" | "closedAt" | "saved">;
export type CompanyInput = Omit<Company, "id" | "userId" | "createdAt" | "lastFetchedAt" | "lastError">;
export type ApplicationInput = Pick<Application, "jobId" | "title" | "companyName" | "status" | "appliedAt" | "followUpAt" | "resumeId" | "notes">;
export type ResumeInput = Pick<Resume, "name" | "content" | "filename" | "mimeType" | "version" | "parentId" | "jobId" | "atsScore" | "aiLikelihood">;
export type JobFilters = {
  q?: string; company?: string; source?: string; batch?: string; size?: string;
  location?: string; workplace?: string; department?: string; days?: string;
  sponsorship?: string; friendly?: boolean; saved?: boolean; closed?: boolean;
};
