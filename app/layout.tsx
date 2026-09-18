import type { Metadata } from "next";
import "./globals.css";
import { SiteHeaderShell } from "@/components/site-header-shell";
import { SiteFooter } from "@/components/site-footer";
import { LocalDataMigrationShell } from "@/components/local-data-migration-shell";
import { SyncQueueFlusherShell } from "@/components/sync-queue-flusher-shell";

export const metadata: Metadata = {
  title: { default: "Rootline · 词根学习", template: "%s · Rootline" },
  description: "从词根出发，建立英语词汇之间的联系。",
  icons: { icon: "/favicon.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <SiteHeaderShell />
        <LocalDataMigrationShell />
        <SyncQueueFlusherShell />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
