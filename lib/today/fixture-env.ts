export function isLocalTodayFixtureEnabled(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production" && env.ROOTLINE_E2E_FIXTURES === "1";
}
