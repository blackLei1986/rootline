import type { Metadata } from "next";
import { VocabularyCalibration } from "@/components/vocabulary-calibration";

export const metadata: Metadata = { title: "词汇校准" };

export default function CalibrationPage() {
  return <VocabularyCalibration />;
}
