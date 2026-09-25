import Link from "next/link";

export interface ProductStateProps {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  variant: "loading" | "empty" | "error";
}

export function ProductState({title, description, actionHref, actionLabel, variant}: ProductStateProps) {
  return <section role={variant === "error" ? "alert" : "status"} className="min-h-48 rounded-3xl border bg-white p-6 sm:p-8">
    <h2 className="text-xl font-bold">{title}</h2>
    <p className="mt-2 text-sm text-[var(--muted-foreground)]">{description}</p>
    {actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex min-h-11 items-center rounded-xl border px-5 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">{actionLabel}</Link>}
  </section>;
}
