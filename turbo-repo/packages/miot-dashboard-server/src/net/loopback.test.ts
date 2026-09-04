import { describe, expect, it } from "vitest";
import { isLoopbackHost } from "./loopback";

describe("isLoopbackHost", () => {
  it.each([
    "127.0.0.1",
    "127.0.0.53",
    "127.255.255.255",
    "localhost",
    "LOCALHOST",
    " 127.0.0.1 ",
    "::1",
    "[::1]",
    "0:0:0:0:0:0:0:1",
    "::ffff:127.0.0.1",
  ])("accepts %j", (host) => {
    expect(isLoopbackHost(host)).toBe(true);
  });

  it.each([
    // A prefix test on a name accepted this. A name is resolved by whoever
    // answers DNS.
    "127.attacker.test",
    "127.0.0.1.attacker.test",
    "0.0.0.0",
    "::",
    "[::]",
    "192.168.1.10",
    "10.0.0.5",
    "example.test",
    "",
    // Shorthand forms a resolver accepts and this deliberately does not.
    "127.1",
    "2130706433",
    // Not an address at all, whatever it looks like.
    "127.0.0.256",
    "127.0.0.01",
  ])("refuses %j", (host) => {
    expect(isLoopbackHost(host)).toBe(false);
  });
});
