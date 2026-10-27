import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { authSecret } from "@/lib/auth-secret";

// Defense in depth: every page and API route requires a valid Auth.js session before it runs.
// Route handlers and the (app) layout still verify the session and scope data to the user.
const PUBLIC = [/^\/$/, /^\/login(?:\/|$)/, /^\/api\/auth\//, /^\/api\/cron\//];
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(re => re.test(pathname))) return NextResponse.next();
  const secret = authSecret();
  let token = null;
  // The cookie name depends on whether the session was issued over HTTPS; accept either.
  if (secret) for (const secureCookie of [true, false]) {
    try { token = await getToken({ req, secret, secureCookie }); } catch { token = null; }
    if (token) break;
  }
  if (token) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const login = new URL("/login", process.env.AUTH_URL || req.url);
  login.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(login);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|ttf)$).*)"] };
