import { Badge } from "@/components/ui/badge";
import type { JobSource, Sponsorship } from "@/lib/types";
import { Check, CircleHelp, History, ShieldAlert, Sparkles } from "lucide-react";
export function SourceBadge({ source, batch }: { source: JobSource; batch?: string | null }) {
  return <Badge className={source === "YC_STARTUP" ? "source-yc" : source === "HN_HIRING" ? "source-hn" : "source-board"}>
    {source === "YC_STARTUP" ? <><span className="font-bold">Y</span> YC Startup{batch ? ` · ${batch}` : ""}</> : source === "HN_HIRING" ? <>↗ HN Hiring</> : <>◈ Company Board</>}
  </Badge>;
}
const labels: Record<Sponsorship, string> = { SPONSORS_STATED: "Sponsors · stated", NO_SPONSORSHIP_STATED: "No sponsorship · stated", LIKELY_HISTORY: "Likely sponsors · history", UNKNOWN: "Sponsorship unknown" };
export function SponsorBadge({ status, compact = false }: { status: Sponsorship; compact?: boolean }) {
  const Icon = status === "SPONSORS_STATED" ? Check : status === "NO_SPONSORSHIP_STATED" ? ShieldAlert : status === "LIKELY_HISTORY" ? History : CircleHelp;
  const color = status === "SPONSORS_STATED" ? "sponsor-yes" : status === "NO_SPONSORSHIP_STATED" ? "sponsor-no" : status === "LIKELY_HISTORY" ? "sponsor-likely" : "sponsor-unknown";
  return <Badge className={color} title={labels[status]}><Icon size={12} strokeWidth={2.3} />{compact && status === "UNKNOWN" ? "Unknown" : labels[status]}</Badge>;
}
export { labels as sponsorshipLabels };
export function VerifiedPill() { return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#19845b] dark:text-[#75d7aa]"><Sparkles size={13} /> First-party sources only</span>; }
