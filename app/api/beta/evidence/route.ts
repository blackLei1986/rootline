import { isDeepStrictEqual } from "node:util";
import { NextResponse } from "next/server";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { parseBetaEvidenceSubmission } from "@/lib/beta/evidence-schema";
import { buildBetaEvidenceReport, type PersistedBetaEvent } from "@/lib/beta/evidence-report";
import { isBetaLearningDate } from "@/lib/beta/validation-store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_BETA_EVIDENCE_ENABLED !== "1") return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const date = new URL(request.url).searchParams.get("date");
  if (date !== null && !isBetaLearningDate(date)) return NextResponse.json({ error: "Invalid learning date" }, { status: 400, headers: noStore });

  const client = createAdminSupabaseClient();
  const rows: PersistedBetaEvent[] = [];
  for (let offset = 0; offset < 10_000; offset += 500) {
    let query = client.from("beta_validation_events")
      .select("event_key,learning_date,event_type,payload,deployment_commit,recorded_at")
      .eq("user_id", viewer.userId);
    if (date) query = query.eq("learning_date", date);
    const result = await query.order("recorded_at", { ascending: true }).order("event_key", { ascending: true }).range(offset, offset + 499);
    if (result.error) {
      console.error("Beta evidence export failed", { code: result.error.code });
      return NextResponse.json({ error: "Evidence temporarily unavailable" }, { status: 503, headers: noStore });
    }
    rows.push(...(result.data ?? []));
    if ((result.data ?? []).length < 500) break;
  }
  if (rows.length >= 10_000) return NextResponse.json({ error: "Evidence export exceeds limit" }, { status: 413, headers: noStore });
  if (rows.length === 0) return NextResponse.json(buildBetaEvidenceReport(viewer.userId, rows), { headers: noStore });
  const dates = [...new Set(rows.map((row) => row.learning_date))];
  const plans = await client.from("today_plans")
    .select("id,learning_date,status,completed_at")
    .eq("user_id", viewer.userId)
    .in("learning_date", dates)
    .range(0, 999);
  if (plans.error || (plans.data?.length ?? 0) >= 1_000) return NextResponse.json({ error: "Today verification unavailable" }, { status: 503, headers: noStore });
  const completedPlans = (plans.data ?? []).filter((plan) => plan.status === "complete" && plan.completed_at);
  if (completedPlans.length === 0) return NextResponse.json(buildBetaEvidenceReport(viewer.userId, rows), { headers: noStore });
  const sessions = await client.from("today_sessions")
    .select("plan_id,status,completed_at")
    .eq("user_id", viewer.userId)
    .in("plan_id", completedPlans.map((plan) => plan.id))
    .range(0, 999);
  if (sessions.error || (sessions.data?.length ?? 0) >= 1_000) return NextResponse.json({ error: "Today verification unavailable" }, { status: 503, headers: noStore });
  const completedSessions = new Map((sessions.data ?? [])
    .filter((session) => session.status === "complete" && session.completed_at)
    .map((session) => [session.plan_id, session.completed_at!]));
  const verifiedToday = completedPlans.flatMap((plan) => {
    const completedAt = completedSessions.get(plan.id);
    return completedAt ? [{ learningDate: plan.learning_date, completedAt }] : [];
  });
  return NextResponse.json(buildBetaEvidenceReport(viewer.userId, rows, verifiedToday), { headers: noStore });
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_BETA_EVIDENCE_ENABLED !== "1") return NextResponse.json({ error: "Not found" }, { status: 404, headers: noStore });
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;

  let body: string;
  try { body = await request.text(); } catch { return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: noStore }); }
  if (body.length > 8_192) return NextResponse.json({ error: "Evidence too large" }, { status: 413, headers: noStore });

  let submission;
  try { submission = parseBetaEvidenceSubmission(JSON.parse(body)); }
  catch { return NextResponse.json({ error: "Invalid evidence" }, { status: 400, headers: noStore }); }

  const client = createAdminSupabaseClient();
  const row = {
    user_id: viewer.userId,
    event_key: submission.eventKey,
    learning_date: submission.learningDate,
    event_type: submission.event.type,
    payload: submission.event as Json,
    deployment_commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.ROOTLINE_BETA_COMMIT ?? "local-unversioned").slice(0, 80),
  };
  const inserted = await client.from("beta_validation_events").insert(row);
  if (!inserted.error) return NextResponse.json({ ok: true }, { status: 201, headers: noStore });

  if (inserted.error.code === "23505") {
    const existing = await client.from("beta_validation_events")
      .select("learning_date,event_type,payload")
      .eq("user_id", viewer.userId)
      .eq("event_key", submission.eventKey)
      .maybeSingle();
    if (!existing.error && existing.data
      && existing.data.learning_date === submission.learningDate
      && existing.data.event_type === submission.event.type
      && isDeepStrictEqual(existing.data.payload, submission.event)) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200, headers: noStore });
    }
    return NextResponse.json({ error: "Event key conflict" }, { status: 409, headers: noStore });
  }

  console.error("Beta evidence insert failed", { code: inserted.error.code });
  return NextResponse.json({ error: "Evidence temporarily unavailable" }, { status: 503, headers: noStore });
}
