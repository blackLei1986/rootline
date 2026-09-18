import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReadingDegradationCopy, isReadingDegradationReason } from "@/lib/today/degradation";

export function ReadingUnavailable({ reason }: { reason: string | null }) {
  if (!isReadingDegradationReason(reason)) return null;
  const message = getReadingDegradationCopy(reason);
  return <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
    <div><strong>{message.title}</strong><p className="mt-1 text-amber-900">{message.detail}</p></div>
    <Button asChild variant="outline" size="sm"><Link href={message.actionHref}>{message.actionLabel}<ArrowRight className="size-4" /></Link></Button>
  </div>;
}
