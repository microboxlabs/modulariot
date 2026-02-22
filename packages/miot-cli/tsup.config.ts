import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist",
    dts: true,
  },
]);
