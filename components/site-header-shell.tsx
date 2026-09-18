import { Suspense } from "react";
import { getOptionalViewer } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site-header";

async function AuthenticatedHeader() {
  const viewer = await getOptionalViewer();
  return <SiteHeader account={viewer ? { email: viewer.email, displayName: null } : null} />;
}

export function SiteHeaderShell() {
  return <Suspense fallback={<SiteHeader account={null} />}><AuthenticatedHeader /></Suspense>;
}
