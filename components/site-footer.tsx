"use client";

import { usePathname } from "next/navigation";

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/learn")) return null;
  return <footer className="page-shell mt-20 border-t py-8 text-sm text-[var(--muted-foreground)]">Rootline · 用词根理解词汇，不只是记住单词。</footer>;
}
