import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorized, notFound, apiError } from "@/lib/api";
import { encrypt } from "@/lib/secrets";
import { store, isDemo } from "@/lib/store";
const schema = z.object({ name: z.string().trim().min(1).max(80).optional(), humanizationIntensity: z.enum(["LIGHT", "MEDIUM", "STRONG"]).optional(),
  humanizerKey: z.string().max(1000).optional(), detectorKey: z.string().max(1000).optional(),
  humanizerUrl: z.union([z.url().startsWith("https:"), z.literal("")]).optional(),
  detectorUrl: z.union([z.url().startsWith("https:"), z.literal("")]).optional() });
export async function GET() {
  const uid = await requireUser(); if (!uid) return unauthorized();
  const user = await store.getUser(uid); if (!user) return notFound();
  return NextResponse.json({ settings: { name: user.name, email: user.email, humanizationIntensity: user.humanizationIntensity,
    humanizerUrl: user.humanizerUrl, detectorUrl: user.detectorUrl, hasHumanizerKey: !!user.humanizerKey,
    hasDetectorKey: !!user.detectorKey, hasLLM: !!process.env.LLM_API_KEY, demo: isDemo } });
}
export async function PATCH(req: Request) {
  const uid = await requireUser(); if (!uid) return unauthorized();
  try {
    const input = schema.parse(await req.json());
    // Empty string explicitly clears a provider key. Never send keys back to browser.
    const user = await store.updateUser(uid, { ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.humanizationIntensity ? { humanizationIntensity: input.humanizationIntensity } : {}),
      ...(input.humanizerKey !== undefined ? { humanizerKey: input.humanizerKey ? encrypt(input.humanizerKey) : null } : {}),
      ...(input.detectorKey !== undefined ? { detectorKey: input.detectorKey ? encrypt(input.detectorKey) : null } : {}),
      ...(input.humanizerUrl !== undefined ? { humanizerUrl: input.humanizerUrl || null } : {}),
      ...(input.detectorUrl !== undefined ? { detectorUrl: input.detectorUrl || null } : {}) });
    return NextResponse.json({ ok: true, name: user.name });
  } catch (e) { return apiError(e); }
}
