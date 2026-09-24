import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "sonner";
export const metadata: Metadata = { title: "The Bureau — Your job search, in focus", description: "First-party job postings, sponsorship intelligence, and thoughtful resume tailoring." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className="min-h-screen antialiased"><ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>{children}<Toaster position="bottom-right" richColors closeButton /></ThemeProvider></body></html>;
}
