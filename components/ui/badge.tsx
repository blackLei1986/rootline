import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-[var(--primary-soft)] text-[var(--primary)]",
      secondary: "border-transparent bg-[var(--muted)] text-[var(--muted-foreground)]",
      outline: "border-[var(--border)] bg-white text-[var(--foreground)]",
      success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      warning: "border-amber-200 bg-amber-50 text-amber-700",
      destructive: "border-rose-200 bg-rose-50 text-rose-700"
    }
  },
  defaultVariants: { variant: "default" }
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
