import {describe, expect, it} from "vitest";
import {buildBetaDbCommands, validateDisposableDbUrl} from "@/scripts/beta-db-safety";

describe("disposable Beta database guard", () => {
  it("refuses missing, remote, existing-local, and unmarked URLs", () => {
    for (const bad of ["", "postgresql://postgres:postgres@db.example.com:56322/postgres?beta_disposable=1",
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres?beta_disposable=1",
      "postgresql://postgres:postgres@127.0.0.1:56322/postgres",
      "postgresql://postgres:postgres@127.0.0.1:56322/postgres?beta_disposable=1"]) {
      expect(() => validateDisposableDbUrl(bad)).toThrow(/disposable/i);
    }
  });

  it("strips only the explicit marker and builds URL-scoped, unlinked CLI commands", () => {
    const url = validateDisposableDbUrl("postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable&beta_disposable=1");
    expect(url).toBe("postgresql://postgres:postgres@127.0.0.1:56322/postgres?sslmode=disable");
    const commands = buildBetaDbCommands(url, "/tmp/rootline-beta");
    expect(commands).toEqual([
      ["db", "reset", "--db-url", url, "--no-seed", "--workdir", "/tmp/rootline-beta"],
      ["test", "db", "--db-url", url, "--workdir", "/tmp/rootline-beta"]
    ]);
    expect(commands.flat().join(" ")).not.toMatch(/--linked|db\.example\.com/);
  });

  it("builds local-project commands only for a separately verified managed workdir", () => {
    expect(buildBetaDbCommands("postgresql://postgres:postgres@127.0.0.1:56422/postgres?sslmode=disable", "/repo", "/tmp/phase4"))
      .toEqual([
        ["db", "reset", "--no-seed", "--workdir", "/tmp/phase4"],
        ["test", "db", "--workdir", "/tmp/phase4"]
      ]);
  });
});
