import "server-only";

import { getServerEnv } from "@/lib/config/env";
import { requireVerifiedViewer } from "@/lib/auth/session";
import type { AccountDTO } from "@/lib/auth/account-dto";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getCurrentAccount(): Promise<AccountDTO> {
  const viewer = await requireVerifiedViewer();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", viewer.userId)
    .maybeSingle();

  return {
    email: viewer.email,
    displayName: typeof data?.display_name === "string" ? data.display_name : null
  };
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
