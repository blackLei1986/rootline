// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { safeFetchText, SAFE_FETCH_LIMITS } from "@/lib/feeds/safe-fetch";

describe("safe feed fetch", () => {
  it("blocks a redirect pivot from a public URL to a private host", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } })
    );

    await expect(
      safeFetchText("https://public.example/feed", "feed", {
        resolver: { resolve: async () => ["93.184.216.34"] },
        fetchImpl: fetchImpl as typeof fetch,
        now: () => new Date("2026-09-17T00:00:00.000Z"),
        contact: "admin@example.com"
      })
    ).rejects.toMatchObject({ code: "BLOCKED_ADDRESS" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a fourth redirect", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const hop = Number(url.searchParams.get("hop") ?? "0");
      return new Response(null, {
        status: 302,
        headers: { location: `https://public.example/feed?hop=${hop + 1}` }
      });
    });

    await expect(
      safeFetchText("https://public.example/feed", "feed", {
        resolver: { resolve: async () => ["93.184.216.34"] },
        fetchImpl: fetchImpl as typeof fetch,
        now: () => new Date(),
        contact: "admin@example.com"
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REDIRECTS" });
  });

  it("counts streamed decompressed bytes and rejects oversized feeds", async () => {
    const oversized = "x".repeat(SAFE_FETCH_LIMITS.feedBytes + 1);
    const fetchImpl = vi.fn(async () =>
      new Response(oversized, {
        status: 200,
        headers: { "content-type": "application/rss+xml" }
      })
    );

    await expect(
      safeFetchText("https://public.example/feed", "feed", {
        resolver: { resolve: async () => ["93.184.216.34"] },
        fetchImpl: fetchImpl as typeof fetch,
        now: () => new Date(),
        contact: "admin@example.com"
      })
    ).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });
});
