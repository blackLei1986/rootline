import type { Metadata } from "next";
import { RapidVocabulary } from "@/components/rapid-vocabulary";

export const metadata: Metadata = { title: "快速扫词", description: "独立的快速词汇识别练习。" };
export default function RapidVocabularyPage() { return <RapidVocabulary />; }
