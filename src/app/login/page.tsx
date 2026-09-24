"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, Check, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Brand } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/client";
export default function LoginPage() {
  const router = useRouter(); const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useEffect(() => { getProviders().then(providers => setGoogleAvailable(!!providers?.google)).catch(() => {}); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (register) await request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("Incorrect email or password");
      router.push("/dashboard"); router.refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not sign in"); } finally { setBusy(false); }
  }
  async function demo() {
    setBusy(true);
    const result = await signIn("credentials", { email: "demo@thebureau.app", password: "demo1234", redirect: false });
    if (result?.error) toast.error("Demo account unavailable. Enable DEMO_MODE=true for the local preview.");
    else { router.push("/dashboard"); router.refresh(); }
    setBusy(false);
  }
  return <div className="flex min-h-screen bg-card">
    <div className="flex w-full flex-col px-6 py-7 sm:px-12 lg:w-[48%] lg:px-[max(3.5rem,8vw)]">
      <Brand /><div className="mx-auto flex w-full max-w-[395px] flex-1 flex-col justify-center py-16">
        <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary"><Sparkles size={23} /></div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-primary">A MORE INTENTIONAL JOB SEARCH</p>
        <h1 className="font-display text-[32px] font-extrabold tracking-[-.055em] sm:text-[37px]">{register ? "Make your next move." : "Welcome back."}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{register ? "One quiet place for opportunities, applications, and what comes next." : "Your opportunities are right where you left them."}</p>
        <form onSubmit={submit} className="mt-9 space-y-4">
          {register && <div><label htmlFor="name" className="mb-1.5 block text-xs font-bold">Your name</label><Input id="name" autoComplete="name" placeholder="Alex Morgan" value={name} onChange={e => setName(e.target.value)} required /></div>}
          <div><label htmlFor="email" className="mb-1.5 block text-xs font-bold">Email address</label><div className="relative"><Mail size={16} className="absolute left-3.5 top-3 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="pl-10" value={email} onChange={e => setEmail(e.target.value)} required /></div></div>
          <div><label htmlFor="password" className="mb-1.5 block text-xs font-bold">Password</label><div className="relative"><LockKeyhole size={16} className="absolute left-3.5 top-3 text-muted-foreground" /><Input id="password" type={show ? "text" : "password"} minLength={register ? 8 : undefined} autoComplete={register ? "new-password" : "current-password"} placeholder="••••••••" className="pl-10 pr-10" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
          <Button type="submit" disabled={busy} size="lg" className="mt-2 w-full">{busy ? "One moment..." : register ? "Create account" : "Sign in"}<ArrowRight size={16} /></Button>
        </form>
        {googleAvailable && <><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div><Button variant="outline" size="lg" type="button" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} disabled={busy} className="w-full"><span aria-hidden="true" className="font-display text-lg font-bold text-[#4285f4]">G</span> Continue with Google</Button></>}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && <><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or take a look around<span className="h-px flex-1 bg-border" /></div><Button variant="outline" size="lg" onClick={demo} disabled={busy} className="w-full">Explore the demo <ArrowUpRight size={16} /></Button><p className="mt-2 text-center text-[11px] text-muted-foreground">Preview credentials: demo@thebureau.app / demo1234</p></>}
        <p className="mt-7 text-center text-[13px] text-muted-foreground">{register ? "Already have an account?" : "New here?"} <button onClick={() => setRegister(v => !v)} className="font-bold text-primary hover:underline">{register ? "Sign in" : "Create an account"}</button></p>
        <p className="mt-7 text-center text-[11px] leading-5 text-muted-foreground">Only first-party job sources. Your applications and resumes stay yours.</p>
      </div><p className="text-[11px] text-muted-foreground">© 2026 The Bureau · Made for the next chapter.</p>
    </div>
    <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#dedaff] p-10 lg:flex xl:p-16 dark:bg-[#252146]">
      <div className="absolute -right-40 -top-44 h-[560px] w-[560px] rounded-full border border-white/50" /><div className="absolute -right-24 -top-32 h-[450px] w-[450px] rounded-full border border-white/40" /><div className="absolute -right-8 -top-16 h-[340px] w-[340px] rounded-full border border-white/30" />
      <div className="relative z-10"><span className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/35 px-3 py-1.5 text-[11px] font-bold text-[#483c96] backdrop-blur-md dark:text-[#e5defc]"><span className="h-1.5 w-1.5 rounded-full bg-[#6ac39e]" /> YOUR CAREER, ORGANIZED</span></div>
      <div className="relative z-10 mx-auto w-full max-w-[520px]">
        <div className="relative mb-10 h-[370px]"><div className="absolute left-[4%] top-[7%] w-[85%] -rotate-6 rounded-2xl border border-white/70 bg-white/40 p-5 shadow-xl backdrop-blur-sm"><span className="text-xs font-bold text-[#6353a3]">YOUR SHORTLIST</span><div className="mt-4 h-3 w-2/3 rounded-full bg-white/80" /><div className="mt-3 h-3 w-1/2 rounded-full bg-white/60" /></div>
          <div className="absolute left-[12%] top-[20%] w-[82%] rotate-2 rounded-[22px] border border-white/90 bg-white p-6 shadow-[0_25px_70px_#42368435] dark:bg-[#28243e]"><div className="mb-6 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[.13em] text-[#6556b6]">YOUR NEXT OPPORTUNITY</span><span className="rounded-full bg-[#e9f8ef] px-2.5 py-1 text-[10px] font-bold text-[#319063]">● OPEN</span></div><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#edeaff] font-display text-lg font-bold text-[#6654c0]">P</span><div><p className="font-display text-[17px] font-bold">Your next chapter</p><p className="text-xs text-muted-foreground">A search that fits you, not just your résumé.</p></div></div><div className="mt-6 flex gap-2"><span className="rounded-md bg-[#f1efff] px-2 py-1 text-[10px] font-bold text-[#6353b6]">Official sources</span><span className="rounded-md bg-[#eaf8f0] px-2 py-1 text-[10px] font-bold text-[#21825a]">Evidence first</span></div><div className="mt-6 h-1.5 w-full rounded-full bg-[#f1eff8]"><div className="h-1.5 w-[78%] rounded-full bg-[#8373de]" /></div><div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>Resume match</span><span>Your voice</span></div></div>
          <span className="absolute bottom-0 right-[2%] rounded-xl border border-white/90 bg-white px-4 py-3 text-xs font-bold text-[#4d407c] shadow-lg dark:bg-[#383254] dark:text-white">✦ A better way forward</span>
        </div>
        <h2 className="font-display text-[30px] font-extrabold leading-[1.25] tracking-[-.05em] text-[#292452] dark:text-white xl:text-[36px]">The right opportunity is worth finding well.</h2>
        <p className="mt-4 max-w-md text-sm leading-7 text-[#625b8c] dark:text-[#beb6da]">Real openings from the companies themselves. Clear sponsorship signals. A resume that still sounds like you.</p>
        <div className="mt-7 flex gap-1.5"><span className="h-1.5 w-7 rounded-full bg-[#6d5cc9]" /><span className="h-1.5 w-1.5 rounded-full bg-[#b8adea]" /><span className="h-1.5 w-1.5 rounded-full bg-[#b8adea]" /></div>
      </div>
      <div className="relative z-10 flex items-center gap-2 text-xs font-medium text-[#685e95] dark:text-[#a9a0d0]"><Check size={15} /> No aggregators. No noise. Just your next move.</div>
    </div>
  </div>;
}
