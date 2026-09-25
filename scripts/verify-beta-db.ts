import {existsSync, readFileSync, readdirSync, realpathSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {buildBetaDbCommands, validateDisposableDbUrl} from "./beta-db-safety";

const repoRoot = resolve(import.meta.dirname, "..");
const markedUrl = process.env.BETA_DISPOSABLE_DB_URL ?? "";
const containerName = process.env.BETA_DISPOSABLE_CONTAINER ?? "";
const dbUrl = validateDisposableDbUrl(markedUrl);
const managedWorkdir = realpathSync(process.env.BETA_SUPABASE_WORKDIR ?? "/nonexistent-rootline-beta-workdir");
if (!managedWorkdir.startsWith("/private/tmp/rootline-phase4-stack.")) {
  throw new Error("A separate temporary Phase 4 Supabase project is required.");
}
if (!/^supabase_db_rootline-phase4-beta-[A-Za-z0-9-]+$/.test(containerName)) {
  throw new Error("An exact Phase 4 disposable Supabase DB container name is required.");
}
const projectId = containerName.replace(/^supabase_db_/, "");
const config = readFileSync(resolve(managedWorkdir, "supabase/config.toml"), "utf8");
if (!config.includes(`project_id = "${projectId}"`) || !config.includes(`port = ${new URL(dbUrl).port}`)) {
  throw new Error("The temporary Supabase project identity or database port does not match the marked URL.");
}
for (const directory of ["migrations", "tests"]) {
  const source = resolve(repoRoot, "supabase", directory);
  const copy = resolve(managedWorkdir, "supabase", directory);
  const sourceFiles = readdirSync(source).sort();
  const copiedFiles = readdirSync(copy).sort();
  if (sourceFiles.length === 0 || sourceFiles.join("|") !== copiedFiles.join("|")) {
    throw new Error(`The disposable ${directory} copy differs from this branch.`);
  }
  for (const file of sourceFiles) {
    const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
    if (digest(resolve(source, file)) !== digest(resolve(copy, file))) {
      throw new Error(`The disposable ${directory}/${file} copy differs from this branch.`);
    }
  }
}

const docker = process.env.BETA_DOCKER_BIN ?? "docker";
const inspect = spawnSync(docker, ["inspect", containerName], {encoding: "utf8"});
if (inspect.status !== 0) throw new Error("The named disposable database container is not available.");
const [container] = JSON.parse(inspect.stdout) as Array<{Name: string; Config: {Image: string; Labels: Record<string, string>}; State: {Running: boolean};
  NetworkSettings: {Ports: Record<string, Array<{HostIp: string; HostPort: string}> | null>}}>;
const expectedPort = new URL(dbUrl).port;
const bindings = container?.NetworkSettings?.Ports?.["5432/tcp"] ?? [];
if (container?.Name !== `/${containerName}` || container.Config?.Labels?.["com.supabase.cli.project"] !== projectId
  || container.Config?.Labels?.["com.supabase.cli.workdir"] !== managedWorkdir
  || !/(?:^|\/)supabase\/postgres:[^/]+$/.test(container.Config?.Image ?? "") || !container.State?.Running
  || !bindings.some((binding) => binding.HostPort === expectedPort && ["127.0.0.1", "0.0.0.0"].includes(binding.HostIp))) {
  throw new Error("The named managed disposable database must be running and bound to the marked port.");
}

const cli = process.env.BETA_SUPABASE_CLI ?? resolve(repoRoot, "node_modules", ".bin", "supabase");
if (!existsSync(cli)) throw new Error("A pinned Supabase CLI binary is required before verification.");
const version = spawnSync(cli, ["--version"], {encoding: "utf8"});
if (version.status !== 0 || version.stdout.trim() !== "2.118.0") {
  throw new Error("The Beta database runner requires verified Supabase CLI 2.118.0.");
}
for (const args of buildBetaDbCommands(dbUrl, repoRoot, managedWorkdir)) {
  const result = spawnSync(cli, args, {stdio: "inherit", env: process.env});
  if (result.status !== 0) throw new Error(`Supabase CLI ${args[0]} ${args[1]} failed with status ${result.status ?? "unknown"}.`);
}
