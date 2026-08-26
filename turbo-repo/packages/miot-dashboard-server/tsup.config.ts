import { defineConfig } from "tsup";

export default defineConfig({
  // P0 ships the framework-agnostic core only. The `./next` route-handler
  // mount lands with P2 (persistence strangle) and `./fastify` with P8; both
  // get their own entry here rather than being bundled into ".", so a host
  // never pulls in a framework it doesn't use.
  entry: ["src/index.ts"],
  format: ["esm"],
  outDir: "dist",
  dts: true,
  clean: true,
  // Node services, not a browser bundle.
  platform: "node",
  target: "node20",
});
