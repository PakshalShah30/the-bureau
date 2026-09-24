import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { store } from "@/lib/store";
const schema = z.object({ email: z.email().max(254), name: z.string().trim().min(1).max(80), password: z.string().min(8).max(128) });
export async function POST(req: Request) {
  try {
    const { email, name, password } = schema.parse(await req.json());
    if (await store.getUserByEmail(email.toLowerCase())) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    await store.createUser({ email: email.toLowerCase(), name, passwordHash: await hash(password, 12) });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) { return apiError(e); }
}
