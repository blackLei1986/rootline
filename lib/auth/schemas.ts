import { z } from "zod";

const email = z.email("请输入有效邮箱地址。").trim().toLowerCase();
const strongPassword = z
  .string()
  .min(8, "密码至少需要 8 个字符。")
  .regex(/[A-Za-z]/, "密码需要包含字母。")
  .regex(/[0-9]/, "密码需要包含数字。")
  .regex(/[^A-Za-z0-9]/, "密码需要包含特殊字符。");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "请输入密码。")
});

export const registerSchema = z.object({
  email,
  password: strongPassword,
  confirmPassword: z.string()
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "两次输入的密码不一致。"
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  password: strongPassword,
  confirmPassword: z.string()
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "两次输入的密码不一致。"
});

export function safeReturnPath(value: string | null | undefined, fallback = "/today"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://rootline.local");
    if (url.origin !== "https://rootline.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
