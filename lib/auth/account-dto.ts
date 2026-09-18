export interface AccountDTO {
  email: string;
  displayName: string | null;
}

interface AccountSource {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export function toAccountDTO(source: AccountSource): AccountDTO {
  const candidate = source.user_metadata?.display_name;
  return {
    email: source.email ?? "",
    displayName: typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
  };
}
