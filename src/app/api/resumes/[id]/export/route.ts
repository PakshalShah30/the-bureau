import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { atsScore, validateFinalResume, SKILLS } from "@/lib/ai/ats";
import { detectorFor } from "@/lib/ai/providers";
const schema = z.object({ jobId: z.string().min(1), content: z.string().min(30).max(120000),
  confirmedSkills: z.array(z.string()).max(20).default([]) });
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const { jobId, content, confirmedSkills } = schema.parse(await req.json());
    const [resume, job, user] = await Promise.all([store.getResume(uid, (await ctx.params).id), store.getJob(uid, jobId), store.getUser(uid)]);
    if (!resume || !job || !user) return notFound();
    const gapSkills = atsScore(resume.content, job.description).missing;
    if (confirmedSkills.some(skill => !SKILLS.includes(skill as typeof SKILLS[number]) || !gapSkills.includes(skill as typeof gapSkills[number])))
      throw new Error("Confirmed skills must be actual gaps in this job and explicitly selected.");
    const guard = validateFinalResume(resume.content, content, confirmedSkills);
    if (!guard.safe) return NextResponse.json({ error: "Fact-lock blocked export", reasons: guard.reasons }, { status: 422 });
    const beforeScore = atsScore(resume.content, job.description).score;
    const score = atsScore(content, job.description).score;
    const aiLikelihood = await detectorFor(user).score(content);
    const versions = (await store.listResumes(uid)).filter(r => r.parentId === resume.id || r.id === resume.id);
    const version = Math.max(...versions.map(v => v.version), resume.version) + 1;
    const saved = await store.addResume(uid, { name: `${resume.name} · ${job.companyName}`, content,
      filename: `${resume.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v${version}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      version, parentId: resume.id, jobId: job.id, atsScore: score, aiLikelihood });
    const applications = await store.listApplications(uid);
    const existing = applications.find(a => a.jobId === job.id);
    if (existing) await store.updateApplication(uid, existing.id, { resumeId: saved.id });
    else await store.addApplication(uid, { jobId: job.id, title: job.title, companyName: job.companyName,
      status: "SAVED", appliedAt: null, followUpAt: null, resumeId: saved.id, notes: "" });
    return NextResponse.json({ resume: saved, score, aiLikelihood,
      atsDrop: score < beforeScore, warning: score < beforeScore ? "ATS match dropped after humanization. Review accepted lines." : null,
      downloads: { docx: `/api/resumes/${saved.id}/download?format=docx`, pdf: `/api/resumes/${saved.id}/download?format=pdf` } }, { status: 201 });
  } catch (e) { return apiError(e); }
}
