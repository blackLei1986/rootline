"use server";

import { z } from "zod";
import { updateCurrentDisplayName, sendCurrentUserPasswordReset } from "@/lib/auth/account";
import type { AccountSettingsState } from "@/lib/auth/account-settings-state";
import { toAuthMessage } from "@/lib/auth/errors";

const displayNameSchema = z.string().trim().min(1, "请输入显示名。").max(80, "显示名不能超过 80 个字符。");

export async function updateDisplayNameAction(_state: AccountSettingsState, formData: FormData): Promise<AccountSettingsState> {
  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) return { status: "error", fieldErrors: { displayName: parsed.error.issues.map((issue) => issue.message) } };
  try {
    await updateCurrentDisplayName(parsed.data);
    return { status: "success", message: "显示名已更新。" };
  } catch (error) {
    return { status: "error", message: toAuthMessage(error) };
  }
}

export async function requestPasswordResetAction(): Promise<void> {
  await sendCurrentUserPasswordReset();
}
