import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDemo } from "@/lib/store";
import { AppShell } from "@/components/layout/shell";
export const dynamic = "force-dynamic";
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect(process.env.AUTH_URL ? new URL("/login", process.env.AUTH_URL).toString() : "/login");
  return <AppShell userName={session.user.name || "Your workspace"} email={session.user.email || ""} demo={isDemo}>{children}</AppShell>;
}
