import { NextResponse } from "next/server";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { AuthBoundaryError, type ViewerDTO } from "@/types/auth";

/**
 * Require a verified viewer for a route handler, mapping the auth boundary
 * error to a proper 401/403 response instead of an unhandled 500.
 */
export async function requireVerifiedViewerHttp(): Promise<ViewerDTO | NextResponse> {
  try {
    return await requireVerifiedViewer();
  } catch (error) {
    if (error instanceof AuthBoundaryError) {
      const status = error.code === "EMAIL_NOT_VERIFIED" ? 403 : 401;
      return NextResponse.json({ error: error.code }, { status });
    }
    throw error;
  }
}
