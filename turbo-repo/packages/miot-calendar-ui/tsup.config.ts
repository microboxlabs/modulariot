import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // React UI package: emit automatic JSX runtime so consumers don't import React.
  esbuildOptions: (options) => {
    options.jsx = "automatic";
  },
});
