import { NextResponse } from "next/server";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { migrationChunkSchema, validateMigrationEntity } from "@/lib/sync/migration-schemas";
import { processMigrationChunk } from "@/lib/sync/migration-service";
import {
  SupabaseMigrationBatchStore,
  SupabaseMigrationEntityWriter
} from "@/lib/sync/supabase-migration";
import { AuthBoundaryError } from "@/types/auth";
import { ZodError } from "zod";

export async function POST(request: Request) {
  try {
    const viewer = await requireVerifiedViewer();
    const parsed = migrationChunkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "迁移数据格式不正确。" }, { status: 400 });
    }
    parsed.data.entities.forEach(validateMigrationEntity);

    const client = await createServerSupabaseClient();
    const summary = await processMigrationChunk(
      viewer.userId,
      parsed.data,
      new SupabaseMigrationBatchStore(client),
      new SupabaseMigrationEntityWriter(client)
    );
    return NextResponse.json(summary, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof AuthBoundaryError) {
      return NextResponse.json({ message: "请先登录并验证邮箱。" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ message: "迁移数据格式不正确。" }, { status: 400 });
    }
    return NextResponse.json(
      { message: "迁移暂时无法完成，请稍后重试。" },
      { status: 500 }
    );
  }
}
