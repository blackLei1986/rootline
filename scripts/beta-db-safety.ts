export function validateDisposableDbUrl(input: string): string {
  let url: URL;
  try { url = new URL(input); }
  catch { throw new Error("A marked disposable local database is required."); }
  const port = Number(url.port);
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.username !== "postgres"
    || url.pathname !== "/postgres" || !Number.isInteger(port) || port < 56000 || port > 56999
    || url.searchParams.getAll("beta_disposable").length !== 1
    || url.searchParams.get("beta_disposable") !== "1"
    || url.searchParams.getAll("sslmode").length !== 1
    || url.searchParams.get("sslmode") !== "disable" || url.hash) {
    throw new Error("A marked disposable local database is required.");
  }
  url.searchParams.delete("beta_disposable");
  return url.toString();
}

export function buildBetaDbCommands(dbUrl: string, repoRoot: string, managedWorkdir?: string): string[][] {
  if (managedWorkdir) return [
    ["db", "reset", "--no-seed", "--workdir", managedWorkdir],
    ["test", "db", "--workdir", managedWorkdir]
  ];
  return [
    ["db", "reset", "--db-url", dbUrl, "--no-seed", "--workdir", repoRoot],
    ["test", "db", "--db-url", dbUrl, "--workdir", repoRoot]
  ];
}
