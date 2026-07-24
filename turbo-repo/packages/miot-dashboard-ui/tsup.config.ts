import { defineConfig } from "tsup";

export default defineConfig({
  // Two entries by design (plan §8 bundle strategy): "." is the base surface;
  // "./charts" isolates the chart dashlets so echarts (~1 MB) never lands in
  // the bundle of a consumer that doesn't use charts.
  entry: ["src/index.ts", "src/charts.ts", "src/schema.ts", "src/core.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // This is an interactive, client-rendered dashboard UI: tsup bundles to
  // modules and strips per-file "use client" directives, so mark the whole
  // bundle a React Client Component boundary. Consumers (incl. RSC servers)
  // import it from within their client tree; server components may still
  // import its *types* freely. Same contract as @microboxlabs/miot-calendar-ui.
  banner: { js: '"use client";' },
  // React UI package: emit automatic JSX runtime so consumers don't import React.
  esbuildOptions: (options) => {
    options.jsx = "automatic";
  },
});
