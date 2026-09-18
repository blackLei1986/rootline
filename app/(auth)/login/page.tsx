import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { safeReturnPath } from "@/lib/auth/schemas";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthCard title="继续你的学习" description="登录后同步词汇进度、Today 计划与阅读记录。"><LoginForm next={safeReturnPath(next)} /></AuthCard>;
}
