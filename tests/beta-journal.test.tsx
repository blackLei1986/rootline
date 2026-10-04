import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BetaJournal } from "@/components/today/beta-journal";
import { BetaParticipantControls } from "@/components/beta/beta-participant-controls";
import { readBetaLog, recordBetaEvent, setBetaParticipation } from "@/lib/beta/validation-store";

describe("optional local Beta feedback", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("requires explicit opt-in and explains that data stays in this browser", () => {
    render(<BetaParticipantControls userId="account-a" />);
    expect(screen.getByText(/只保存在当前浏览器/)).toBeVisible();
    expect(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/})).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/}));
    expect(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/})).toBeChecked();
    expect(localStorage.getItem("rootline:beta-validation:v1:participation:account-a")).toBe("true");
  });

  it("saves bounded ratings and text while skip leaves Today APIs untouched", () => {
    setBetaParticipation("account-a", true);
    render(<BetaJournal userId="account-a" learningDate="2026-09-26" />);
    for (const rating of ["难度 4", "疲劳 3", "词根帮助 5", "复习帮助 4"]) fireEvent.click(screen.getByRole("radio", {name: rating}));
    fireEvent.click(screen.getByRole("radio", {name: "明天继续"}));
    const note = screen.getByRole("textbox", {name: /最不舒服/}) as HTMLTextAreaElement;
    fireEvent.change(note, {target: {value: "x".repeat(700)}});
    expect(note.value).toHaveLength(500);
    fireEvent.click(screen.getByRole("button", {name: "保存反馈"}));
    expect(readBetaLog("account-a").days[0].journal?.ratings).toEqual({difficulty: 4, fatigue: 3, rootUsefulness: 5, reviewUsefulness: 4});
    expect(readBetaLog("account-a").days[0].journal?.note).toHaveLength(500);
  });

  it("lets the participant skip the journal without writing feedback", () => {
    setBetaParticipation("account-a", true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<BetaJournal userId="account-a" learningDate="2026-09-26" />);
    fireEvent.click(screen.getByRole("button", {name: "跳过反馈"}));
    expect(screen.queryByText("Beta 日记（可跳过）")).not.toBeInTheDocument();
    expect(readBetaLog("account-a").days).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not carry opt-in state across account switches", () => {
    render(<BetaParticipantControls userId="account-a" />);
    fireEvent.click(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/}));
    cleanup();
    render(<BetaParticipantControls userId="account-b" />);
    expect(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/})).not.toBeChecked();
  });

  it("switches journal state with the account instead of retaining another account's answers", () => {
    setBetaParticipation("account-a", true);
    setBetaParticipation("account-b", true);
    const ratings = {difficulty: 2, fatigue: 2, rootUsefulness: 2, reviewUsefulness: 2};
    recordBetaEvent("account-a", "2026-09-26", {type: "journal", ratings, continueTomorrow: false, note: "Account A private note"});
    recordBetaEvent("account-b", "2026-09-26", {type: "journal", ratings, continueTomorrow: true, note: "Account B private note"});
    const view = render(<BetaJournal userId="account-a" learningDate="2026-09-26" />);
    expect(screen.getByRole("textbox", {name: /最不舒服/})).toHaveValue("Account A private note");

    view.rerender(<BetaJournal userId="account-b" learningDate="2026-09-26" />);
    expect(screen.getByRole("textbox", {name: /最不舒服/})).toHaveValue("Account B private note");
  });

  it("exports and deletes only the selected account record", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:beta-export");
    vi.stubGlobal("URL", {...URL, createObjectURL, revokeObjectURL: vi.fn()});
    render(<BetaParticipantControls userId="account-a" />);
    fireEvent.click(screen.getByRole("checkbox", {name: /加入 7 天 Beta 验证/}));
    fireEvent.click(screen.getByRole("button", {name: "导出验证记录"}));
    expect(createObjectURL).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", {name: "删除验证记录"}));
    expect(localStorage.getItem("rootline:beta-validation:v1:participation:account-a")).toBeNull();
  });

  it("warns instead of exporting an empty report for a malformed local log", () => {
    setBetaParticipation("account-a", true);
    localStorage.setItem("rootline:beta-validation:v1:log:account-a", "not-json");
    const createObjectURL = vi.fn();
    vi.stubGlobal("URL", {...URL, createObjectURL});
    render(<BetaParticipantControls userId="account-a" />);
    expect(screen.getByRole("alert")).toHaveTextContent("无法读取");
    fireEvent.click(screen.getByRole("button", {name: "导出验证记录"}));
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(localStorage.getItem("rootline:beta-validation:v1:log:account-a")).toBe("not-json");
  });

  it("discloses server storage and downloads the authenticated server report in Web Beta mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_BETA_EVIDENCE_ENABLED", "1");
    const report = { version: 2, accountId: "account-a", days: [{ learningDate: "2026-10-04" }] };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectURL = vi.fn(() => "blob:server-beta-export");
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    render(<BetaParticipantControls userId="account-a" />);
    expect(screen.getByText(/隔离的 Beta 服务器/)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: /加入 7 天 Beta 验证/ }));
    fireEvent.click(screen.getByRole("button", { name: "导出验证记录" }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/beta/evidence", expect.objectContaining({ credentials: "same-origin" }));
  });
});
