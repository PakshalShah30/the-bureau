import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { isDemo, store } from "@/lib/store";
import { prisma } from "@/lib/store/prisma";

const providers = [
  Credentials({ name: "Email and password", credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    async authorize(credentials) {
      const email = String(credentials?.email || "").trim().toLowerCase();
      const password = String(credentials?.password || "");
      const user = await store.getUserByEmail(email);
      if (!user) return null;
      const valid = isDemo && email === "demo@thebureau.app" ? password === "demo1234"
        : !!user.passwordHash && await compare(password, user.passwordHash);
      return valid ? { id: user.id, email: user.email, name: user.name || user.email } : null;
    } }),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [Google({
    clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  })] : []),
];
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || (isDemo ? "preview-only-do-not-use-in-production-64f8ad" : undefined),
  trustHost: true,
  adapter: isDemo ? undefined : PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) { if (user?.id) token.userId = user.id; return token; },
    async session({ session, token }) {
      if (session.user) session.user.id = String(token.userId || token.sub || "");
      return session;
    },
  },
});
