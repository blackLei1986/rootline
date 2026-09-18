import type { Metadata } from "next";
import { LearningExperience } from "@/components/learning-experience";

export const metadata: Metadata = { title: "今日学习" };

export default function LearnPage() {
  return <LearningExperience />;
}
