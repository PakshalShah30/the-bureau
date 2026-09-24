"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ArrowUpRight, Save, PenLine } from "lucide-react";
import { toast } from "sonner";
import type { SavedJob } from "@/lib/types";
import { request } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeading } from "@/components/layout/page-heading";
import { EmptyState } from "@/components/layout/empty-state";
import { LoadingCards } from "@/components/ui/skeleton";
import { JobCard } from "@/components/jobs/job-card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
export default function SavedPage() {
  const [saved, setSaved] = useState<SavedJob[] | null>(null); const [editing, setEditing] = useState<SavedJob | null>(null);
  const [notes, setNotes] = useState(""), [tags, setTags] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { request<{ saved: SavedJob[] }>("/api/saved").then(d => setSaved(d.saved)).catch(e => toast.error(e.message)); }, []);
  function edit(s: SavedJob) { setEditing(s); setNotes(s.notes); setTags(s.tags.join(", ")); }
  async function update() {
    if (!editing) return; setBusy(true);
    const input = { notes, tags: tags.split(",").map(x => x.trim()).filter(Boolean).slice(0, 12) };
    const before = saved;
    setSaved(prev => prev?.map(s => s.id === editing.id ? { ...s, ...input } : s) || null); setEditing(null);
    try { await request(`/api/saved/${editing.jobId}`, { method: "PATCH", body: JSON.stringify(input) }); toast.success("Notes updated"); }
    catch (e) { setSaved(before); toast.error(e instanceof Error ? e.message : "Could not save notes"); }
    finally { setBusy(false); }
  }
  return <div><PageHeading eyebrow="YOUR SHORTLIST" title="Saved jobs" description="Good opportunities deserve a second look. Keep your notes and next steps together." action={<Button asChild variant="outline"><Link href="/jobs">Explore roles <ArrowUpRight size={15} /></Link></Button>} />
    {!saved ? <LoadingCards count={3} /> : saved.length === 0 ? <EmptyState icon={<Bookmark size={24} />} title="Your shortlist starts here" description="Save roles that catch your eye, then come back to compare them, add notes, and take the next step." action={<Button asChild><Link href="/jobs">Find jobs <ArrowUpRight size={15} /></Link></Button>} /> : <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-3">{saved.map(s => s.job && <div key={s.id} className="space-y-2"><JobCard job={{ ...s.job, saved: true }} onSave={next => { if (!next) setSaved(prev => prev?.filter(x => x.id !== s.id) || null); }} /><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-[12px] text-muted-foreground">{s.notes ? <><PenLine size={13} className="mr-1.5 inline" />{s.notes}</> : "No notes yet. What stands out about this role?"}</p>{s.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{s.tags.map(t => <span key={t} className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary">#{t}</span>)}</div>}</div><Button size="sm" variant="ghost" onClick={() => edit(s)}><PenLine size={14} /> Edit notes</Button></div></div>)}</div><div className="surface p-5"><p className="font-display text-sm font-bold">Make your shortlist count</p><p className="mt-2 text-xs leading-6 text-muted-foreground">Add a note about the role, then move it to your application pipeline when you&apos;re ready.</p><Button asChild size="sm" variant="secondary" className="mt-4 w-full"><Link href="/applications">View pipeline <ArrowUpRight size={14} /></Link></Button></div></div>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent><DialogTitle>Notes for {editing?.job?.companyName}</DialogTitle><DialogDescription>Keep track of why this role feels like a fit.</DialogDescription><div className="mt-5 space-y-4"><div><label htmlFor="saved-notes" className="mb-1.5 block text-xs font-bold">Your notes</label><Textarea id="saved-notes" value={notes} onChange={e => setNotes(e.target.value)} maxLength={5000} placeholder="What do you want to remember about this opportunity?" rows={5} /></div><div><label htmlFor="saved-tags" className="mb-1.5 block text-xs font-bold">Tags <span className="font-normal text-muted-foreground">(comma-separated)</span></label><Input id="saved-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="Great team, remote, top pick" /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={update} disabled={busy}><Save size={15} /> Save notes</Button></div></div></DialogContent></Dialog>
  </div>;
}
