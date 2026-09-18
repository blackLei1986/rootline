import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { safeReturnPath } from "@/lib/auth/schemas";

export const metadata: Metadata = { title: "创建账号" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthCard title="创建 Rootline 账号" description="完成邮箱验证后，学习记录会安全同步到你的账号。"><RegisterForm next={safeReturnPath(next)} /></AuthCard>;
}
