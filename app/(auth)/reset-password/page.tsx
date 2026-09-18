import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "设置新密码" };

export default function ResetPasswordPage() {
  return <AuthCard title="设置新密码" description="使用至少 8 个字符，并包含字母、数字和特殊字符。"><ResetForm /></AuthCard>;
}
