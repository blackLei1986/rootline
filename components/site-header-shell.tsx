import { Suspense } from "react";
import { getOptionalViewer } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site-header";
import { BetaRouteTracker } from "@/components/beta/beta-route-tracker";

async function AuthenticatedHeader() {
  const viewer = await getOptionalViewer();
  return <><SiteHeader account={viewer ? { email: viewer.email, displayName: null } : null} /><BetaRouteTracker userId={viewer?.emailVerified ? viewer.userId : undefined} /></>;
}

export function SiteHeaderShell() {
  return <Suspense fallback={<SiteHeader account={null} />}><AuthenticatedHeader /></Suspense>;
}
