import { describe, expect, it } from "vitest";
// @ts-expect-error -- build script, outside the published types
import { importProblems } from "../scripts/guard-imports.mjs";

describe("pure UI import boundary", () => {
  it.each([
    'import "next/navigation";',
    'export { x } from "@/features/dashboard";',
    'import React from "react";',
    "const m = import(`node:fs`);",
    'const m = require("@microboxlabs/miot-dashboard-server");',
    'import "../../apps/app";',
  ])("rejects framework, host and server dependencies: %s", (source) => {
    expect(
      importProblems(source, "/package/src/core.ts", "/package/src"),
    ).toHaveLength(1);
  });

  it("allows the shared contract and local modules, ignoring quoted examples", () => {
    const source = `
      import { GRID_COLS } from "@microboxlabs/miot-dashboard-contract/document";
      export { computeGridSizing } from "./core/grid-sizing";
      // import "next/navigation";
      const help = 'import "react"';
    `;
    expect(
      importProblems(source, "/package/src/core.ts", "/package/src"),
    ).toEqual([]);
  });
});
