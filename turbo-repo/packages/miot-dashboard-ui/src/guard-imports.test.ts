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
  it.each(["../embed", "../embed/mount-dashboard.js"])(
    "rejects mounting dependencies from React: %s",
    (specifier) => {
      expect(
        importProblems(
          `export * from "${specifier}";`,
          "/package/src/react/component.ts",
          "/package/src",
        ),
      ).toHaveLength(1);
    },
  );
  it("allows the mounting entry to consume React components", () => {
    expect(
      importProblems(
        'export * from "../react/dashboard-canvas.js";',
        "/package/src/embed/mount-dashboard.ts",
        "/package/src",
      ),
    ).toEqual([]);
  });
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

describe("Web Component entry boundary", () => {
  it.each(["react/component.ts", "embed/mount.ts", "client/fetch.ts"])(
    "rejects reverse Web Component imports from %s",
    (origin) => {
      expect(
        importProblems(
          'export * from "../web-component/define-dashboard-element";',
          `/package/src/${origin}`,
          "/package/src",
        ),
      ).toHaveLength(1);
    },
  );
  it("allows mounting imports but rejects direct rendering dependencies", () => {
    const file = "/package/src/web-component/element.ts";
    expect(
      importProblems(
        'import "../embed/mount-dashboard";',
        file,
        "/package/src",
      ),
    ).toEqual([]);
    expect(
      importProblems(
        'import "../react/dashboard-canvas";',
        file,
        "/package/src",
      ),
    ).toHaveLength(1);
    expect(
      importProblems('import "react-dom/client";', file, "/package/src"),
    ).toHaveLength(1);
  });
});

describe("standalone browser entry boundary", () => {
  it.each([
    ["./embed", 0],
    ["./web-component.js", 0],
    ["./client", 1],
    ["./react/dashboard-canvas", 1],
    ["react", 1],
  ])("checks browser entry import %s", (specifier, problems) => {
    expect(
      importProblems(
        `export * from "${specifier}";`,
        "/package/src/browser.ts",
        "/package/src",
      ),
    ).toHaveLength(problems);
  });
  it("rejects importing the bundled runtime into the peer-based React entry", () => {
    expect(
      importProblems(
        'export * from "../browser";',
        "/package/src/react/component.ts",
        "/package/src",
      ),
    ).toHaveLength(1);
  });
});

it("allows React DOM portals only in the React entry", () => {
  const source = 'import { createPortal } from "react-dom";';
  expect(
    importProblems(source, "/package/src/react/popover.tsx", "/package/src"),
  ).toEqual([]);
  for (const file of ["core.ts", "client.ts", "document.ts", "templates.ts"]) {
    expect(
      importProblems(source, `/package/src/${file}`, "/package/src"),
    ).toEqual(["react-dom"]);
  }
});

describe("chart engine boundary", () => {
  it("allows only type declarations from the optional chart engine", () => {
    expect(
      importProblems(
        'import type { EChartsOption } from "echarts";',
        "/package/src/charts/legacy.ts",
        "/package/src",
      ),
    ).toEqual([]);
    for (const source of [
      'import { init } from "echarts";',
      'export * from "echarts";',
      'const engine = import("echarts");',
    ]) {
      expect(
        importProblems(source, "/package/src/charts/legacy.ts", "/package/src"),
      ).toHaveLength(1);
    }
    expect(
      importProblems(
        'import type { EChartsOption } from "echarts";',
        "/package/src/core.ts",
        "/package/src",
      ),
    ).toHaveLength(1);
  });
});
