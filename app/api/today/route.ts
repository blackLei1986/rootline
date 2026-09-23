import { NextResponse } from "next/server";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createProductionTodayService } from "@/lib/today/server-service";
import { getE2ETodayPlan } from "@/lib/today/e2e-fixture";
import { learningDateForTimeZone } from "@/lib/today/local-date";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.ROOTLINE_E2E_FIXTURES === "1") {
    return NextResponse.json(getE2ETodayPlan(), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const learningDate = await getLearningDate(viewer.userId, new Date());
  const plan = await createProductionTodayService().getOrCreateTodayPlan(viewer.userId, learningDate, new Date());
  return NextResponse.json(plan, { headers: { "cache-control": "private, no-store" } });
}

async function getLearningDate(userId: string, now: Date): Promise<string> {
  const client = createAdminSupabaseClient();
  const { data } = await client.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  try {
    return learningDateForTimeZone(now, data?.timezone ?? "Asia/Shanghai");
  } catch {
    return learningDateForTimeZone(now, "Asia/Shanghai");
  }
}
