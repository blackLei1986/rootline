import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReadingReinforcement } from "@/components/reading/reading-reinforcement";
import { getOptionalViewer } from "@/lib/auth/session";
import { createProductionReadingReinforcementService } from "@/lib/reading/reinforcement/server";

export const metadata: Metadata = {title: "阅读词汇巩固", description: "从已读摘要中进行可选词汇练习。"};

export default async function ReadingReinforcementPage({params}: {params: Promise<{sessionId: string}>}) {
  const {sessionId} = await params;
  const viewer = await getOptionalViewer();
  if (!viewer?.emailVerified) redirect(`/login?next=${encodeURIComponent(`/reading/reinforcement/${sessionId}`)}`);
  const session = await createProductionReadingReinforcementService().getOwnedSession(viewer.userId, sessionId);
  if (!session) notFound();
  return <ReadingReinforcement initialSession={session} betaUserId={viewer.userId} />;
}
