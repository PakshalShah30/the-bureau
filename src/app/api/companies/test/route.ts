import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, apiError } from "@/lib/api";
import { testBoard } from "@/lib/sources/ats";
const schema = z.object({ atsType: z.enum(["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE"]), boardSlug: z.string().trim().min(1).max(120) });
export async function POST(req: Request) {
  if (!await requireUser()) return unauthorized();
  try { const { atsType, boardSlug } = schema.parse(await req.json()); return NextResponse.json(await testBoard(atsType, boardSlug)); }
  catch (e) { return apiError(e); }
}
