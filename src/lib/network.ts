import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Defensive check for user-supplied endpoints. This is a preflight, not protection against
// DNS rebinding at fetch time; restrict egress to public networks in production as well.
export function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)
      || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    if (value.includes(".")) return isPublicAddress(value.slice(value.lastIndexOf(":") + 1)); // mapped dotted IPv4
    const mapped = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mapped) {
      const number = (parseInt(mapped[1], 16) << 16) | parseInt(mapped[2], 16);
      return isPublicAddress([number >>> 24 & 255, number >>> 16 & 255, number >>> 8 & 255, number & 255].join("."));
    }
    return !(value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")
      || value.startsWith("ff") || /^fe[89ab]/.test(value) || value.startsWith("2001:db8"));
  }
  return false;
}
export async function assertPublicHost(hostname: string) {
  if (!hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal)$/.test(hostname)) throw new Error("Private host not allowed");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(a => !isPublicAddress(a.address))) throw new Error("Private host not allowed");
}
