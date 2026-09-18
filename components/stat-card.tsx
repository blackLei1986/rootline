import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--muted-foreground)]">{label}</span>
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--muted)] text-[var(--muted-foreground)]"><Icon className="size-4" /></span>
        </div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p>}
      </CardContent>
    </Card>
  );
}
