export interface ViewerDTO {
  userId: string;
  email: string;
  emailVerified: boolean;
}

export type AuthErrorCode = "AUTH_REQUIRED" | "EMAIL_NOT_VERIFIED";

export class AuthBoundaryError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string
  ) {
    super(message);
    this.name = "AuthBoundaryError";
  }
}
