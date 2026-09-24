import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ZodError } from "zod";
export async function requireUser() {
  const session = await auth();
  return session?.user?.id || null;
}
export const unauthorized = () => NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });
export function apiError(error: unknown, status = 400) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
  const message = error instanceof Error ? error.message : "Something went wrong";
  // Unexpected database/provider failures must not leak credentials or SQL to browsers.
  if (/Prisma|connection|ECONN|P20\d{2}|password|token|api.key/i.test(message)) return NextResponse.json({ error: "Service unavailable. Please try again." }, { status: 503 });
  return NextResponse.json({ error: message }, { status });
}
export function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; } catch { return null; }
}
