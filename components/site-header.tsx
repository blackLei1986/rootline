"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, ChartNoAxesCombined, House, Newspaper, UserRound, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountDTO } from "@/lib/auth/account-dto";
import { AccountMenu } from "@/components/account-menu";

const nav = [
  { href: "/today", label: "Today", icon: House },
  { href: "/roots", label: "Roots", icon: Waypoints },
  { href: "/reading", label: "阅读", icon: Newspaper },
  { href: "/progress", label: "Progress", icon: ChartNoAxesCombined }
];

export function SiteHeader({ account }: { account: AccountDTO | null }) {
  const pathname = usePathname();
  if (pathname.startsWith("/learn") || /\/reading\/[^/]+\/learn/.test(pathname)) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-xl">
      <div className="page-shell flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight" aria-label="Rootline 首页">
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)] text-white shadow-sm"><BookOpenText className="size-5" /></span>
          <span className="text-lg">Rootline</span>
        </Link>
        <div className="flex items-center gap-2"><nav className="hidden items-center gap-0.5 md:flex" aria-label="主导航">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/today" ? pathname === "/" || pathname.startsWith("/today") : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={cn("flex h-10 items-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors sm:px-3", active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]")}>
                  <Icon className="size-4" /><span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav><AccountMenu account={account} /></div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(25,30,60,0.08)] backdrop-blur md:hidden" aria-label="移动主导航">
        {[...nav, { href: "/settings/account", label: "Me", icon: UserRound }].map(({ href, label, icon: Icon }) => {
          const active = href === "/today" ? pathname === "/" || pathname.startsWith("/today") : pathname.startsWith(href);
          return <Link key={href} href={href} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]")}><Icon className="size-5" /><span>{label}</span></Link>;
        })}
      </nav>
    </header>
  );
}
