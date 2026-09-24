import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { discoverYc, detectYcBoard } from "@/lib/sources/yc";
import { testBoard } from "@/lib/sources/ats";
export const maxDuration = 300;
const schema = z.object({ batch: z.string().trim().max(30).optional(), industry: z.string().trim().max(60).optional(),
  minSize: z.number().int().min(1).optional(), maxSize: z.number().int().max(10000).optional(), page: z.number().int().min(0).max(31).default(0) });
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const filters = schema.parse(await req.json());
    if (!filters.batch && !filters.industry) return NextResponse.json({ error: "Choose a YC batch or industry to import." }, { status: 400 });
    const discovery = await discoverYc(filters);
    const discovered = discovery.companies;
    const existing = await store.listCompanies(uid);
    const errors: string[] = []; let tracked = 0, noAts = 0, already = 0;
    for (let i = 0; i < discovered.length; i += 8) {
      await Promise.all(discovered.slice(i, i + 8).map(async yc => {
        if (existing.some(c => c.ycUrl === yc.ycUrl)) { already++; return; }
        const detected = await detectYcBoard(yc);
        if (!detected) { noAts++; return; }
        if (existing.some(c => c.atsType === detected.type && c.boardSlug.toLowerCase() === detected.slug.toLowerCase())) { already++; return; }
        try {
          await testBoard(detected.type, detected.slug);
          const company = await store.addCompany(uid, { name: yc.name, atsType: detected.type, boardSlug: detected.slug,
            careersUrl: detected.careersUrl, website: yc.website, ycBatch: yc.batch, ycUrl: yc.ycUrl,
            industry: yc.industry, teamSize: yc.teamSize, employerOverride: null, active: true });
          existing.push(company); tracked++;
        } catch (e) { errors.push(`${yc.name}: ${e instanceof Error ? e.message : "Board unavailable"}`); }
      }));
    }
    return NextResponse.json({ discovered: discovered.length, tracked, noAts, already, nextPage: discovery.nextPage, total: discovery.total, errors: errors.slice(0, 20),
      message: "Only companies with a verified first-party ATS board were added. Refresh the feed to fetch their jobs." });
  } catch (e) { return apiError(e); }
}
