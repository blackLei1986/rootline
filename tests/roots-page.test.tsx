import {render, screen} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";

const fixture = vi.hoisted(() => ({rows: [] as Array<{rootKey: string; wordIds: string[]; usable: number; learned: number; stable: number}>, personal: false}));
vi.mock("@/lib/roots/server", () => ({loadTrustedRootDirectory: async () => ({rows: fixture.rows, personal: fixture.personal,
  words: new Map([["inspect", {word: "inspect", coreMeaningZh: "检查"}]])})}));
vi.mock("@/lib/auth/session", () => ({getOptionalViewer: async () => fixture.personal ? {userId: "owner", emailVerified: true} : null}));
vi.mock("next/server", () => ({connection: async () => {}}));
vi.mock("next/navigation", () => ({notFound: () => {throw new Error("404");}}));

import RootsPage from "@/app/roots/page";
import RootDetailPage from "@/app/roots/[root]/page";

beforeEach(() => {fixture.rows = []; fixture.personal = false;});

describe("trusted Roots pages", () => {
  it("shows an honest empty state without published Gold links", async () => {
    render(await RootsPage());
    expect(screen.getByText(/暂无已核验词根/)).toBeVisible();
    expect(screen.queryByText(/20 个核心词根/)).not.toBeInTheDocument();
  });

  it("shows trusted family content anonymously without personal counts", async () => {
    fixture.rows = [{rootKey: "spect", wordIds: ["inspect"], usable: 1, learned: 0, stable: 0}];
    render(await RootsPage());
    expect(screen.getByRole("link", {name: /spect/})).toHaveAttribute("href", "/roots/spect");
    expect(screen.queryByText(/稳定掌握/)).not.toBeInTheDocument();
    render(await RootDetailPage({params: Promise.resolve({root: "spect"})}));
    expect(screen.getByText("inspect")).toBeVisible();
  });

  it("404s a static-only or unknown root key", async () => {
    fixture.rows = [{rootKey: "spect", wordIds: ["inspect"], usable: 1, learned: 0, stable: 0}];
    await expect(RootDetailPage({params: Promise.resolve({root: "port"})})).rejects.toThrow("404");
  });
});
