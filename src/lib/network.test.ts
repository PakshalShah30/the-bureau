import { describe, expect, it } from "vitest";
import { isPublicAddress } from "./network";
describe("public network guards", () => {
  it("rejects private, loopback, mapped and CGNAT addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "fd12::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "ff02::1"]) expect(isPublicAddress(ip)).toBe(false);
  });
  it("permits publicly routable IPv4 and IPv6", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
});
