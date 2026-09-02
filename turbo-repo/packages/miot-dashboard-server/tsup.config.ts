import { defineConfig } from "tsup";

export default defineConfig({
  // One entry per layer, so a consumer pays only for what it mounts.
  //
  //   index   — core: seams, access control (no HTTP, no framework)
  //   http    — fetch-shaped handler (Web types only)
  //   testing — in-memory seams; shippable, no test framework imported
  //   server  — Node listener, probes, lifecycle (the only Node-assuming entry)
  //
  // The Next adapter gets its own entry when it lands; keeping these apart is
  // what stops a host that mounts the library from pulling in a listener, and
  // a standalone deployment from pulling in a framework.
  // All entries sit directly in src/, so the bundler emits them flat into
  // dist/ rather than mirroring a subdirectory into the published paths.
  entry: [
    "src/index.ts",
    "src/http.ts",
    "src/testing.ts",
    "src/server.ts",
    "src/bin.ts",
  ],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // Node services, not a browser bundle.
  platform: "node",
  target: "node20",
});
