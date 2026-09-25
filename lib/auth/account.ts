import "server-only";

import { getServerEnv } from "@/lib/config/env";
import { requireVerifiedViewer } from "@/lib/auth/session";
import type { AccountDTO } from "@/lib/auth/account-dto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getCurrentAccount(): Promise<AccountDTO & { timeZone: string; dailyTimeBudget: number }> {
  const viewer = await requireVerifiedViewer();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,timezone")
    .eq("user_id", viewer.userId)
    .maybeSingle();
  if (error) throw error;
  const { data: preference, error: preferenceError } = await supabase
    .from("user_preferences")
    .select("daily_time_budget")
    .eq("user_id", viewer.userId)
    .maybeSingle();
  if (preferenceError) throw preferenceError;

  return {
    email: viewer.email,
    displayName: typeof data?.display_name === "string" ? data.display_name : null,
    timeZone: typeof data?.timezone === "string" ? data.timezone : "Asia/Shanghai",
    dailyTimeBudget: typeof preference?.daily_time_budget === "number" ? preference.daily_time_budget : 20
  };
}

export async function updateCurrentTimeZone(timeZone: string): Promise<void> {
  if (!timeZone || timeZone.length > 64) throw new Error("请选择有效的学习时区。");
  try { new Intl.DateTimeFormat("en", { timeZone }); }
  catch { throw new Error("请选择有效的学习时区。"); }
  const viewer = await requireVerifiedViewer();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("profiles").update({ timezone: timeZone }).eq("user_id", viewer.userId);
  if (error) throw error;
}

export async function updateCurrentDisplayName(displayName: string): Promise<AccountDTO> {
  const viewer = await requireVerifiedViewer();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("user_id", viewer.userId);
  if (error) throw error;
  return { email: viewer.email, displayName };
}

export async function sendCurrentUserPasswordReset(): Promise<void> {
  const viewer = await requireVerifiedViewer();
  const env = getServerEnv();
  const callback = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", "/reset-password");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(viewer.email, { redirectTo: callback.toString() });
  if (error) throw error;
}
