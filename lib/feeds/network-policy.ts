import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FeedErrorCode } from "@/types/feeds";

export interface HostResolver {
  resolve(hostname: string): Promise<string[]>;
}

export class FeedNetworkError extends Error {
  constructor(public readonly code: FeedErrorCode, message: string) {
    super(message);
    this.name = "FeedNetworkError";
  }
}

export const nodeHostResolver: HostResolver = {
  async resolve(hostname) {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
  }
};

export async function assertPublicHttpUrl(url: URL, resolver: HostResolver): Promise<void> {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new FeedNetworkError("INVALID_URL", "Only credential-free HTTP(S) URLs are allowed.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new FeedNetworkError("BLOCKED_ADDRESS", "Local network addresses are not allowed.");
  }

  const directFamily = isIP(hostname);
  const addresses = directFamily ? [hostname] : await resolver.resolve(hostname);
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
    throw new FeedNetworkError("BLOCKED_ADDRESS", "The host resolves to a blocked address.");
  }
}

export function isPublicAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "").split("%")[0];
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family !== 6) return false;

  const bytes = ipv6Bytes(normalized);
  if (!bytes) return false;
  if (isIpv4Mapped(bytes)) {
    return isPublicIpv4(`${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`);
  }

  return ![
    ["::", 128],
    ["::1", 128],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
    ["2001:db8::", 32]
  ].some(([prefix, bits]) => ipv6HasPrefix(bytes, ipv6Bytes(prefix as string)!, bits as number));
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const value = (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
  const ranges: Array<[number, number]> = [
    [0x00000000, 8],
    [0x0a000000, 8],
    [0x64400000, 10],
    [0x7f000000, 8],
    [0xa9fe0000, 16],
    [0xac100000, 12],
    [0xc0000000, 24],
    [0xc0000200, 24],
    [0xc0a80000, 16],
    [0xc6120000, 15],
    [0xc6336400, 24],
    [0xcb007100, 24],
    [0xe0000000, 4],
    [0xf0000000, 4]
  ];
  return !ranges.some(([network, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (network & mask);
  });
}

function ipv6Bytes(address: string): Uint8Array | null {
  let value = address.toLowerCase();
  const ipv4Match = value.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const parts = ipv4Match[1].split(".").map(Number);
    if (parts.some((part) => part < 0 || part > 255)) return null;
    value = `${value.slice(0, -ipv4Match[1].length)}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
  }

  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let index = 0; index < groups.length; index += 1) {
    if (!/^[0-9a-f]{1,4}$/.test(groups[index])) return null;
    const group = Number.parseInt(groups[index], 16);
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  }
  return bytes;
}

function isIpv4Mapped(bytes: Uint8Array): boolean {
  return bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
}

function ipv6HasPrefix(address: Uint8Array, prefix: Uint8Array, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  for (let index = 0; index < fullBytes; index += 1) {
    if (address[index] !== prefix[index]) return false;
  }
  const remaining = bits % 8;
  if (remaining === 0) return true;
  const mask = 0xff << (8 - remaining);
  return (address[fullBytes] & mask) === (prefix[fullBytes] & mask);
}
