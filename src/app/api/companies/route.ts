import { NextResponse } from "next/server";
import { companySchema } from "@/lib/validators";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { store } from "@/lib/store";
import { testBoard } from "@/lib/sources/ats";
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  return NextResponse.json({ companies: await store.listCompanies(uid) });
}
export async function POST(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const input = companySchema.parse(await req.json());
    const tested = await testBoard(input.atsType, input.boardSlug); // validate BEFORE saving (0 jobs is valid)
    const company = await store.addCompany(uid, { name: input.name, atsType: input.atsType, boardSlug: input.boardSlug,
      careersUrl: input.careersUrl || null, website: input.website || null, ycBatch: input.ycBatch || null,
      ycUrl: input.ycUrl || null, industry: input.industry || null, teamSize: input.teamSize || null,
      employerOverride: input.employerOverride || null, active: input.active ?? true });
    return NextResponse.json({ company, tested }, { status: 201 });
  } catch (e) { return apiError(e); }
}
