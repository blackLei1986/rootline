"use server";

import { redirect } from "next/navigation";
import { getServerEnv, isCloudConfigured } from "@/lib/config/env";
import type { AuthActionState } from "@/lib/auth/action-state";
import { toAuthMessage } from "@/lib/auth/errors";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeReturnPath
} from "@/lib/auth/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function unavailable(): AuthActionState {
  return { status: "error", message: "云端账号服务尚未配置，请稍后再试。" };
}

export async function loginAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!isCloudConfigured()) return unavailable();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: toAuthMessage(error) };
  redirect(safeReturnPath(String(formData.get("next") ?? "")));
}

export async function registerAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!isCloudConfigured()) return unavailable();

  const env = getServerEnv();
  const next = safeReturnPath(String(formData.get("next") ?? ""));
  const callback = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", next);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callback.toString() }
  });
  if (error) return { status: "error", message: "如果该邮箱可以注册，我们会发送一封验证邮件。" };
  return { status: "success", message: "验证邮件已发送，请完成验证后登录。" };
}

export async function forgotPasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!isCloudConfigured()) return unavailable();

  const env = getServerEnv();
  const callback = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", "/reset-password");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: callback.toString() });
  return { status: "success", message: "如果该邮箱已注册，我们会发送一封密码重置邮件。" };
}

export async function resetPasswordAction(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });
  if (!parsed.success) return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  if (!isCloudConfigured()) return unavailable();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: toAuthMessage(error) };
  return { status: "success", message: "密码已更新，现在可以继续学习。" };
}

export async function logoutAction(): Promise<never> {
  if (isCloudConfigured()) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
