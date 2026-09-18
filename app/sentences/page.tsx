import type { Metadata } from "next";
import { DailySentences } from "@/components/daily-sentences";
export const metadata: Metadata = { title: "每日句子", description: "用高质量句子复习单词、搭配和句型。" };
export default function SentencesPage() { return <DailySentences />; }
