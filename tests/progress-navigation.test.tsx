import {cleanup, render, screen, within} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";

let currentPath = "/progress";
vi.mock("next/navigation", () => ({usePathname: () => currentPath}));
vi.mock("@/components/account-menu", () => ({AccountMenu: () => <span>Account</span>}));

import {SiteHeader} from "@/components/site-header";

afterEach(() => { cleanup(); currentPath = "/progress"; });

describe("Progress first-level navigation", () => {
  it("keeps Today, Roots, Reading, Progress, and mobile Me without old competing modes", () => {
    render(<SiteHeader account={null} />);
    const desktop = screen.getByRole("navigation", {name: "主导航"});
    const mobile = screen.getByRole("navigation", {name: "移动主导航"});
    expect(within(desktop).getAllByRole("link").map((link) => link.getAttribute("href")))
      .toEqual(["/today", "/roots", "/reading", "/progress", "/settings/account"]);
    expect(within(mobile).getAllByRole("link").map((link) => link.getAttribute("href")))
      .toEqual(["/today", "/roots", "/reading", "/progress", "/settings/account"]);
    for (const mode of ["Rapid", "Quiz", "Course", "Recovery"]) {
      expect(screen.queryByRole("link", {name: mode})).not.toBeInTheDocument();
    }
  });

  it("marks Me as the current destination in both layouts", () => {
    currentPath = "/settings/account";
    render(<SiteHeader account={null} />);
    expect(within(screen.getByRole("navigation", {name: "主导航"})).getByRole("link", {name: "Me"}))
      .toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("navigation", {name: "移动主导航"})).getByRole("link", {name: "Me"}))
      .toHaveAttribute("aria-current", "page");
  });
});
