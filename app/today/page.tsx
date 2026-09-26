import type { Metadata } from "next";
import { connection } from "next/server";
import { TodayLearningFlow } from "@/components/today-learning-flow";
import { getOptionalViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "今日学习", description: "由系统编排的每日词汇学习主流程。" };
export default async function TodayPage() {
  await connection();
  const viewer = await getOptionalViewer();
  return <TodayLearningFlow betaUserId={viewer?.emailVerified ? viewer.userId : undefined} />;
}
