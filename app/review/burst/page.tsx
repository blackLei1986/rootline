import type { Metadata } from "next";
import { BurstReview } from "@/components/burst-review";

export const metadata: Metadata = { title: "5 分钟快速复习" };

export default function BurstReviewPage() {
  return <BurstReview />;
}
