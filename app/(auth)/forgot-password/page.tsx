import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "重置密码" };

export default function ForgotPasswordPage() {
  return <AuthCard title="找回密码" description="输入邮箱，我们会发送安全的密码重置链接。"><ForgotPasswordForm /></AuthCard>;
}
