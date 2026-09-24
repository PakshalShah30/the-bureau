import { redirect } from "next/navigation";
import { auth } from "@/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const session = await auth();
  const path = session?.user?.id ? "/dashboard" : "/login";
  // Behind a sandbox/reverse proxy Next's inferred request origin can be 127.0.0.1.
  // Use the configured public origin, not an absolute redirect to the internal server.
  redirect(process.env.AUTH_URL ? new URL(path, process.env.AUTH_URL).toString() : path);
}
