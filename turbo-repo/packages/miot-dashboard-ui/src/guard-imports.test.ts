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

describe("React entry boundary", () => {
  it("allows React only inside the opt-in React entry", () => {
    expect(
      importProblems(
        'import { useState } from "react";',
        "/package/src/react/use-state.ts",
        "/package/src",
      ),
    ).toEqual([]);
    expect(
      importProblems(
        'import { useState } from "react";',
        "/package/src/client.ts",
        "/package/src",
      ),
    ).toHaveLength(1);
  });
  it("rejects indirect framework imports from pure or browser entries", () => {
    expect(
      importProblems(
        'export * from "../react/use-state";',
        "/package/src/core/util.ts",
        "/package/src",
      ),
    ).toHaveLength(1);
    expect(
      importProblems(
        'export * from "./react.js";',
        "/package/src/client.ts",
        "/package/src",
      ),
    ).toHaveLength(1);
    expect(
      importProblems(
        'export * from "../client";',
        "/package/src/core/util.ts",
        "/package/src",
      ),
    ).toHaveLength(1);
  });
});
