import { z } from "zod";

const inputSchema = z.object({
  mode: z.enum(["dry-run", "apply"]),
  datasetVersion: z.enum(["gold-v1", "gold-v2", "gold-v3", "gold-v4", "gold-v5"])
});

export type MorphologyImportCliArgs = z.infer<typeof inputSchema>;

export function parseMorphologyImportArgs(argv: readonly string[]): MorphologyImportCliArgs {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) {
    throw new Error("Specify exactly one of --dry-run or --apply.");
  }

  const versionArgument = argv.find((argument) => argument.startsWith("--version="));
  const datasetVersion = versionArgument?.slice("--version=".length) ?? "gold-v1";
  const parsed = inputSchema.safeParse({
    mode: dryRun ? "dry-run" : "apply",
    datasetVersion
  });
  if (!parsed.success) {
    throw new Error(`Unsupported Gold Dataset version: ${datasetVersion}.`);
  }
  return parsed.data;
}
