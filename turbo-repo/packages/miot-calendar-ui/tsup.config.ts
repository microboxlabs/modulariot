import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // This is an interactive, client-rendered calendar UI: tsup bundles to a single
  // module and strips per-file "use client" directives, so mark the whole bundle a
  // React Client Component boundary. Consumers (incl. RSC servers) import it from
  // within their client tree; server components may still import its *types* freely.
  // Validated: the app's `next build` compiles with this in place.
  banner: { js: '"use client";' },
  // React UI package: emit automatic JSX runtime so consumers don't import React.
  esbuildOptions: (options) => {
    options.jsx = "automatic";
  },
});
