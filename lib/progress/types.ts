import type { TodayPlanStatus } from "@/types/today";

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
