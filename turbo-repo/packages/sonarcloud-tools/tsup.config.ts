import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist",
    clean: true,
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    outDir: "dist",
  },
]);
