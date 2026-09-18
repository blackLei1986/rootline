import type { Metadata } from "next";
import { QuizPractice } from "@/components/quiz-practice";

export const metadata: Metadata = { title: "综合测验" };

export default function QuizPage() {
  return <QuizPractice />;
}
