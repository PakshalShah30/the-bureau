"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowUpRight, CalendarClock, Kanban, MoreHorizontal, Plus, Trash2, FileText } from "lucide-react";
import type { Application, ApplicationStatus, Job, Resume } from "@/lib/types";
import { request } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAvatar } from "@/components/jobs/job-card";
import { cn } from "@/lib/utils";
const stages: Array<{ key: ApplicationStatus; label: string; dot: string; bar: string }> = [
  { key: "SAVED", label: "Saved", dot: "bg-[#9e91e4]", bar: "bg-[#eeeafb] dark:bg-[#342d53]" },
  { key: "APPLIED", label: "Applied", dot: "bg-[#6a5bd6]", bar: "bg-[#eeeafd] dark:bg-[#312a55]" },
  { key: "INTERVIEWING", label: "Interviewing", dot: "bg-[#47adab]", bar: "bg-[#e5f6f3] dark:bg-[#254846]" },
  { key: "OFFER", label: "Offer", dot: "bg-[#58b881]", bar: "bg-[#e8f7ef] dark:bg-[#264636]" },
  { key: "REJECTED", label: "Rejected", dot: "bg-[#d99090]", bar: "bg-[#fbefef] dark:bg-[#493337]" },
];
const blank = { jobId: "", title: "", companyName: "", status: "SAVED" as ApplicationStatus, appliedAt: "", followUpAt: "", resumeId: "", notes: "" };
type Form = typeof blank;
export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[] | null>(null), [jobs, setJobs] = useState<Job[]>([]), [resumes, setResumes] = useState<Resume[]>([]);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<Application | null>(null), [form, setForm] = useState<Form>(blank), [busy, setBusy] = useState(false);
  async function load() {
    try { const [a, j, r] = await Promise.all([request<{ applications: Application[] }>("/api/applications"), request<{ jobs: Job[] }>("/api/jobs?limit=100"), request<{ resumes: Resume[] }>("/api/resumes")]); setApps(a.applications); setJobs(j.jobs); setResumes(r.resumes); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load applications"); }
  }
  useEffect(() => { load(); }, []);
  function start(app?: Application) {
    setEditing(app || null);
    setForm(app ? { jobId: app.jobId || "", title: app.title, companyName: app.companyName, status: app.status,
      appliedAt: app.appliedAt?.slice(0, 10) || "", followUpAt: app.followUpAt?.slice(0, 10) || "", resumeId: app.resumeId || "", notes: app.notes } : blank);
    setOpen(true);
  }
  function field<K extends keyof Form>(key: K, value: Form[K]) { setForm(v => ({ ...v, [key]: value })); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const body = { ...form, jobId: form.jobId || null, resumeId: form.resumeId || null,
      appliedAt: form.appliedAt ? new Date(`${form.appliedAt}T12:00:00Z`).toISOString() : null,
      followUpAt: form.followUpAt ? new Date(`${form.followUpAt}T12:00:00Z`).toISOString() : null };
    try {
      const result = await request<{ application: Application }>(editing ? `/api/applications/${editing.id}` : "/api/applications", { method: editing ? "PATCH" : "POST", body: JSON.stringify(body) });
      setApps(prev => editing ? prev?.map(a => a.id === editing.id ? result.application : a) || null : [result.application, ...(prev || [])]);
      setOpen(false); toast.success(editing ? "Application updated" : "Added to your pipeline");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save application"); } finally { setBusy(false); }
  }
  async function changeStatus(app: Application, status: ApplicationStatus) {
    if (status === app.status) return;
    const before = apps;
    setApps(prev => prev?.map(a => a.id === app.id ? { ...a, status } : a) || null);
    try { await request(`/api/applications/${app.id}`, { method: "PATCH", body: JSON.stringify({ status, appliedAt: status === "APPLIED" && !app.appliedAt ? new Date().toISOString() : app.appliedAt }) }); toast.success(`Moved to ${stages.find(s => s.key === status)?.label}`); }
    catch (e) { setApps(before); toast.error(e instanceof Error ? e.message : "Could not update status"); }
  }
  async function remove(app: Application) {
    if (!window.confirm(`Remove the ${app.companyName} application?`)) return;
    const before = apps; setApps(prev => prev?.filter(a => a.id !== app.id) || null); setOpen(false);
    try { await request(`/api/applications/${app.id}`, { method: "DELETE" }); toast.success("Application removed"); }
    catch (e) { setApps(before); toast.error(e instanceof Error ? e.message : "Could not remove application"); }
  }
  return <div><PageHeading eyebrow="THE PROCESS" title="Applications" description="A clear view of where you are, what comes next, and every opportunity in between." action={<Button onClick={() => start()}><Plus size={16} /> Add application</Button>} />
    {apps && <div className="mb-6 flex flex-wrap gap-2.5">{stages.map(s => <div key={s.key} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold"><span className={cn("h-2 w-2 rounded-full", s.dot)} />{s.label}<span className="ml-1 text-muted-foreground">{apps.filter(a => a.status === s.key).length}</span></div>)}</div>}
    {!apps ? <div className="flex gap-4 overflow-x-auto">{stages.map(s => <Skeleton key={s.key} className="h-72 w-64 shrink-0" />)}</div> : !apps.length ? <EmptyState icon={<Kanban size={24} />} title="Your pipeline is ready" description="Add an application to keep its status, follow-ups, and resume version in one place." action={<Button onClick={() => start()}><Plus size={15} /> Add an application</Button>} /> : <div className="scrollbar-thin flex items-start gap-3.5 overflow-x-auto pb-6 xl:grid xl:grid-cols-5 xl:overflow-visible">{stages.map(stage => <section key={stage.key} aria-label={`${stage.label} applications`} className="w-[265px] shrink-0 xl:w-auto"><div className={cn("mb-3 flex items-center justify-between rounded-xl px-3.5 py-3", stage.bar)}><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", stage.dot)} /><h2 className="font-display text-[13px] font-bold">{stage.label}</h2></div><span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-card/70 px-1 text-[11px] font-bold">{apps.filter(a => a.status === stage.key).length}</span></div>
        <div className="min-h-40 space-y-3">{apps.filter(a => a.status === stage.key).map(app => <article key={app.id} className="card-hover rounded-xl border border-border bg-card p-4 shadow-soft"><div className="flex items-start justify-between gap-2"><CompanyAvatar name={app.companyName} size="sm" /><button onClick={() => start(app)} title="Edit application" aria-label={`Edit ${app.companyName} application`} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal size={19} /></button></div><button onClick={() => start(app)} className="mt-3 block w-full text-left"><p className="font-display text-[13px] font-bold leading-5 hover:text-primary">{app.title}</p><p className="mt-1 text-xs text-muted-foreground">{app.companyName}</p></button>
          <div className="mt-4 space-y-2 border-t border-border pt-3">{app.followUpAt && <span className="inline-flex items-center gap-1.5 rounded-md bg-[#fff5e8] px-2 py-1 text-[10px] font-semibold text-[#9b702e] dark:bg-[#493a2c] dark:text-[#ebca93]"><CalendarClock size={12} /> Follow up {format(new Date(app.followUpAt), "MMM d")}</span>}{app.appliedAt && <p className="text-[11px] text-muted-foreground">Applied {format(new Date(app.appliedAt), "MMM d, yyyy")}</p>}{app.resumeId && <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><FileText size={12} /> Resume linked</p>}</div>
          <div className="mt-4 flex items-center justify-between gap-2"><label className="sr-only" htmlFor={`status-${app.id}`}>Status for {app.title}</label><select id={`status-${app.id}`} value={app.status} onChange={e => changeStatus(app, e.target.value as ApplicationStatus)} className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-semibold text-foreground focus-visible:outline-ring">{stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</select>{app.jobId && <Link href={`/jobs/${app.jobId}`} title="View job" aria-label={`View ${app.title} job`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"><ArrowUpRight size={16} /></Link>}</div>
        </article>)}{!apps.some(a => a.status === stage.key) && <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">Nothing here yet</div>}</div>
      </section>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>{editing ? "Edit application" : "Add an application"}</DialogTitle><DialogDescription>Track each step, from first save to final outcome.</DialogDescription><form onSubmit={save} className="mt-5 space-y-4">
      <div><label htmlFor="app-job" className="mb-1.5 block text-xs font-bold">Linked job <span className="font-normal text-muted-foreground">(optional)</span></label><Select id="app-job" value={form.jobId} onChange={e => { const job = jobs.find(j => j.id === e.target.value); setForm(v => ({ ...v, jobId: e.target.value, title: job?.title || v.title, companyName: job?.companyName || v.companyName })); }}><option value="">Custom application</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.companyName} — {j.title}</option>)}</Select></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="app-title" className="mb-1.5 block text-xs font-bold">Job title</label><Input id="app-title" value={form.title} onChange={e => field("title", e.target.value)} required placeholder="Product Engineer" /></div><div><label htmlFor="app-company" className="mb-1.5 block text-xs font-bold">Company</label><Input id="app-company" value={form.companyName} onChange={e => field("companyName", e.target.value)} required placeholder="Company name" /></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="app-status" className="mb-1.5 block text-xs font-bold">Status</label><Select id="app-status" value={form.status} onChange={e => field("status", e.target.value as ApplicationStatus)}>{stages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></div><div><label htmlFor="app-resume" className="mb-1.5 block text-xs font-bold">Resume version</label><Select id="app-resume" value={form.resumeId} onChange={e => field("resumeId", e.target.value)}><option value="">None yet</option>{resumes.map(r => <option key={r.id} value={r.id}>{r.name} · v{r.version}</option>)}</Select></div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="app-date" className="mb-1.5 block text-xs font-bold">Date applied</label><Input id="app-date" type="date" value={form.appliedAt} onChange={e => field("appliedAt", e.target.value)} /></div><div><label htmlFor="app-followup" className="mb-1.5 block text-xs font-bold">Follow-up reminder</label><Input id="app-followup" type="date" value={form.followUpAt} onChange={e => field("followUpAt", e.target.value)} /></div></div>
      <div><label htmlFor="app-notes" className="mb-1.5 block text-xs font-bold">Notes</label><Textarea id="app-notes" value={form.notes} onChange={e => field("notes", e.target.value)} placeholder="Interview notes, contacts, what you learned…" rows={3} /></div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">{editing ? <Button type="button" variant="ghost" className="text-rose-600" onClick={() => remove(editing)}><Trash2 size={15} /> Delete</Button> : <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add application"}</Button></div></div>
    </form></DialogContent></Dialog>
  </div>;
}
