import type { Metadata } from "next";
import { ReviewQueue } from "@/components/review-queue";

export const metadata: Metadata = { title: "复习队列" };

export default function ReviewPage() { return <ReviewQueue />; }
