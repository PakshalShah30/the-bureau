import { NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { store } from "@/lib/store";
export const runtime = "nodejs";
function lines(text: string) { return text.replace(/\r/g, "").split("\n"); }
async function docx(text: string) {
  const children = lines(text).map(line => {
    if (/^[A-Z][A-Z\s&]{2,}$/.test(line.trim())) return new Paragraph({ text: line, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } });
    if (/^\s*[-•*]\s+/.test(line)) return new Paragraph({ children: [new TextRun(line.replace(/^\s*[-•*]\s+/, ""))], bullet: { level: 0 }, spacing: { after: 60 } });
    return new Paragraph({ text: line, spacing: { after: line ? 80 : 120 } });
  });
  return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ properties: {}, children }] })));
}
async function pdf(text: string) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  // Bundled open-licensed fonts preserve real names, accents and non-English text.
  // Never silently delete characters from an applicant's resume.
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/DejaVuSans.ttf")),
    readFile(join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf")),
  ]);
  const font = await document.embedFont(regularBytes, { subset: true });
  const bold = await document.embedFont(boldBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const missing = [...text].filter(char => !/\s/.test(char) && !supported.has(char.codePointAt(0)!));
  if (missing.length) throw new Error(`PDF font cannot render ${[...new Set(missing)].slice(0, 5).join(" ")}. Download the DOCX instead to preserve your exact text.`);
  let page = document.addPage([612, 792]), y = 750;
  for (const line of lines(text)) {
    const heading = /^[A-Z][A-Z\s&]{2,}$/.test(line.trim());
    const face = heading ? bold : font, size = heading ? 11 : 10;
    let part = "";
    const words = line.split(/\s+/);
    const wrapped: string[] = [];
    for (const word of words) {
      const next = part ? `${part} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) > 490 && part) { wrapped.push(part); part = word; } else part = next;
    }
    wrapped.push(part);
    for (const content of wrapped) {
      if (y < 55) { page = document.addPage([612, 792]); y = 750; }
      page.drawText(content, { x: 60, y, size, font: face, color: rgb(0.12, 0.16, 0.23) }); y -= heading ? 18 : 15;
    }
    if (!line.trim()) y -= 7;
  }
  return Buffer.from(await document.save());
}
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const resume = await store.getResume(uid, (await ctx.params).id); if (!resume) return notFound();
  try {
    const format = new URL(req.url).searchParams.get("format");
    if (format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Choose pdf or docx" }, { status: 400 });
    const buffer = format === "pdf" ? await pdf(resume.content) : await docx(resume.content);
    const filename = `${resume.name.replace(/[^a-z0-9-]+/gi, "-").slice(0, 70)}.${format}`;
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  } catch (e) { return apiError(e); }
}
