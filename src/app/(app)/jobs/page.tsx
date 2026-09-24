"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Search, SlidersHorizontal, RotateCw, X, ChevronLeft, ChevronRight, BriefcaseBusiness, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Job, SourceRun } from "@/lib/types";
import { request } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { JobCard } from "@/components/jobs/job-card";
import { LoadingCards } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeading } from "@/components/layout/page-heading";
type Feed = { jobs: Job[]; total: number; pages: number; page: number; facets: { companies: string[]; batches: string[]; departments: string[] }; lastRun: SourceRun | null; demo: boolean };
function FeedPage() {
  const router = useRouter(), params = useSearchParams(); const query = params.toString();
  const [data, setData] = useState<Feed | null>(null), [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false), [search, setSearch] = useState(params.get("q") || "");
  const load = useCallback(async () => { setLoading(true); try { setData(await request<Feed>(`/api/jobs?${query}`)); } catch (e) { toast.error(e instanceof Error ? e.message : "Unable to load jobs"); } finally { setLoading(false); } }, [query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSearch(params.get("q") || ""); }, [query, params]);
  function set(key: string, value: string | boolean) {
    const next = new URLSearchParams(query);
    if (value === "" || value === false) next.delete(key); else next.set(key, String(value));
    if (key !== "page") next.delete("page");
    router.replace(`/jobs${next.toString() ? `?${next}` : ""}`, { scroll: false });
  }
  useEffect(() => {
    const term = (params.get("q") || "");
    if (search === term) return;
    const timer = setTimeout(() => set("q", search.trim()), 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  async function refresh() {
    setRefreshing(true);
    try { const { run } = await request<{ run: SourceRun }>("/api/jobs/refresh", { method: "POST", body: "{}" });
      if (run.errors.length) toast.warning(`${run.errors.length} sources unavailable. Existing jobs were kept.`);
      else toast.success(`${run.added} new job${run.added === 1 ? "" : "s"} found`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Refresh failed"); } finally { setRefreshing(false); }
  }
  const hasFilters = [...params.keys()].some(k => !["page"].includes(k));
  return <div><PageHeading eyebrow="THE OPPORTUNITY DESK" title="Job feed" description="Real openings, straight from company career boards, YC startups, and the people hiring on Hacker News."
    action={<Button onClick={refresh} variant="outline" disabled={refreshing}><RotateCw size={15} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Checking sources…" : "Refresh feed"}</Button>} />
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search size={18} className="absolute left-3.5 top-3 text-muted-foreground" /><Input aria-label="Search jobs" placeholder="Search roles, companies, skills…" value={search} onChange={e => setSearch(e.target.value)} className="h-11 bg-card pl-11 shadow-soft" />{search && <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"><X size={16} /></button>}</div>
      <div className="flex gap-2"><Button variant={params.get("friendly") === "true" ? "secondary" : "outline"} className="flex-1 sm:flex-none" onClick={() => set("friendly", params.get("friendly") !== "true")}><Sparkles size={15} /> Sponsorship-friendly</Button><Button variant="outline" className="flex-1 lg:hidden" onClick={() => setFiltersOpen(v => !v)}><SlidersHorizontal size={15} /> Filters {hasFilters ? "•" : ""}</Button></div></div>
    <div className="grid items-start gap-5 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[254px_minmax(0,1fr)]">
      <aside className={`${filtersOpen ? "block" : "hidden"} surface p-5 lg:sticky lg:top-24 lg:block`}><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-sm font-bold">Filters</h2>{hasFilters && <button onClick={() => { setSearch(""); router.replace("/jobs"); }} className="text-[11px] font-bold text-primary hover:underline">Clear all</button>}</div>
        <div className="space-y-4">
          <div><label htmlFor="f-company" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">COMPANY</label><Select id="f-company" value={params.get("company") || ""} onChange={e => set("company", e.target.value)}><option value="">All companies</option>{data?.facets.companies.map(x => <option key={x} value={x}>{x}</option>)}</Select></div>
          <div><label htmlFor="f-source" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">SOURCE</label><Select id="f-source" value={params.get("source") || ""} onChange={e => set("source", e.target.value)}><option value="">All sources</option><option value="COMPANY_BOARD">Company boards</option><option value="YC_STARTUP">YC startups</option><option value="HN_HIRING">HN Hiring</option></Select></div>
          <div><label htmlFor="f-batch" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">YC BATCH</label><Select id="f-batch" value={params.get("batch") || ""} onChange={e => set("batch", e.target.value)}><option value="">Any batch</option>{data?.facets.batches.map(x => <option key={x} value={x}>{x}</option>)}</Select></div>
          <div><label htmlFor="f-size" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">COMPANY SIZE</label><Select id="f-size" value={params.get("size") || ""} onChange={e => set("size", e.target.value)}><option value="">Any size</option><option value="small">1–50 people</option><option value="medium">51–200 people</option><option value="large">200+ people</option></Select></div>
          <div><label htmlFor="f-location" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">LOCATION</label><div className="relative"><MapPin size={14} className="absolute left-3 top-3 text-muted-foreground" /><Input id="f-location" placeholder="City or region" className="pl-9" key={params.get("location") || ""} defaultValue={params.get("location") || ""} onBlur={e => set("location", e.target.value.trim())} onKeyDown={e => { if (e.key === "Enter") set("location", e.currentTarget.value.trim()); }} /></div></div>
          <div><label htmlFor="f-workplace" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">WORK MODE</label><Select id="f-workplace" value={params.get("workplace") || ""} onChange={e => set("workplace", e.target.value)}><option value="">Any work mode</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ONSITE">On-site</option></Select></div>
          <div><label htmlFor="f-dept" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">DEPARTMENT</label><Select id="f-dept" value={params.get("department") || ""} onChange={e => set("department", e.target.value)}><option value="">Any department</option>{data?.facets.departments.map(x => <option key={x} value={x}>{x}</option>)}</Select></div>
          <div><label htmlFor="f-days" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">DATE POSTED</label><Select id="f-days" value={params.get("days") || ""} onChange={e => set("days", e.target.value)}><option value="">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select></div>
          <div><label htmlFor="f-visa" className="mb-1.5 block text-[11px] font-bold text-muted-foreground">H-1B SPONSORSHIP</label><Select id="f-visa" value={params.get("sponsorship") || ""} onChange={e => set("sponsorship", e.target.value)}><option value="">Any status</option><option value="SPONSORS_STATED">Sponsors · stated</option><option value="LIKELY_HISTORY">Likely · history</option><option value="NO_SPONSORSHIP_STATED">No sponsorship · stated</option><option value="UNKNOWN">Unknown</option></Select></div>
          <div className="flex items-center justify-between border-t border-border pt-4"><label htmlFor="saved-switch" className="text-xs font-semibold">Saved only</label><Switch id="saved-switch" checked={params.get("saved") === "true"} onCheckedChange={v => set("saved", v)} /></div>
        </div>
      </aside>
      <section aria-label="Job results"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-baseline gap-2"><h2 className="font-display text-[17px] font-bold">Open roles</h2><span className="text-[12px] text-muted-foreground">{data ? `${data.total} results` : "Loading…"}</span></div><span className="text-[11px] text-muted-foreground">Newest first</span></div>
        {data && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[#4db98c]" />{data.demo ? "Verified snapshot · checked Sep 23, 2026 (not live in this preview)" : data.lastRun ? `Last checked ${formatDistanceToNow(new Date(data.lastRun.endedAt || data.lastRun.startedAt), { addSuffix: true })}` : "Run a refresh to pull current postings from official sources"}{data.lastRun?.errors.length ? <span className="font-semibold text-amber-600">· {data.lastRun.errors.length} source(s) unavailable</span> : null}</div>}
        {loading ? <LoadingCards count={5} /> : !data?.jobs.length ? <EmptyState icon={<BriefcaseBusiness size={24} />} title="No roles match just yet" description={hasFilters ? "Try clearing a filter or checking another location. New opportunities arrive with every refresh." : "Start by tracking a company career board, or refresh to check official sources."} action={<Button asChild size="sm"><Link href={hasFilters ? "/jobs" : "/companies"}>{hasFilters ? "Clear filters" : "Track a company"}<ChevronRight size={15} /></Link></Button>} /> : <div className="space-y-3">{data.jobs.map(job => <JobCard key={job.id} job={job} />)}</div>}
        {data && data.pages > 1 && <div className="mt-6 flex items-center justify-between"><span className="text-xs text-muted-foreground">Page {data.page} of {data.pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => set("page", String(data.page - 1))}><ChevronLeft size={15} /> Previous</Button><Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => set("page", String(data.page + 1))}>Next <ChevronRight size={15} /></Button></div></div>}
      </section>
    </div>
  </div>;
}
export default function Page() { return <Suspense fallback={<LoadingCards count={5} />}><FeedPage /></Suspense>; }
