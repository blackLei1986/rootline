import { NextResponse, type NextRequest } from "next/server";
import { isCloudConfigured } from "@/lib/config/env";
import { safeReturnPath } from "@/lib/auth/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  if (!isCloudConfigured()) {
    url.pathname = "/login";
    url.search = "?error=service-unavailable";
    return NextResponse.redirect(url);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    url.pathname = "/login";
    url.search = "?error=invalid-link";
    return NextResponse.redirect(url);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    url.pathname = "/login";
    url.search = "?error=expired-link";
    return NextResponse.redirect(url);
  }

  url.pathname = safeReturnPath(request.nextUrl.searchParams.get("next"));
  url.search = "";
  return NextResponse.redirect(url);
}
