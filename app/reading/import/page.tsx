import type { Metadata } from "next";
import { ReadingInput } from "@/components/reading-input";

export const metadata: Metadata = { title: "导入阅读文章" };

export default function ReadingImportPage() {
  return <ReadingInput />;
}
