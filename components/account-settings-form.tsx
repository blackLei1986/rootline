"use client";

import { useActionState } from "react";
import { updateDisplayNameAction, updateTimeZoneAction } from "@/app/settings/account/actions";
import { INITIAL_ACCOUNT_SETTINGS_STATE } from "@/lib/auth/account-settings-state";
import { Button } from "@/components/ui/button";

export function AccountSettingsForm({ displayName }: { displayName: string | null }) {
  const [state, action, pending] = useActionState(updateDisplayNameAction, INITIAL_ACCOUNT_SETTINGS_STATE);
  return <form action={action} className="space-y-3"><label className="block text-sm font-semibold">显示名<input name="displayName" defaultValue={displayName ?? ""} className="mt-2 h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:border-indigo-400" /></label>{state.fieldErrors?.displayName?.map((message) => <p key={message} className="text-sm text-rose-700">{message}</p>)}{state.message && <p className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>}<Button type="submit" disabled={pending}>{pending ? "正在保存…" : "保存显示名"}</Button></form>;
}

export function TimeZoneSettingsForm({ timeZone }: { timeZone: string }) {
  const [state, action, pending] = useActionState(updateTimeZoneAction, INITIAL_ACCOUNT_SETTINGS_STATE);
  return <form action={action} className="space-y-3"><label className="block text-sm font-semibold">学习时区<input name="timeZone" defaultValue={timeZone} list="time-zone-suggestions" autoComplete="off" className="mt-2 h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:border-indigo-400" /></label><datalist id="time-zone-suggestions"><option value="Asia/Shanghai" /><option value="Asia/Tokyo" /><option value="Europe/London" /><option value="America/New_York" /><option value="America/Los_Angeles" /></datalist><p className="text-sm text-[var(--muted-foreground)]">以所在地的 IANA 时区确定 Today、阅读和进度日期。</p>{state.fieldErrors?.timeZone?.map((message) => <p key={message} className="text-sm text-rose-700">{message}</p>)}{state.message && <p role="status" className={state.status === "success" ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>{state.message}</p>}<Button type="submit" disabled={pending}>{pending ? "正在保存…" : "保存时区"}</Button></form>;
}
