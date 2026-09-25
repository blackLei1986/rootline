import {cleanup, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("next/navigation", () => ({usePathname: () => "/progress"}));
vi.mock("@/components/account-menu", () => ({AccountMenu: () => <span>Account</span>}));

import {SiteHeader} from "@/components/site-header";

afterEach(() => cleanup());

describe("Progress first-level navigation", () => {
  it("keeps Today, Roots, Reading, Progress, and mobile Me without old competing modes", () => {
    render(<SiteHeader account={null} />);
    const desktop = screen.getByRole("navigation", {name: "主导航"});
    const mobile = screen.getByRole("navigation", {name: "移动主导航"});
    expect(within(desktop).getAllByRole("link").map((link) => link.getAttribute("href")))
      .toEqual(["/today", "/roots", "/reading", "/progress"]);
    expect(within(mobile).getAllByRole("link").map((link) => link.getAttribute("href")))
      .toEqual(["/today", "/roots", "/reading", "/progress", "/settings/account"]);
    for (const mode of ["Rapid", "Quiz", "Course", "Recovery"]) {
      expect(screen.queryByRole("link", {name: mode})).not.toBeInTheDocument();
    }
  });
});
