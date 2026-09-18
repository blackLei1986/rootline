import { cn } from "@/lib/utils";

export function Progress({ value = 0, className }: { value?: number; className?: string }) {
  return <div className={cn("h-2 overflow-hidden rounded-full bg-[var(--muted)]", className)}><div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}
