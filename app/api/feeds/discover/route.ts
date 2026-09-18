import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { safeFetchText } from "@/lib/feeds/safe-fetch";
import { discoverFeedUrls } from "@/lib/feeds/discovery";

const schema = z.object({ url: z.url() });

export async function POST(request: Request) {
  await requireVerifiedViewer();
  const input = schema.parse(await request.json());
  const response = await safeFetchText(input.url, "article");
  return NextResponse.json({ urls: discoverFeedUrls(response.text, response.finalUrl) });
}
