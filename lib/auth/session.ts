import { cache } from "react";
import { isCloudConfigured } from "@/lib/config/env";
import { assertVerifiedViewer } from "@/lib/auth/policy";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthBoundaryError, type ViewerDTO } from "@/types/auth";

export const getOptionalViewer = cache(async (): Promise<ViewerDTO | null> => {
  if (!isCloudConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  return {
    userId: data.user.id,
    email: data.user.email,
    emailVerified: Boolean(data.user.email_confirmed_at)
  };
});

export async function requireViewer(): Promise<ViewerDTO> {
  const viewer = await getOptionalViewer();
  if (!viewer) throw new AuthBoundaryError("AUTH_REQUIRED", "Authentication is required.");
  return viewer;
}

export async function requireVerifiedViewer(): Promise<ViewerDTO> {
  return assertVerifiedViewer(await requireViewer());
}
