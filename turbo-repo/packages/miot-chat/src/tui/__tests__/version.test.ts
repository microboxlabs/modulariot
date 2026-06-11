import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { packageVersion } from "../../version.js";

describe("packageVersion", () => {
  it("returns the version from package.json", () => {
    const require = createRequire(import.meta.url);
    const pkg = require("../../../package.json") as { version: string };
    expect(packageVersion()).toBe(pkg.version);
  });

  it("looks like a semver string", () => {
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
