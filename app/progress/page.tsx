import type { Metadata } from "next";
import { ProgressDashboard } from "@/components/progress-dashboard";

export const metadata: Metadata = { title: "学习进度", description: "词汇识别、稳定、主动回忆、流利度与阅读覆盖。" };
export default function ProgressPage() { return <ProgressDashboard />; }
