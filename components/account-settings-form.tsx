"use client";

import { useActionState } from "react";
import { updateDisplayNameAction } from "@/app/settings/account/actions";
import { INITIAL_ACCOUNT_SETTINGS_STATE } from "@/lib/auth/account-settings-state";
import { Button } from "@/components/ui/button";

export function AccountSettingsForm({ displayName }: { displayName: string | null }) {
  const [state, action, pending] = useActionState(updateDisplayNameAction, INITIAL_ACCOUNT_SETTINGS_STATE);
  return <form action={action} className="space-y-3"><label className="block text-sm font-semibold">显示名<input name="displayName" defaultValue={displayName ?? ""} className="mt-2 h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:border-indigo-400" /></label>{state.fieldErrors?.displayName?.map((message) => <p key={message} className="text-sm text-rose-700">{message}</p>)}{state.message && <p className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>}<Button type="submit" disabled={pending}>{pending ? "正在保存…" : "保存显示名"}</Button></form>;
}
