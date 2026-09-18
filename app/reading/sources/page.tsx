import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SourceManager } from "@/components/reading/source-manager";
import { getOptionalViewer } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";

export const metadata: Metadata = { title: "Reading 订阅源" };

export default async function ReadingSourcesPage() {
  const viewer = await getOptionalViewer();
  if (!viewer?.emailVerified) redirect("/login?next=%2Freading%2Fsources");
  const sources = await new SupabaseFeedRepository(createAdminSupabaseClient())
    .listSourcesForUser(viewer.userId);
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="max-w-3xl"><p className="label-caps text-xs font-bold text-[var(--primary)]">Reading sources</p><h1 className="mt-2 text-4xl font-bold">管理少量、高质量的来源</h1><p className="mt-3 text-[var(--muted-foreground)]">订阅数量不是目标。系统会从所有新文章中找出真正适合你词汇水平的内容。</p></div>
      <div className="mt-8"><SourceManager initialSources={sources} /></div>
    </div>
  );
}
