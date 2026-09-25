import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {ProductState} from "@/components/product-state";
import TodayLoading from "@/app/today/loading";
import ArticleNotFound from "@/app/reading/articles/[id]/not-found";

afterEach(() => cleanup());

describe("product states", () => {
  it("keeps a stable loading shell", () => {
    render(<ProductState title="正在加载今日计划" description="请稍候。" variant="loading" />);
    expect(screen.getByRole("status")).toHaveClass("min-h-48");
  });

  it("shows a safe retry on error without backend detail", () => {
    render(<ProductState title="今日计划暂时无法加载" description="请检查网络后重试。" actionHref="/today" actionLabel="重试" variant="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("请检查网络后重试。");
    expect(screen.getByRole("link", {name: "重试"})).toHaveAttribute("href", "/today");
  });

  it("provides route loading and article-unavailable recovery", () => {
    const loading = render(<TodayLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("正在准备今日学习");
    loading.unmount();
    render(<ArticleNotFound />);
    expect(screen.getByRole("link", {name: "返回今日阅读"})).toHaveAttribute("href", "/reading");
  });
});
