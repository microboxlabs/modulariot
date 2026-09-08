import { describe, expect, it } from "vitest";

import { normalizeDomain } from "./domain-name";

describe("normalizeDomain", () => {
  it("lowercases, trims and strips the port and trailing dot", () => {
    expect(normalizeDomain("  PORTAL.Example.COM.:8443 ")).toBe(
      "portal.example.com",
    );
  });

  it("keeps a plain host untouched", () => {
    expect(normalizeDomain("storm.modulariot.com")).toBe(
      "storm.modulariot.com",
    );
  });

  it.each([
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
    ["empty label", "not..a..domain"],
    ["leading hyphen", "-bad.example"],
    ["trailing hyphen", "bad-.example"],
    ["underscore", "under_score.example"],
    ["path traversal", "evil.example/../../api/v1/platform"],
    ["non-numeric suffix after colon", "https://example.com"],
    ["overlong label", `${"a".repeat(64)}.example`],
    ["overlong name", `${"a.".repeat(127)}example`],
  ])("rejects %s", (_label, value) => {
    expect(normalizeDomain(value)).toBeNull();
  });
});
