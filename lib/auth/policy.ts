import { AuthBoundaryError, type ViewerDTO } from "@/types/auth";

export async function assertVerifiedViewer(viewer: ViewerDTO): Promise<ViewerDTO> {
  if (!viewer.emailVerified) {
    throw new AuthBoundaryError("EMAIL_NOT_VERIFIED", "Email verification is required.");
  }
  return viewer;
}
