import { describe, expect, it } from "vitest";
import { getWordById } from "@/data/words";
import { getWordBreakdownPieces } from "@/components/word-breakdown";

describe("word breakdown", () => {
  it("falls back safely for a rootless high-value word", () => {
    const word = getWordById("significant")!;
    expect(word.rootIds).toHaveLength(0);
    expect(getWordBreakdownPieces(word)).toEqual([{ form: "significant", meaning: "important or large enough to be noticed" }]);
  });

  it("keeps prefix, root and suffix pieces when available", () => {
    const pieces = getWordBreakdownPieces(getWordById("inspect")!);
    expect(pieces.map((piece) => piece.form)).toEqual(["in-", "spect"]);
  });
});
