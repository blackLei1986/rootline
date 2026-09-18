export interface AccountSettingsState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: { displayName?: string[] };
}

export const INITIAL_ACCOUNT_SETTINGS_STATE: AccountSettingsState = { status: "idle" };
