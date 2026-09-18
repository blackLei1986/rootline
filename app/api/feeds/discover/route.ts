import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { safeFetchText } from "@/lib/feeds/safe-fetch";
import { discoverFeedUrls } from "@/lib/feeds/discovery";

const schema = z.object({ url: z.url() });

export async function POST(request: Request) {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const input = schema.parse(await request.json());
  const response = await safeFetchText(input.url, "article");
  return NextResponse.json({ urls: discoverFeedUrls(response.text, response.finalUrl) });
}
