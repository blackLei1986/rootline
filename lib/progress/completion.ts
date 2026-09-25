import type { CompletionWindow, ProgressDay, ProgressPlanDay, ProgressSessionDay } from "@/lib/progress/types";
import { shiftLearningDate } from "@/lib/today/local-date";

export function calculateCompletion(
  plans: readonly ProgressPlanDay[],
  sessions: readonly ProgressSessionDay[],
  firstPlanDate: string | null,
  todayDate: string
): {today: ProgressDay; last7: CompletionWindow; last30: CompletionWindow; streak: number} {
  const latestByDate = new Map<string, ProgressPlanDay>();
  for (const plan of plans) {
    const previous = latestByDate.get(plan.learningDate);
    if (!previous || plan.generationVersion > previous.generationVersion) {
      latestByDate.set(plan.learningDate, plan);
    }
  }
  const sessionByPlanId = new Map(sessions.map((session) => [session.planId, session]));

  function dayFor(date: string): ProgressDay {
    const plan = latestByDate.get(date);
    if (!plan) {
      return {date, state: firstPlanDate && date >= firstPlanDate ? "missing" : "not-started",
        completed: 0, required: 0, degradationReason: null};
    }
    const session = sessionByPlanId.get(plan.id);
    const required = new Set(plan.requiredTargetIds);
    const completed = new Set(session?.completedTargetIds ?? []);
    const completedCount = [...required].filter((id) => completed.has(id)).length;
    const isComplete = plan.status === "complete" && plan.completedAt !== null
      && session?.status === "complete";
    const state = isComplete ? "complete" : plan.status === "not-started" && session?.status !== "active"
      ? "not-started" : "active";
    return {date, state, completed: completedCount, required: required.size,
      degradationReason: plan.degradationReason};
  }

  function windowFor(length: number): CompletionWindow {
    const days = firstPlanDate === null || firstPlanDate > todayDate ? []
      : Array.from({length}, (_, index) => shiftLearningDate(todayDate, index - length + 1))
        .filter((date) => date >= firstPlanDate)
        .map(dayFor);
    const eligible = days.length;
    const completed = days.filter((day) => day.state === "complete").length;
    return {completed, eligible, percent: eligible === 0 ? null : Math.round(completed / eligible * 100), days};
  }

  const today = dayFor(todayDate);
  let streak = 0;
  if (firstPlanDate !== null && firstPlanDate <= todayDate) {
    let date = today.state === "complete" ? todayDate : shiftLearningDate(todayDate, -1);
    while (date >= firstPlanDate && dayFor(date).state === "complete") {
      streak += 1;
      date = shiftLearningDate(date, -1);
    }
  }

  return {today, last7: windowFor(7), last30: windowFor(30), streak};
}
