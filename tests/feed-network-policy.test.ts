// @vitest-environment node

import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, FeedNetworkError } from "@/lib/feeds/network-policy";

describe("feed network policy", () => {
  it.each([
    "http://127.0.0.1/feed",
    "http://[::1]/feed",
    "http://10.10.0.2/feed",
    "http://169.254.169.254/latest/meta-data",
    "http://172.16.4.2/feed",
    "http://192.168.1.1/feed",
    "http://[::ffff:127.0.0.1]/feed"
  ])("blocks reserved address %s", async (value) => {
    await expect(assertPublicHttpUrl(new URL(value), resolver("93.184.216.34")))
      .rejects.toMatchObject({ code: "BLOCKED_ADDRESS" });
  });

  it("blocks a public-looking hostname when DNS resolves privately", async () => {
    await expect(
      assertPublicHttpUrl(new URL("https://news.example/feed"), resolver("10.0.0.8"))
    ).rejects.toBeInstanceOf(FeedNetworkError);
  });

  it("allows a public hostname resolving only to public addresses", async () => {
    await expect(
      assertPublicHttpUrl(
        new URL("https://news.example/feed"),
        resolver("93.184.216.34", "2606:4700:4700::1111")
      )
    ).resolves.toBeUndefined();
  });
});

function resolver(...addresses: string[]) {
  return { resolve: async () => addresses };
}
