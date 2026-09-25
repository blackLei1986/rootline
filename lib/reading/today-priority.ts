import "server-only";
import {SupabaseProgressRepository} from "@/lib/repositories/supabase/progress-repository";
import {createAdminSupabaseClient} from "@/lib/supabase/admin";
import {learningDateForTimeZone} from "@/lib/today/local-date";
import {calculateCompletion} from "@/lib/progress/completion";

export async function shouldEmphasizeToday(userId: string, now: Date): Promise<boolean> {
  const repository = new SupabaseProgressRepository(createAdminSupabaseClient());
  const timeZone = await repository.getProfileTimeZone(userId);
  const todayDate = learningDateForTimeZone(now, timeZone);
  const plans = await repository.getRecentPlanDays(userId, todayDate, todayDate);
  if (plans.length === 0) return true;
  const sessions = await repository.getMatchingSessions(userId, plans.map((plan) => plan.id));
  return calculateCompletion(plans, sessions, plans[0]?.learningDate ?? null, todayDate).today.state !== "complete";
}
