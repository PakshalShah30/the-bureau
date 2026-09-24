import { NextResponse } from "next/server";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { z } from "zod";
const textSchema = z.object({ name: z.string().trim().min(2).max(100), content: z.string().min(30).max(120000) });
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return NextResponse.json({ resumes: await store.listResumes(uid) });
}
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    let name: string, content: string, filename: string | null = null, mimeType: string | null = null;
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size > 5_000_000 || !/\.(pdf|docx)$/i.test(file.name))
        return NextResponse.json({ error: "Upload a PDF or DOCX under 5 MB" }, { status: 400 });
      name = String(form.get("name") || file.name.replace(/\.(pdf|docx)$/i, "")).trim().slice(0, 100);
      filename = file.name; mimeType = file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const buffer = Buffer.from(await file.arrayBuffer());
      if (mimeType === "application/pdf") {
        if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF file");
        const pdfParse = (await import("pdf-parse")).default;
        content = (await pdfParse(buffer)).text;
      } else {
        if (buffer.subarray(0, 2).toString() !== "PK") throw new Error("Invalid DOCX file");
        const mammoth = await import("mammoth");
        content = (await mammoth.extractRawText({ buffer })).value;
      }
    } else {
      ({ name, content } = textSchema.parse(await req.json()));
      mimeType = "text/plain";
    }
    if (!name || content.trim().length < 30) throw new Error("No parseable resume text found. Try a text-based PDF or DOCX.");
    return NextResponse.json({ resume: await store.addResume(uid, { name, content: content.slice(0, 120000), filename, mimeType,
      version: 1, parentId: null, jobId: null, atsScore: null, aiLikelihood: null }) }, { status: 201 });
  } catch (e) { return apiError(e); }
}
