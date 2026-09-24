import type { ReactNode } from "react";
export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>
    {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.15em] text-primary">{eyebrow}</p>}
    <h1 className="font-display text-[26px] font-extrabold tracking-[-.055em] sm:text-[30px]">{title}</h1>
    {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-muted-foreground sm:text-sm">{description}</p>}
  </div>{action && <div className="shrink-0">{action}</div>}</div>;
}
