import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { generalEnglishCore } from "@/data/course";
import { StageReview } from "@/components/stage-review";

export const metadata: Metadata = { title: "阶段综合复习" };
export function generateStaticParams() { return generalEnglishCore.stages[0].units.map((unit) => ({ unit: unit.id })); }

export default async function StageReviewPage({ params }: { params: Promise<{ unit: string }> }) {
  const { unit } = await params;
  if (!generalEnglishCore.stages[0].units.some((item) => item.id === unit)) notFound();
  return <StageReview unitId={unit} />;
}
