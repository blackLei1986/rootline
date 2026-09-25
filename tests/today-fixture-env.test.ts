import {describe, expect, it} from "vitest";
import {isLocalTodayFixtureEnabled} from "@/lib/today/fixture-env";

describe("Today fixture environment guard", () => {
  it("never enables the unauthenticated fixture in production", () => {
    expect(isLocalTodayFixtureEnabled({NODE_ENV: "production", ROOTLINE_E2E_FIXTURES: "1"})).toBe(false);
    expect(isLocalTodayFixtureEnabled({NODE_ENV: "test", ROOTLINE_E2E_FIXTURES: "1"})).toBe(true);
    expect(isLocalTodayFixtureEnabled({NODE_ENV: "development", ROOTLINE_E2E_FIXTURES: "0"})).toBe(false);
  });
});
