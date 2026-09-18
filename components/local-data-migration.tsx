"use client";

import { useEffect, useState } from "react";
import { CloudUpload, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStorageAdapter } from "@/lib/storage-adapter";
import {
  MIGRATION_COMPLETE_KEY,
  createLocalSnapshot,
  createMigrationEntities,
  type LocalMigrationSnapshot
} from "@/lib/sync/local-snapshot";
import { migrateLocalSnapshot } from "@/lib/sync/migration-client";
import type { MigrationSummary } from "@/types/migration";

type MigrationView =
  | { status: "checking" }
  | { status: "hidden" }
  | { status: "ready"; snapshot: LocalMigrationSnapshot; count: number }
  | { status: "running"; snapshot: LocalMigrationSnapshot; count: number }
  | { status: "failed"; snapshot: LocalMigrationSnapshot; count: number; message: string }
  | { status: "complete"; summary: MigrationSummary };

export function LocalDataMigration() {
  const [view, setView] = useState<MigrationView>({ status: "checking" });

  useEffect(() => {
    let active = true;
    void (async () => {
      const snapshot = createLocalSnapshot();
      if (alreadyMigrated(snapshot)) {
        if (active) setView({ status: "hidden" });
        return;
      }
      const entities = await createMigrationEntities(snapshot);
      const meaningfulCount = Math.max(0, entities.length - 1);
      if (active) {
        setView(
          meaningfulCount > 0
            ? { status: "ready", snapshot, count: entities.length }
            : { status: "hidden" }
        );
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (view.status === "checking" || view.status === "hidden") return null;

  if (view.status === "complete") {
    return (
      <aside className="border-b border-emerald-200 bg-emerald-50 text-emerald-950">
        <div className="page-shell flex items-center justify-between gap-4 py-3 text-sm">
          <p>
            本地学习记录已安全导入：{view.summary.imported} 项成功，
            {view.summary.failed} 项待重试。本地副本仍然保留。
          </p>
          <button
            type="button"
            className="rounded-lg p-1 hover:bg-emerald-100"
            aria-label="关闭迁移提示"
            onClick={() => setView({ status: "hidden" })}
          >
            <X className="size-4" />
          </button>
        </div>
      </aside>
    );
  }

  const running = view.status === "running";
  const failed = view.status === "failed";

  async function startMigration() {
    if (view.status !== "ready" && view.status !== "failed") return;
    const snapshot = view.snapshot;
    const count = view.count;
    setView({ status: "running", snapshot, count });
    try {
      const summary = await migrateLocalSnapshot(snapshot);
      if (summary.complete) {
        setView({ status: "complete", summary });
      } else {
        setView({
          status: "failed",
          snapshot,
          count,
          message: `${summary.failed} 项未导入，可以安全重试。`
        });
      }
    } catch (error) {
      setView({
        status: "failed",
        snapshot,
        count,
        message: error instanceof Error ? error.message : "导入失败，请重试。"
      });
    }
  }

  return (
    <aside className="border-b border-indigo-200 bg-indigo-50 text-indigo-950">
      <div className="page-shell flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CloudUpload className="mt-0.5 size-5 shrink-0 text-[var(--primary)]" />
          <div>
            <p className="text-sm font-semibold">
              {running ? "正在同步本地学习记录…" : "发现这台设备上的学习记录"}
            </p>
            <p className="mt-0.5 text-xs text-indigo-800">
              共 {view.count} 项。导入后可跨设备继续学习，本地原始记录不会被删除。
              {failed ? ` ${view.message}` : ""}
            </p>
          </div>
        </div>
        <Button size="sm" disabled={running} onClick={() => void startMigration()}>
          {failed ? <RotateCcw className="size-4" /> : <CloudUpload className="size-4" />}
          {running ? "导入中" : failed ? "重试" : "导入云端"}
        </Button>
      </div>
    </aside>
  );
}

function alreadyMigrated(snapshot: LocalMigrationSnapshot): boolean {
  const raw = getStorageAdapter().getItem(MIGRATION_COMPLETE_KEY);
  if (!raw) return false;
  try {
    const marker = JSON.parse(raw) as {
      sourceInstallationId?: string;
      schemaVersion?: number;
    };
    return (
      marker.sourceInstallationId === snapshot.sourceInstallationId &&
      marker.schemaVersion === snapshot.schemaVersion
    );
  } catch {
    return false;
  }
}
