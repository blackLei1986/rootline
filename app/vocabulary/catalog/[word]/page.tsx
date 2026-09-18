import type { Metadata } from "next";
import { ProductionWordDetail } from "@/components/production-word-detail";

export const metadata: Metadata = { title: "词汇详情" };
export default async function VocabularyCatalogWordPage({ params }: { params: Promise<{ word: string }> }) {
  const { word } = await params;
  return <ProductionWordDetail id={decodeURIComponent(word)} />;
}
