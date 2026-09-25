import {describe, expect, it} from "vitest";
import {buildTrustedRootDirectory} from "@/lib/roots/trusted-directory";

const links = [
  {rootId: "gold-spect", rootKey: "spect", wordId: "inspect"},
  {rootId: "gold-spect", rootKey: "spect", wordId: "inspect"},
  {rootId: "gold-spect", rootKey: "spect", wordId: "respect"}
];

describe("trusted Roots directory", () => {
  it("deduplicates verified links and never promotes static-only roots", () => {
    expect(buildTrustedRootDirectory(links, new Map([["inspect", "stable"]])))
      .toEqual([{rootKey: "spect", wordIds: ["inspect", "respect"], usable: 2, learned: 1, stable: 1}]);
    expect(buildTrustedRootDirectory([], new Map())).toEqual([]);
  });

  it("derives progress only from the viewer's categories", () => {
    const first = buildTrustedRootDirectory(links, new Map([["inspect", "stable"]]));
    const second = buildTrustedRootDirectory(links, new Map([["respect", "learning"]]));
    expect(first[0].stable).toBe(1);
    expect(second[0].stable).toBe(0);
    expect(second[0].learned).toBe(1);
  });
});
