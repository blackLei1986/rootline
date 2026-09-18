import type { Metadata } from "next";
import { VocabularySearch } from "@/components/vocabulary-search";

export const metadata: Metadata = { title: "词汇搜索", description: "搜索 9000 个经过验收的英语 lemma。" };
export default function VocabularySearchPage() { return <VocabularySearch />; }
