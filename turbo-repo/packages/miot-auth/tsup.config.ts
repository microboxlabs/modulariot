import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/browser-oauth.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
});
