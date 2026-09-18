"use client";

import type { AuthActionState } from "@/lib/auth/action-state";

export function AuthField({ label, name, type = "text", autoComplete, error }: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string[];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="mt-2 h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      {error?.map((message) => <span key={message} className="mt-1 block text-xs font-medium text-rose-600">{message}</span>)}
    </label>
  );
}

export function AuthMessage({ state }: { state: AuthActionState }) {
  if (!state.message) return null;
  const color = state.status === "success" ? "text-emerald-700" : "text-rose-700";
  return <p role="status" className={`rounded-xl bg-[var(--muted)] p-3 text-sm ${color}`}>{state.message}</p>;
}
