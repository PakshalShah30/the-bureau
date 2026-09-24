import type { ReactNode } from "react";
export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">{icon}</div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
