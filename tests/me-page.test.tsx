import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";

vi.mock("next/navigation", () => ({redirect: vi.fn()}));
vi.mock("@/lib/auth/account", () => ({getCurrentAccount: async () => ({email: "reader@example.com", displayName: "Reader", timeZone: "Asia/Shanghai", dailyTimeBudget: 30})}));
vi.mock("@/lib/auth/session", () => ({getOptionalViewer: async () => ({userId: "test-user", email: "reader@example.com", emailVerified: true})}));
vi.mock("@/components/account-settings-form", () => ({AccountSettingsForm: () => <div>Display name form</div>, TimeZoneSettingsForm: () => <div>Timezone form</div>}));
vi.mock("@/app/(auth)/actions", () => ({logoutAction: vi.fn()}));
vi.mock("@/app/settings/account/actions", () => ({requestPasswordResetAction: vi.fn()}));

import AccountSettingsPage from "@/app/settings/account/page";

describe("Me page", () => {
  it("shows current timezone, read-only daily budget, and logout", async () => {
    render(await AccountSettingsPage());
    expect(screen.getByText(/Asia\/Shanghai/)).toBeVisible();
    expect(screen.getByText(/30 分钟/)).toBeVisible();
    expect(screen.getByRole("button", {name: "退出登录"})).toBeVisible();
    expect(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/})).toBeInTheDocument();
  });
});
