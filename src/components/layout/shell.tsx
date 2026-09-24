"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LayoutDashboard, BriefcaseBusiness, Bookmark, Kanban, Building2, FileText, Settings2, LogOut, Menu, X, Moon, Sun, ChevronDown, ArrowUpRight, Sparkles, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Job Feed", href: "/jobs", icon: BriefcaseBusiness },
  { label: "Saved Jobs", href: "/saved", icon: Bookmark },
  { label: "Applications", href: "/applications", icon: Kanban },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Resumes", href: "/resumes", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings2 },
];
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/dashboard" className="flex items-center gap-3" aria-label="The Bureau home"><span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-primary text-white shadow-[0_4px_12px_#6553d63b]">
    <span className="font-display text-xl font-extrabold leading-none">b</span><span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-[#9be8c4]" /></span>
    {!compact && <span className="font-display text-[18px] font-extrabold tracking-[-.065em] text-foreground">the bureau<span className="text-primary">.</span></span>}</Link>;
}
export function AppShell({ children, userName, email, demo }: { children: React.ReactNode; userName: string; email: string; demo: boolean }) {
  const path = usePathname(); const [mobileOpen, setMobileOpen] = useState(false); const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); const { theme, setTheme } = useTheme();
  useEffect(() => { setMobileOpen(false); }, [path]);
  const current = nav.find(item => item.href === path || (item.href !== "/dashboard" && path.startsWith(item.href + "/")))?.label || "Dashboard";
  return <div className="min-h-screen">
    {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-[#121527]/45 lg:hidden" />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-200 lg:translate-x-0", collapsed ? "w-[82px]" : "w-[252px]", mobileOpen ? "translate-x-0" : "-translate-x-full") }>
      <div className={cn("flex h-[80px] items-center px-6", collapsed && "justify-center px-2")}><Brand compact={collapsed} /></div>
      <div className={cn("px-5 pt-5", collapsed && "px-3")}>
        {!collapsed && <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground/80">WORKSPACE</p>}
        <nav aria-label="Main navigation" className="space-y-1">
          {nav.slice(0, 6).map(({ label, href, icon: Icon }) => {
            const active = path === href || (href !== "/dashboard" && path.startsWith(href + "/"));
            return <Link key={href} href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}
              className={cn("relative flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors", active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "justify-center px-0")}>
              <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />{!collapsed && label}{active && !collapsed && <span className="absolute right-0 h-5 w-[3px] rounded-full bg-primary" />}
            </Link>;
          })}
        </nav>
        {!collapsed && <p className="px-3 pb-3 pt-9 text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground/80">PREFERENCES</p>}
        <Link href="/settings" title={collapsed ? "Settings" : undefined} aria-current={path === "/settings" ? "page" : undefined}
          className={cn("mt-2 flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-semibold transition-colors", path === "/settings" ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground", collapsed && "justify-center px-0")}>
          <Settings2 size={18} strokeWidth={1.8} />{!collapsed && "Settings"}
        </Link>
      </div>
      <div className="mt-auto p-4">
        {!collapsed && <div className="relative mb-4 overflow-hidden rounded-2xl bg-[#efedff] p-4 dark:bg-[#302b50]"><Sparkles size={19} className="mb-3 text-primary" /><p className="font-display text-sm font-bold">A little more clarity.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your next role is out there. We&apos;ll help you find it.</p><Link href="/resumes" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Tailor a resume <ArrowUpRight size={13} /></Link></div>}
        <button title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(v => !v)} className="hidden w-full items-center gap-3 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-muted lg:flex">{collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /> Collapse sidebar</>}</button>
      </div>
    </aside>
    <div className={cn("min-h-screen transition-[margin] duration-200", collapsed ? "lg:ml-[82px]" : "lg:ml-[252px]")}>
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border bg-card/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="flex items-center gap-3"><button aria-label={mobileOpen ? "Close navigation" : "Open navigation"} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setMobileOpen(v => !v)}>{mobileOpen ? <X size={21} /> : <Menu size={21} />}</button>
          <span className="hidden text-xs font-medium text-muted-foreground sm:block">Workspace <span className="mx-2 opacity-50">/</span></span><span className="font-display text-sm font-bold">{current}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {demo && <span className="hidden items-center gap-1.5 rounded-full bg-[#fff7e9] px-2.5 py-1 text-[11px] font-bold text-[#9e672a] dark:bg-[#473723] dark:text-[#eec487] md:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Preview mode</span>}
          <button aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="relative"><button onClick={() => setMenuOpen(v => !v)} aria-expanded={menuOpen} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-muted"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e5e1fd] text-xs font-bold text-[#6352bd] dark:bg-[#433a76] dark:text-[#d4cafd]">{userName.split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase()}</span><ChevronDown size={14} className="hidden text-muted-foreground sm:block" /></button>
            {menuOpen && <><button aria-label="Close account menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 cursor-default" /><div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-border bg-card p-2 shadow-lift"><div className="border-b border-border px-3 py-2.5"><p className="text-sm font-bold">{userName}</p><p className="truncate text-xs text-muted-foreground">{email}</p></div><Link href="/settings" onClick={() => setMenuOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"><Settings2 size={15} /> Settings</Link><button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"><LogOut size={15} /> Sign out</button></div></>}
          </div>
        </div>
      </header>
      {demo && <div className="flex items-start gap-2 border-b border-[#f2e3c9] bg-[#fffbf3] px-5 py-2 text-[11px] leading-5 text-[#8a6736] dark:border-[#584a34] dark:bg-[#2b281e] dark:text-[#dec291] sm:px-8 lg:px-10"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Offline preview: sample applications and a dated snapshot of real first-party postings (checked Sep 23, 2026). Refresh needs outbound access; unavailable sources never close cached jobs.</div>}
      <main className="mx-auto max-w-[1470px] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-10">{children}</main>
    </div>
  </div>;
}
