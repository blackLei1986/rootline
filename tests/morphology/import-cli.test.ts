import { describe, expect, it } from "vitest";

import { parseMorphologyImportArgs } from "@/lib/morphology/import-cli";

describe("parseMorphologyImportArgs", () => {
  it("accepts exactly one dry-run/apply mode for Gold dataset versions", () => {
    expect(parseMorphologyImportArgs(["--dry-run"])).toEqual({
      mode: "dry-run",
      datasetVersion: "gold-v1"
    });
    expect(parseMorphologyImportArgs(["--apply", "--version=gold-v1"])).toEqual({
      mode: "apply",
      datasetVersion: "gold-v1"
    });
    expect(parseMorphologyImportArgs(["--dry-run", "--version=gold-v2"])).toEqual({
      mode: "dry-run",
      datasetVersion: "gold-v2"
    });
  });

  it("rejects ambiguous modes and unsupported source versions", () => {
    expect(() => parseMorphologyImportArgs([])).toThrow("exactly one");
    expect(() => parseMorphologyImportArgs(["--dry-run", "--apply"])).toThrow("exactly one");
    expect(() => parseMorphologyImportArgs(["--dry-run", "--version=gold-v4"]))
      .toThrow("Unsupported Gold Dataset version");
  });
});
