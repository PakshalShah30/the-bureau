import { Badge } from "@/components/ui/badge";
import type { JobSource, Sponsorship } from "@/lib/types";
import { Check, CircleHelp, History, ShieldAlert, Sparkles } from "lucide-react";
export function SourceBadge({ source, batch }: { source: JobSource; batch?: string | null }) {
  return <Badge className={source === "YC_STARTUP" ? "source-yc" : source === "HN_HIRING" ? "source-hn" : "source-board"}>
    {source === "YC_STARTUP" ? <><span className="font-bold">Y</span> YC Startup{batch ? ` · ${batch}` : ""}</> : source === "HN_HIRING" ? <>↗ HN Hiring</> : <>◈ Company Board</>}
  </Badge>;
}
const labels: Record<Sponsorship, string> = { SPONSORS_STATED: "Sponsors · stated", NO_SPONSORSHIP_STATED: "No sponsorship · stated", LIKELY_HISTORY: "Likely sponsors · history", UNKNOWN: "Sponsorship unknown" };
export function SponsorBadge({ status, compact = false, evidenceSource }: { status: Sponsorship; compact?: boolean; evidenceSource?: string | null }) {
  const sample = status === "LIKELY_HISTORY" && !!evidenceSource?.startsWith("Illustrative");
  const Icon = status === "SPONSORS_STATED" ? Check : status === "NO_SPONSORSHIP_STATED" ? ShieldAlert : status === "LIKELY_HISTORY" ? History : CircleHelp;
  const color = status === "SPONSORS_STATED" ? "sponsor-yes" : status === "NO_SPONSORSHIP_STATED" ? "sponsor-no" : status === "LIKELY_HISTORY" ? "sponsor-likely" : "sponsor-unknown";
  return <Badge className={color} title={sample ? `${labels[status]} (illustrative sample data, not government records)` : labels[status]}><Icon size={12} strokeWidth={2.3} />{compact && status === "UNKNOWN" ? "Unknown" : labels[status]}{sample && <span className="ml-0.5 rounded bg-black/10 px-1 text-[9px] font-bold uppercase dark:bg-white/15">sample</span>}</Badge>;
}
export { labels as sponsorshipLabels };
export function VerifiedPill() { return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#19845b] dark:text-[#75d7aa]"><Sparkles size={13} /> First-party sources only</span>; }
export function SnapshotBadge({ at }: { at: string }) {
  const date = new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return <span title={`Saved preview copy checked on ${date}. It may have closed; refresh or open the company link to confirm.`} className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">Snapshot · {date}</span>;
}
