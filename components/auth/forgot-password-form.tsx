"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/(auth)/actions";
import { INITIAL_AUTH_ACTION_STATE } from "@/lib/auth/action-state";
import { AuthField, AuthMessage } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL_AUTH_ACTION_STATE);
  return <form action={action} className="space-y-4"><AuthField label="邮箱" name="email" type="email" autoComplete="email" error={state.fieldErrors?.email} /><AuthMessage state={state} /><Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? "正在发送…" : "发送重置邮件"}</Button></form>;
}
