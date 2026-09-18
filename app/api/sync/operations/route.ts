import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applySyncOperation } from "@/lib/sync/learning-sync";
import { validateSyncOperation } from "@/lib/sync/sync-schemas";
import { AuthBoundaryError } from "@/types/auth";
import { createProductionTodayEventService } from "@/lib/today/server-service";
import type { TodayEventInput } from "@/lib/today/events";

export async function POST(request: Request) {
  try {
    const viewer = await requireVerifiedViewer();
    const operation = validateSyncOperation(await request.json());
    if (operation.kind === "today-event") {
      const payload = operation.payload as Omit<TodayEventInput, "operationId">;
      await createProductionTodayEventService().recordTodayEvent(viewer.userId, {
        ...payload,
        operationId: operation.id,
        planId: operation.entityId
      });
      return NextResponse.json(
        { applied: true },
        { headers: { "cache-control": "private, no-store" } }
      );
    }
    const client = await createServerSupabaseClient();
    const applied = await applySyncOperation(client, viewer.userId, operation);
    return NextResponse.json(
      { applied },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof AuthBoundaryError) {
      return NextResponse.json({ message: "请先登录并验证邮箱。" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "同步数据格式不正确。" }, { status: 400 });
    }
    return NextResponse.json({ message: "同步暂时失败，请稍后重试。" }, { status: 500 });
  }
}
