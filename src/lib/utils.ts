import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Job, JobFilters } from "./types";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function id() { return crypto.randomUUID(); }
export function iso() { return new Date().toISOString(); }
export function filterJobs(jobs: Job[], f: JobFilters) {
  const term = f.q?.trim().toLowerCase();
  return jobs.filter(j => {
    if (!f.closed && j.closedAt) return false;
    if (f.saved && !j.saved) return false;
    if (term && !`${j.title} ${j.companyName} ${j.description} ${j.location || ""}`.toLowerCase().includes(term)) return false;
    if (f.company && !j.companyName.toLowerCase().includes(f.company.toLowerCase())) return false;
    if (f.location && !j.location?.toLowerCase().includes(f.location.toLowerCase())) return false;
    if (f.source && j.source !== f.source) return false;
    if (f.batch && j.ycBatch !== f.batch) return false;
    if (f.workplace && j.workplace !== f.workplace) return false;
    if (f.department && j.department?.toLowerCase() !== f.department.toLowerCase()) return false;
    if (f.sponsorship && j.sponsorship !== f.sponsorship) return false;
    if (f.friendly && !["SPONSORS_STATED", "LIKELY_HISTORY"].includes(j.sponsorship)) return false;
    if (f.days && (!j.postedAt || Date.now() - new Date(j.postedAt).getTime() > Number(f.days) * 86400000)) return false;
    if (f.size && (j.companySize == null || (f.size === "small" && j.companySize > 50) || (f.size === "medium" && (j.companySize <= 50 || j.companySize > 200)) || (f.size === "large" && j.companySize <= 200))) return false;
    return true;
  }).sort((a, b) => new Date(b.postedAt || b.firstSeenAt).getTime() - new Date(a.postedAt || a.firstSeenAt).getTime());
}
