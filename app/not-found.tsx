import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="page-shell grid min-h-[60vh] place-items-center py-20 text-center"><div><p className="text-7xl font-bold text-[var(--primary-soft)]">404</p><h1 className="mt-3 text-2xl font-bold">这个词条还没有收录</h1><p className="mt-2 text-[var(--muted-foreground)]">试试从词根库重新选择。</p><Button asChild className="mt-6"><Link href="/roots">返回词根库</Link></Button></div></div>;
}
