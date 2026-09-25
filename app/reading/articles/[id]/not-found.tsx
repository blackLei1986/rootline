import {ProductState} from "@/components/product-state";
export default function NotFound() { return <main className="page-shell py-10"><ProductState title="这篇文章暂时无法打开" description="文章可能已下线，或不在你的今日推荐中。" actionHref="/reading" actionLabel="返回今日阅读" variant="empty" /></main>; }
