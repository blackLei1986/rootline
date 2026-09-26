"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { getBetaParticipation, recordBetaEvent } from "@/lib/beta/validation-store";

export type BetaRouteCategory = "today" | "reading" | "reading-article" | "progress";

export function getBetaRouteCategory(pathname: string): BetaRouteCategory | null {
  if (pathname === "/today" || pathname.startsWith("/today/")) return "today";
  if (pathname === "/reading") return "reading";
  if (pathname.startsWith("/reading/")) return "reading-article";
  if (pathname === "/progress" || pathname.startsWith("/progress/")) return "progress";
  return null;
}

function localLearningDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function BetaRouteTracker({ userId }: { userId?: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const category = getBetaRouteCategory(pathname);
    if (!userId || !category || !getBetaParticipation(userId)) return;
    const learningDate = localLearningDate();
    const renderObservedAt = performance.now();
    if (category === "today") recordBetaEvent(userId, learningDate, { type: "today-open" });
    if (category === "reading" || category === "reading-article") recordBetaEvent(userId, learningDate, { type: "reading-open" });
    if (category === "progress") recordBetaEvent(userId, learningDate, { type: "progress-open" });
    const frame = requestAnimationFrame(() => {
      recordBetaEvent(userId, learningDate, { type: "route-timing", route: category, milliseconds: performance.now() - renderObservedAt });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, userId]);
  return null;
}
