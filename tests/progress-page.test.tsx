import {cleanup, render, screen} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ProgressDashboardDTO} from "@/lib/progress/types";

const dashboardFixture: ProgressDashboardDTO = {
  today: {date: "2026-09-25", state: "active", completed: 1, required: 2, degradationReason: null},
  last7: {completed: 0, eligible: 1, percent: 0, days: []},
  last30: {completed: 0, eligible: 1, percent: 0, days: []},
  streak: 0, vocabulary: {touched: 0, learning: 0, stable: 4, stablePercent: 0},
  roots: [], growth: {available: true, hasTrend: false, firstObservedDate: "2026-09-25", points: [{date: "2026-09-25", stable: 4}]},
  reading: null
};

const mocks = vi.hoisted(() => ({getOptionalViewer: vi.fn(), getDashboard: vi.fn(), connection: vi.fn()}));
vi.mock("@/lib/auth/session", () => ({getOptionalViewer: mocks.getOptionalViewer}));
vi.mock("@/lib/progress/server", () => ({createProductionProgressService: () => ({getDashboard: mocks.getDashboard})}));
vi.mock("next/server", () => ({connection: mocks.connection}));

import ProgressPage from "@/app/progress/page";

beforeEach(() => {
  mocks.getOptionalViewer.mockReset();
  mocks.getDashboard.mockReset();
  mocks.connection.mockReset().mockResolvedValue(undefined);
});
afterEach(() => cleanup());

describe("Progress account page", () => {
  it("does not query private progress for signed-out or unverified visitors", async () => {
    mocks.getOptionalViewer.mockResolvedValue(null);
    const signedOut = render(await ProgressPage());
    expect(screen.getByRole("link", {name: /登录/})).toHaveAttribute("href", "/login?next=%2Fprogress");
    expect(mocks.getDashboard).not.toHaveBeenCalled();
    signedOut.unmount();
    mocks.getOptionalViewer.mockResolvedValue({userId: "unverified", email: "u@example.test", emailVerified: false});
    render(await ProgressPage());
    expect(screen.getByRole("heading", {name: "验证邮箱后查看学习进度"})).toBeVisible();
    expect(mocks.getDashboard).not.toHaveBeenCalled();
  });

  it("renders only the verified account DTO at request time", async () => {
    mocks.getOptionalViewer.mockResolvedValue({userId: "owner", email: "o@example.test", emailVerified: true});
    mocks.getDashboard.mockResolvedValue(dashboardFixture);
    render(await ProgressPage());
    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(mocks.getDashboard).toHaveBeenCalledWith("owner", expect.any(Date));
    expect(screen.getByText("4 / 10,000")).toBeVisible();
  });

  it("surfaces authoritative source failure, not a fabricated zero", async () => {
    mocks.getOptionalViewer.mockResolvedValue({userId: "owner", email: "o@example.test", emailVerified: true});
    mocks.getDashboard.mockRejectedValue(new Error("private database detail"));
    render(await ProgressPage());
    expect(screen.getByRole("alert")).toHaveTextContent("学习进度暂时不可用");
    expect(screen.getByRole("link", {name: "重试"})).toHaveAttribute("href", "/progress");
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });
});
