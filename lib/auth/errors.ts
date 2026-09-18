interface ProviderErrorLike {
  code?: string;
  message?: string;
}

const INVALID_CREDENTIAL_CODES = new Set([
  "invalid_credentials",
  "invalid_login_credentials",
  "user_not_found"
]);

export function toAuthMessage(error: unknown): string {
  const candidate = error && typeof error === "object" ? error as ProviderErrorLike : {};
  if (candidate.code && INVALID_CREDENTIAL_CODES.has(candidate.code)) {
    return "邮箱或密码不正确。";
  }
  if (candidate.code === "email_not_confirmed") return "请先完成邮箱验证。";
  if (candidate.code === "over_email_send_rate_limit" || candidate.code === "over_request_rate_limit") {
    return "操作过于频繁，请稍后再试。";
  }
  if (candidate.code === "otp_expired") return "链接已失效，请重新申请。";
  return "暂时无法完成操作，请稍后再试。";
}
