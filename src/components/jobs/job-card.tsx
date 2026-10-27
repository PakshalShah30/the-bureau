"use client";
import Link from "next/link";
import { Bookmark, ArrowUpRight, MapPin, Clock3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Job } from "@/lib/types";
import { companyColors, initials, request } from "@/lib/client";
import { SnapshotBadge, SourceBadge, SponsorBadge } from "./job-badges";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useState } from "react";
export function CompanyAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" | "sm" }) {
  const [bg, fg] = companyColors(name);
  return <span aria-hidden="true" style={{ "--company-bg": bg, "--company-fg": fg } as React.CSSProperties}
    className={cn("company-avatar flex shrink-0 items-center justify-center rounded-xl border border-current/5 font-display font-bold", size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm")}>{initials(name)}</span>;
}
export function JobCard({ job, compact = false, onSave }: { job: Job; compact?: boolean; onSave?: (saved: boolean) => void }) {
  const [saved, setSaved] = useState(!!job.saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSaved(!!job.saved); }, [job.saved]);
  async function toggleSave(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    const was = saved; setSaved(!was); setBusy(true);
    try {
      await request(`/api/saved${was ? `/${job.id}` : ""}`, { method: was ? "DELETE" : "POST", ...(!was ? { body: JSON.stringify({ jobId: job.id }) } : {}) });
      onSave?.(!was);
      toast.success(was ? "Removed from saved jobs" : "Job saved to your shortlist");
    } catch (err) { setSaved(was); toast.error(err instanceof Error ? err.message : "Could not update saved job"); }
    finally { setBusy(false); }
  }
  const days = job.postedAt ? formatDistanceToNow(new Date(job.postedAt), { addSuffix: true }) : "Date not published";
  return <article className={cn("card-hover relative rounded-2xl border border-border bg-card shadow-soft", compact ? "p-4 sm:p-5" : "p-5 sm:p-6")}>
    <div className="flex items-start gap-3.5 sm:gap-4">
      <CompanyAvatar name={job.companyName} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1 pr-8">
        <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-muted-foreground">{job.companyName}</span>{job.ycBatch && !compact && <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">✦ {job.ycBatch}</span>}</div>
        <Link href={`/jobs/${job.id}`} className="group/link mt-0.5 inline-flex items-center gap-1 font-display text-[16px] font-bold leading-snug tracking-tight hover:text-primary sm:text-[17px]">
          {job.title}<ArrowUpRight size={15} className="shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><MapPin size={13} />{job.location || "Location not specified"}{job.workplace !== "UNSPECIFIED" ? ` · ${job.workplace.toLowerCase()}` : ""}</span>
          <span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{job.postedAt ? `Posted ${days}` : days}</span>
        </div>
      </div>
      <button onClick={toggleSave} aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`} title={saved ? "Unsave job" : "Save job"} disabled={busy}
        className={cn("absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary", saved && "bg-accent text-primary")}>
        <Bookmark size={18} fill={saved ? "currentColor" : "none"} strokeWidth={1.8} />
      </button>
    </div>
    <div className={cn("flex flex-wrap items-center gap-2", compact ? "mt-3" : "mt-4 border-t border-border/70 pt-4")}>
      <SourceBadge source={job.source} batch={!compact ? job.ycBatch : null} />
      <SponsorBadge status={job.sponsorship} evidenceSource={job.evidenceSource} compact={compact} />
      {job.snapshotAt && <SnapshotBadge at={job.snapshotAt} />}
      {!!job.closedAt && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Closed</span>}
      {!compact && job.department && <span className="text-xs text-muted-foreground">{job.department}</span>}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold">
      <a href={job.originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Apply on company site <ArrowUpRight size={13} /></a>
      {job.hnUrl && <a href={job.hnUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary hover:underline">Original HN comment <ArrowUpRight size={13} /></a>}
    </div>
  </article>;
}
