import type { TodayPlanStatus } from "@/types/today";
import type { RootMasteryRow } from "@/lib/progress/roots";
import type { GrowthPoint } from "@/lib/progress/growth";

export interface ProgressPlanDay {
  id: string;
  learningDate: string;
  generationVersion: number;
  status: TodayPlanStatus;
  completedAt: string | null;
  requiredTargetIds: string[];
  degradationReason: string | null;
}

export interface ProgressSessionDay {
  planId: string;
  status: TodayPlanStatus;
  completedTargetIds: string[];
}

export interface ProgressDay {
  date: string;
  state: "complete" | "active" | "not-started" | "missing";
  completed: number;
  required: number;
  degradationReason: string | null;
}

export interface CompletionWindow {
  completed: number;
  eligible: number;
  percent: number | null;
  days: ProgressDay[];
}

export type ProgressWordState = "touched" | "learning" | "stable";

export interface ProgressDashboardDTO {
  today: ProgressDay;
  last7: CompletionWindow;
  last30: CompletionWindow;
  streak: number;
  vocabulary: {touched: number; learning: number; stable: number; stablePercent: number};
  roots: RootMasteryRow[];
  growth: {available: boolean; points: GrowthPoint[]; hasTrend: boolean; firstObservedDate: string | null};
  reading: {completedPracticeSessions7d: number} | null;
}
