import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { VOCABULARY_VERSION } from "@/config/vocabulary-scoring";
import { runPipeline } from "@/pipeline/runner";
import type { PipelineState } from "@/pipeline/types";

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) ?? "report";
const dryRun = args.includes("--dry-run");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Number(limitArg?.split("=")[1] ?? 50));
const statePath = resolve(process.cwd(), ".vocab-pipeline/state.json");
const exportPath = resolve(process.cwd(), ".vocab-pipeline/accepted.json");

async function readState(): Promise<PipelineState | undefined> {
  try { return JSON.parse(await readFile(statePath, "utf8")) as PipelineState; }
  catch { return undefined; }
}

async function main() {
  const previous = await readState();
  const result = await runPipeline(command, previous, { limit, dryRun });
  console.log(JSON.stringify({ command, dryRun, vocabularyVersion: VOCABULARY_VERSION, output: result.output }, null, 2));
  if (!dryRun && command !== "report") {
    const target = command === "export" ? exportPath : statePath;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(command === "export" ? result.output : result.state, null, 2) + "\n", "utf8");
    console.log(`Written: ${target}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
