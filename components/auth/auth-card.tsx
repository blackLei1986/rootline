import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function AuthCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="page-shell flex min-h-[72vh] items-center justify-center py-10">
      <Card className="w-full max-w-md border-indigo-200 shadow-xl shadow-indigo-950/5">
        <CardContent className="p-7 sm:p-9">
          <Link href="/" className="mb-7 flex items-center gap-2 font-bold">
            <span className="grid size-9 place-items-center rounded-xl bg-[var(--primary)] text-white"><BookOpenText className="size-5" /></span>
            Rootline
          </Link>
          <h1 className="text-3xl font-bold tracking-[-0.035em]">{title}</h1>
          <p className="mt-2 leading-7 text-[var(--muted-foreground)]">{description}</p>
          <div className="mt-7">{children}</div>
        </CardContent>
      </Card>
    </div>
  );
}
