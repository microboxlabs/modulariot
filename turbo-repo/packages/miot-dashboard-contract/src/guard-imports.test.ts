import { describe, expect, it } from "vitest";

// @ts-expect-error -- a build script, not part of the published types
import { specifiersIn } from "../scripts/guard-imports.mjs";

describe("the import guard's specifier extraction", () => {
  it.each([
    ['import { z } from "zod";', "zod"],
    ["export { a } from './document';", "./document"],
    ['import "node:fs";', "node:fs"],
    ['const m = await import("node:path");', "node:path"],
    ['const m = require("node:url");', "node:url"],
    // A regex over the source text misses this one, which is how a browser
    // bundle would acquire a Node builtin without the guard noticing.
    ["const m = await import(`node:fs`);", "node:fs"],
  ])("finds the specifier in %j", (source, expected) => {
    expect(specifiersIn(source)).toContain(expected);
  });

  it("ignores an import form quoted inside a comment", () => {
    const source = [
      '/** Reasons read like `from "outside the scope"`. */',
      'import { z } from "zod";',
    ].join("\n");
    expect(specifiersIn(source)).toEqual(["zod"]);
  });

  it("ignores an import form quoted inside a string", () => {
    const source = "export const help = 'write: from \"somewhere\"';";
    expect(specifiersIn(source)).toEqual([]);
  });
});
