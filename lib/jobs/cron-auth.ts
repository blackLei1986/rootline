import { timingSafeEqual } from "node:crypto";

export function authorizeCronRequest(header: string | null, expectedSecret: string): boolean {
  if (!header?.startsWith("Bearer ") || !expectedSecret) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedSecret, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
