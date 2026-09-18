import { NextResponse } from "next/server";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createProductionTodayService } from "@/lib/today/server-service";
import { getE2ETodayPlan } from "@/lib/today/e2e-fixture";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.ROOTLINE_E2E_FIXTURES === "1") {
    return NextResponse.json(getE2ETodayPlan(), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewer();
  const learningDate = await getLearningDate(viewer.userId, new Date());
  const plan = await createProductionTodayService().getOrCreateTodayPlan(viewer.userId, learningDate, new Date());
  return NextResponse.json(plan, { headers: { "cache-control": "private, no-store" } });
}

export async function POST() {
  if (process.env.ROOTLINE_E2E_FIXTURES === "1") {
    return NextResponse.json(getE2ETodayPlan(), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewer();
  const now = new Date();
  const learningDate = await getLearningDate(viewer.userId, now);
  const plan = await createProductionTodayService().regenerateUnstartedTodayPlan(viewer.userId, learningDate, now);
  return NextResponse.json(plan, { headers: { "cache-control": "private, no-store" } });
}

async function getLearningDate(userId: string, now: Date): Promise<string> {
  const client = createAdminSupabaseClient();
  const { data } = await client.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  const timeZone = data?.timezone ?? "Asia/Shanghai";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
