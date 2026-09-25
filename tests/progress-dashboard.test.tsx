import {cleanup, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it} from "vitest";
import {ProgressDashboard} from "@/components/progress-dashboard";
import type {ProgressDashboardDTO} from "@/lib/progress/types";

export const dashboardFixture: ProgressDashboardDTO = {
  today: {date: "2026-09-25", state: "active", completed: 12, required: 24, degradationReason: "可用词不足"},
  last7: {completed: 1, eligible: 2, percent: 50, days: [
    {date: "2026-09-24", state: "complete", completed: 30, required: 30, degradationReason: null},
    {date: "2026-09-25", state: "active", completed: 12, required: 24, degradationReason: "可用词不足"}
  ]},
  last30: {completed: 1, eligible: 2, percent: 50, days: []},
  streak: 1,
  vocabulary: {touched: 20, learning: 8, stable: 4, stablePercent: 0},
  roots: [
    {rootId: "spect", rootKey: "spect", usable: 8, learned: 5, stable: 4, percent: 50, weakWordIds: ["inspect"]},
    {rootId: "tract", rootKey: "tract", usable: 5, learned: 2, stable: 1, percent: 20, weakWordIds: []},
    {rootId: "form", rootKey: "form", usable: 10, learned: 2, stable: 0, percent: 0, weakWordIds: []},
    {rootId: "port", rootKey: "port", usable: 3, learned: 0, stable: 0, percent: 0, weakWordIds: []}
  ],
  growth: {available: true, hasTrend: true, firstObservedDate: "2026-09-24", points: [
    {date: "2026-09-24", stable: 5}, {date: "2026-09-25", stable: 4}
  ]},
  reading: {completedPracticeSessions7d: 2}
};

afterEach(() => cleanup());

describe("Progress 2.0 dashboard", () => {
  it("prioritizes stable/10K, Today, 7-day, 30-day, roots, observed growth, then Reading", () => {
    const {container} = render(<ProgressDashboard dashboard={dashboardFixture} />);
    const headings = [...container.querySelectorAll("main h2, main h3, section h2")].map((node) => node.textContent ?? "");
    expect(headings).toEqual(expect.arrayContaining(["稳定掌握", "今日学习", "近 7 日", "近 30 日", "词根掌握", "词汇增长记录", "阅读巩固"]));
    const ordered = ["稳定掌握", "今日学习", "近 7 日", "近 30 日", "词根掌握", "词汇增长记录", "阅读巩固"];
    expect(ordered.map((label) => headings.indexOf(label))).toEqual([...ordered.map((label) => headings.indexOf(label))].sort((a, b) => a - b));
    expect(screen.getByRole("link", {name: /继续今日学习/})).toHaveAttribute("href", "/today");
    expect(screen.getByRole("progressbar", {name: "稳定掌握词汇的 10K 进度"})).toHaveAttribute("max", "10000");
    expect(screen.getByRole("progressbar", {name: "稳定掌握词汇的 10K 进度"})).toHaveAttribute("value", "4");
    expect(screen.getByText("4 / 10,000")).toBeVisible();
    expect(screen.queryByText("估算词汇量")).not.toBeInTheDocument();
    expect(container.querySelector("[class*='min-w-[']")).toBeNull();
  });

  it("shows the frozen target and shortage reason, partial-history denominators, and labeled day states", () => {
    render(<ProgressDashboard dashboard={dashboardFixture} />);
    expect(screen.getByText("12 / 24")).toBeVisible();
    expect(screen.getByText(/可用词不足/)).toBeVisible();
    const seven = screen.getByRole("region", {name: "近 7 日"});
    expect(within(seven).getByText(/1 \/ 2/)).toBeVisible();
    expect(within(seven).getByLabelText("2026-09-24 已完成")).toBeVisible();
    expect(within(seven).getByLabelText("2026-09-25 进行中")).toBeVisible();
    expect(within(seven).getByText(/当日未完成也计入可计天数/)).toBeVisible();
  });

  it("does not invent rates or historical growth for a new learner", () => {
    render(<ProgressDashboard dashboard={{...dashboardFixture,
      today: {date: "2026-09-25", state: "not-started", completed: 0, required: 0, degradationReason: null},
      last7: {completed: 0, eligible: 0, percent: null, days: []},
      last30: {completed: 0, eligible: 0, percent: null, days: []},
      growth: {available: true, hasTrend: false, firstObservedDate: "2026-09-25", points: [{date: "2026-09-25", stable: 0}]},
      reading: null
    }} />);
    expect(screen.getAllByText(/尚无可计学习历史/)).toHaveLength(2);
    expect(screen.getByText(/不足两个观测日/)).toBeVisible();
    expect(screen.queryByRole("region", {name: "阅读巩固"})).not.toBeInTheDocument();
  });

  it("labels snapshot failure as unavailable without hiding reliable metrics", () => {
    render(<ProgressDashboard dashboard={{...dashboardFixture,
      growth: {available: false, hasTrend: false, points: [], firstObservedDate: null}
    }} />);
    expect(screen.getByText(/增长记录暂不可用/)).toBeVisible();
    expect(screen.getByText("4 / 10,000")).toBeVisible();
  });
});
