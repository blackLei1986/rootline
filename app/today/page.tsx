import type { Metadata } from "next";
import { TodayLearningFlow } from "@/components/today-learning-flow";

export const metadata: Metadata = { title: "今日学习", description: "由系统编排的每日词汇学习主流程。" };
export default function TodayPage() { return <TodayLearningFlow />; }
